# Production Architecture Gap Analysis & Codebase Audit

Following a deep audit of the `INTEGRITY-LATEST` codebase, the following outlines the specific, technical gaps required to connect the `integrity-mvp` UI to the backend production systems.

## 1. Oracle (`integrity-oracle/backend`)
*Current State:* Streaming, real OTLP ingestion, and time-bucketed historical queries
are now real (see `stream.rs`, `otlp.rs`, migration `0004_timescale_and_otel_spans.sql`)
— verified end-to-end against a live server with the real, unmodified SDK exporter and
a real EIP-191-signed ingest, not just unit-tested. What's below is what's still
genuinely open, not a restatement of the original three gaps.
* **Closed - Streaming Telemetry (SSE):** `GET /v1/stream` and
  `GET /v1/agent/{id}/stream` push `TelemetryEvent`/`OtelSpan`/`AisUpdate` frames over
  Server-Sent Events (not WebSocket — every consumer here only receives, never sends).
  `AisUpdate` always comes from `handlers::compute_ais_for_agent`, the same function
  `GET /v1/agent/{id}/ais` calls, so a pushed score can never drift from a direct read —
  proven by `oracle_e2e_sse_matches_direct_ais` (real HTTP, real signature, asserts
  numeric equality). Fan-out is an in-process `tokio::sync::broadcast` channel, correct
  at today's single-oracle-instance scale (`docker-compose.yml`); Redis pub/sub is the
  noted scale-out path if the oracle is ever run as more than one replica, not built.
* **Closed - OTLP Ingestion:** `otlp.rs` runs a real `tonic` gRPC server on
  `OTLP_GRPC_ADDR` (default `0.0.0.0:4317`) implementing `TraceService`/`MetricsService`
  from `opentelemetry-proto`. This lights up `integrity-sdk`'s already-working
  `OTLPSpanExporter` (which previously exported into a void) — verified with the real
  exporter, not a hand-rolled client, in `oracle_e2e_otlp_ingestion`. Spans are
  PHI-scanned (same backstop as `POST /v1/telemetry/ingest`) and persisted to a new
  `otel_spans` table, deliberately **separate from `telemetry_events` and never an AIS
  input** — real OTLP spans carry no signature envelope, so treating them as
  equally-trusted input would let an unauthenticated source move an agent's score. This
  stays true — and `/v1/agent/{id}/otel/volume`'s data should be treated as
  unauthenticated, not tamper-evident — until real SDK-side span signing exists (see
  item 2 below, still open). Metrics export is accepted (the SDK's `OTLPMetricExporter`
  gets a real response) but not parsed/persisted — no metrics table exists yet; a real,
  named gap, not a silent one.
* **Partially closed - Time-Series Storage:** `otel_spans` is a genuine TimescaleDB
  hypertable (`CREATE EXTENSION timescaledb` + `create_hypertable`, see
  `docker-compose.yml`'s `postgres` service, now `timescale/timescaledb:latest-pg16`).
  `telemetry_events` is deliberately **not** converted to a hypertable — it's referenced
  by an inbound foreign key from `judge_evaluations.telemetry_event_id`, and TimescaleDB
  does not support foreign keys that reference a hypertable; converting would break that
  constraint for no clear payoff at current data volumes. `time_bucket()` (via
  `GET /v1/agent/{id}/ais/history`, `.../telemetry/volume`, `.../otel/volume`) works
  against `telemetry_events` regardless, since the function only needs the extension
  installed, not the target table to be a hypertable. **Still open:** the GraphQL layer
  (`async-graphql`) named in the original ask was deliberately deferred — only 2-3 fixed
  query shapes exist today, served by the three REST endpoints above; GraphQL is the
  first thing to add if/when the query surface actually grows past that. Continuous
  aggregates/compression policies (Timescale features that matter once volume is large)
  are also not configured yet — not needed at current/MVP volume.

## 2. Python SDK (`integrity-sdk`)
*Current State:* The SDK is surprisingly mature in its tracing infrastructure. `core.py` and `mlflow_tracing.py` already implement `TracerProvider` and `MeterProvider` with OTLP/gRPC exporters. 
* **Gap - Chain of Thought Structuring:** While OpenTelemetry is present, the specific "Chain of Thought" reasoning trees (hypotheses, contradiction checks) are likely being logged as flat unstructured attributes or raw strings. The SDK must be updated to emit these as explicit directed acyclic graphs (DAGs) using parent-child span relationships so the UI's `ChainOfThoughtPage` can visualize the nodes correctly.
* **Gap - Cryptographic Attestation of Spans:** While the SDK handles DID and ZK proving, the raw OpenTelemetry spans sent to the OTLP endpoint are not inherently cryptographically signed. The SDK must inject a secp256k1 signature header or trace attribute proving that the telemetry actually originated from the attested enclave.

## 3. Smart Contracts (`contracts/src`)
*Current State:* The Solidity contracts *do* exist. `contracts/src/markets/IntegrityMarket.sol` and `contracts/src/shield/SmartBAA.sol` are implemented.
* **Gap - Frontend Web3 Integration:** The `integrity-mvp` UI currently has zero Web3 wallet connectivity. We must install and configure `wagmi`, `viem`, and a provider like `@web3modal/react` to allow users to interact with these contracts (e.g., placing bets on the Binary Exchange or signing Patient Consent contracts).
* **Gap - Subgraph/Indexer:** Reading historical market state or BAA compliance directly from RPC nodes is too slow for a dashboard. We need to build and deploy a framework (like The Graph or Ponder) to index events from `IntegrityMarket` and `SmartBAA`, which the UI can query via GraphQL.

## 4. BCC Middleware (`bcc_middleware`)
*Current State:* The FastAPI middleware intercepts requests to evaluate OPA policies (`opa_client.py`). 
* **Gap - Active Quarantine Enforcement:** The middleware currently relies on static policies. It must be updated to aggressively poll or subscribe to the Oracle's WSS feed or the blockchain's state. If an agent's `SmartBAA` is slashed on-chain, the BCC Middleware must dynamically and instantly sever that agent's egress network traffic (the "Quarantine Zone") without waiting for a static policy update.

## 5. CI / Autonomous Fix-Forward (`.github/workflows/ci.yml`)
*Current State:* A real CI workflow now runs every package's test suite (mirroring the root `Makefile`'s `test` target) as separate per-package jobs on push/PR to `main`.
* **Gap - Jules Autonomous Triggering:** The `notify-jules-on-failure` job is a placeholder — it does not yet call the Jules API. Closing this requires: (1) the repo owner authorizing Jules for `XibalbaTechSol/integrity-latest` at jules.google.com, (2) a `JULES_API_KEY` repository secret, and (3) confirming the `@google/jules-mcp` MCP server's actual task-creation call shape (not yet inspected — the server wasn't connected in the session that authored this workflow; MCP servers registered mid-session require a Claude Code restart to connect) before replacing the placeholder step with a real `curl`/API call.
