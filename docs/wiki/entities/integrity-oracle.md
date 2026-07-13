---
title: integrity-oracle
created: 2026-07-07
updated: 2026-07-12
type: entity
tags: [infrastructure, metrics, layer-2, tokenomics]
confidence: high
source_files:
  - integrity-oracle/scoring-core/src/lib.rs
  - integrity-oracle/backend/src/handlers.rs
  - integrity-oracle/backend/src/chain.rs
  - integrity-oracle/backend/src/db.rs
  - integrity-oracle/backend/src/phi.rs
  - integrity-oracle/backend/src/crypto/mod.rs
  - integrity-oracle/backend/src/openapi.rs
  - integrity-oracle/backend/migrations/0001_init.sql
  - integrity-oracle/backend/migrations/0002_markets_and_judge.sql
  - integrity-oracle/backend/migrations/0003_agent_did_document.sql
---

The off-chain brain (Rust, Axum, Postgres, Redis, `alloy`): it ingests agent
telemetry, computes the [Agent Integrity Score](../concepts/ais.md), and
independently verifies agents' on-chain state — including, as of this pass, the
[market/application layer](../concepts/agent-primitives.md) (§6.9) — so nothing
downstream has to trust an agent's own word. Per §6.10 of the interface contract,
this is the **only** backend that ever reads on-chain state.

## Workspace

- **`scoring-core`** — dependency-free; the **one** place the AIS formula is
  computed. Everyone else reads the HTTP API.
- **`backend`** — Axum server, sqlx persistence, Redis rate limiting,
  `bb verify` ZK verification, Merkle building, and the `alloy` on-chain read
  client.

## HTTP API

```
POST /v1/agent/register
GET  /v1/agent/{id}
GET  /v1/agents
GET  /v1/agent/{id}/ais
GET  /v1/agent/{id}/compliance
GET  /v1/agent/{id}/wallet
GET  /v1/agent/{id}/telemetry
GET  /v1/agent/{id}/traces
POST /v1/telemetry/ingest
GET  /v1/markets
GET  /v1/markets/{id}
GET  /v1/leaderboard
GET  /healthz
```

### `GET /v1/agent/{id}/telemetry`, `GET /v1/agent/{id}/traces`

Real history queries returning lists of past telemetry events and judge traces respectively, queried directly from Postgres (`telemetry_events` and `judge_evaluations` tables) and returned as structured DTO arrays. Used by the MVP UI to render live feeds and historical execution logs.


**The honesty crux:** `POST /v1/agent/register` independently calls
`XibalbaAgentRegistry.resolveDID` and rejects (`400`) if the client's claimed
[7 primitives](../concepts/agent-primitives.md) don't match on-chain state. This
is what makes "the chain is the source of truth" real, not decorative.
Request body (`RegisterAgentRequest`, `handlers.rs`): `did` (required — not
`agent_id`), `did_document`, `primitives` (exactly the 7 `PrimitiveSetDto`
fields), `ed25519_pubkey_hex`/`eth_address_hex` (`Option<String>` each, but
the handler 400s if *both* are absent), `verification_tier` (`i32`, defaults
to `0`). Now documented in `docs/INTERFACE_CONTRACT.md` §6.3 — it was silent
on this schema until 2026-07-09, which is how `integrity-sdk`'s client drifted
from it undetected (see [integrity-sdk](integrity-sdk.md)'s "Fixed 2026-07-09"
note).

### `GET /v1/markets`, `GET /v1/markets/{id}` (§6.9)

Real reads of every `IntegrityMarket` clone via `MarketFactory`. Enumeration is
concurrent (`futures::future::join_all`), not a serial loop, and cached in Postgres
(`markets_cache` + a single-row `markets_index_sync` marker) behind a 30s staleness
window (`handlers::MARKETS_CACHE_STALENESS_SECS`) — a documented tradeoff between RPC
load and freshness, not silent staleness. On a cache miss/stale hit, `list_markets`
re-enumerates `MarketFactory.allMarketsCount()` (not just refreshes existing rows) so a
newly-created market is actually discovered.

`GET /v1/markets/{id}` (`{id}` = the market's contract address) returns `question`,
`outcomeCount`, `resolved`, `winningOutcome`, `resolveDeadline`, `totalStaked`, and
`outcomeStaked` per outcome (the real pari-mutuel pool — cheap public-getter reads).
An optional `?agent=0x...` query param adds a real, single `getPosition` read as
`your_position`. **Documented gap:** enumerating every holder's position across a
market requires indexing `PositionEntered` events, which this pass does not build —
`positions_note` in the response says so explicitly rather than silently omitting it.

Uint256 amounts (`min_ais_to_enter`, `total_staked`, `outcome_staked[i]`) are always
decimal **strings** in both the DB (`TEXT`, not a numeric type sqlx isn't configured
for) and the JSON DTOs — a `uint256` can exceed both `i64` and `f64`'s safe integer
range.

**Contract-vs-brief discrepancy found while building this:** `MarketFactory` has no
`allMarkets() returns (address[])` getter — `address[] public allMarkets` only
auto-generates an indexed `allMarkets(uint256) returns (address)` getter. Enumeration
is `allMarketsCount()` + concurrent `allMarkets(i)` reads
(`ChainClient::all_market_addresses`). By-creator listing uses the real
`getMarketsByCreator(address) returns (address[])` function, not the
`marketsByCreator` mapping's auto-getter (which also needs an index).

### `GET /v1/leaderboard`

Ranks agents by real `ReputationRegistry.effectiveScore` (decimal string, same
`ChainClient::effective_score` method `chain.rs` already had). **No fabricated P&L**:
`realized_pnl` is always `null` — computing it for real would require indexing
`IntegrityMarket` `PositionEntered`/`MarketResolved`/`PayoutClaimed` events across
every market, out of scope for this pass. An honestly-incomplete ranking, not a silent
mock. Only agents with a resolvable on-chain `PrimitiveSet` (cached, or live-resolved
and cached on the fly) appear.

### `GET /v1/agent/{id}/wallet`

Real `IntegrityToken.balanceOf(sovereignAgent)` read (decimal string), plus open
positions: a real `getPosition` read against every cached market for that agent's
`SovereignAgent` address, filtered to `amount > 0 && !claimed`. **Documented gap:**
`transaction_history` is always `null` — transfer/stake/payout history requires
indexing on-chain events (`Transfer`, `PositionEntered`, `PayoutClaimed`, ...), not
built this pass.

### PHI backstop on `POST /v1/telemetry/ingest`

`src/phi.rs` mirrors `integrity-sdk/integrity_sdk/security/redactor.py`'s regex
categories (`PRIVATE_KEY`, `API_KEY`, `SSN`, `CREDIT_CARD`, `EMAIL`, `PHONE`, `MRN`)
as a server-side defense-in-depth backstop: it recursively scans every JSON **string**
leaf in `otel_spans` (and an optional `judge_evaluation`), and rejects (`400`,
`AppError::PhiDetected`) if any raw, unredacted pattern is found — belt-and-suspenders
for a buggy/bypassed client, never a replacement for the SDK's own client-side
redaction. Runs before any DB/RPC work in `ingest_telemetry`, so it fails fast. Only
string values are scanned (numeric/structural fields are skipped) — the SDK's redactor
never touches those either, so scanning them here would just produce false positives
on values nobody was ever going to redact.

### Judge evaluations (storage only — no judge implementation)

`TelemetryIngestRequest.judge_evaluation` (optional) persists into the new
`judge_evaluations` table (`run_id`, `judge_model`, `verdict`, `score`,
`rationale_summary`, linked to the telemetry event). **Deliberately NOT part of the
signed envelope** — `ingest_telemetry`'s `signable` JSON (what `crypto::verify_agent_signature`
checks) does not include this field, so adding a judge evaluation never requires a
client to re-sign, and no existing client's signature breaks. It rides along as an
unauthenticated sidecar on an otherwise-authenticated request. No judge/rubric
implementation exists anywhere in this codebase — this is plumbing only, per the task
scope (a Xibalba Solutions product decision not yet made).

## On-chain client (`chain.rs`)

Read-only via `alloy` (stored as `DynProvider` so `sol!` bindings work): resolves
an agent's `PrimitiveSet`, reads `ReputationRegistry.effectiveScore`/`isZkBoosted`,
`ComplianceGate.vertical`/`isHealthcareCompliant`, and — new — `MarketFactory`
enumeration, per-market `IntegrityMarket` view state, `getPosition`, and
`IntegrityToken.balanceOf`. `MarketFactory`/`IntegrityToken` singleton addresses are
`Option<Address>` in the deployments-file parse (`Singletons`), not required: a
genesis-only deployments file that predates the market layer still parses, and
handlers needing them return a clean `ChainError::MissingSingleton` (400) instead of
this client failing to even connect.

## Anchoring

Telemetry leaves batched into a keccak256 [Merkle tree](../concepts/merkle-batching.md);
because `StateAnchor` is per-agent, the same epoch root is submitted to each
participating agent's own `StateAnchor` clone — a documented gas tradeoff.

## Canonical JSON signing — real cross-language bug fixed 2026-07-11

`crypto::canonical_json_bytes` (the byte representation `ingest_telemetry`
verifies an agent's telemetry-envelope signature against) used
`serde_json`'s default compact formatter, which emits non-ASCII string
content as raw UTF-8. Every producer this oracle must verify against
(`integrity-sdk/integrity_sdk/bcc.py`, `bcc_middleware/app/canonical.py`)
instead pins Python's `ensure_ascii=True` (non-ASCII escaped as `\uXXXX`,
surrogate pairs for astral code points) — both modules' own docstrings
explicitly warned a Rust implementation using a different default here
would produce a different signature, and this one did. Was masked until
now because nothing successfully reached signature verification at all
(see [integrity-sdk](integrity-sdk.md)'s matching fix — the SDK's own
request used to fail JSON deserialization before ever reaching this check).
Fixed with a custom `AsciiEscapingFormatter` overriding only
`write_string_fragment` (the rest of `serde_json::ser::Formatter`'s default
methods, which `CompactFormatter` also just uses unmodified, are
inherited).

## State

**54 backend + scoring-core lib tests** (confirmed via a real run — 46
backend incl. 3 new `crypto::` tests for the fix above, 8 scoring-core),
including `src/phi.rs` unit tests covering
every PHI category, the already-redacted-marker non-reflag case, and the
numeric-vs-string-field scan boundary), plus a real full-stack e2e (`tests/e2e.rs`,
opt-in via `ORACLE_E2E=1`) that stands up live anvil + `Deploy.s.sol` (which now
deploys the market layer as part of genesis) + a real SDK-registered agent + Postgres
+ Redis + the HTTP server, and asserts accept-correct / reject-fabricated primitives,
AIS scoring, the live compliance read, a real (empty, pre-any-market) `GET
/v1/markets`, a real one-entry `GET /v1/leaderboard`, a real `GET
/v1/agent/{id}/wallet` balance read, and the PHI backstop's real HTTP-level 400.
**Documented follow-up, not built this pass:** a full market lifecycle e2e
(`enterPosition`/`resolve`/`claimPayout` through a second real registered agent) —
out of scope for this task; the light e2e above proves the real binding/parse/handler
path without that heavier setup.

Related: [AIS](../concepts/ais.md),
[agent primitives](../concepts/agent-primitives.md),
[Interface Contract](../../INTERFACE_CONTRACT.md).
