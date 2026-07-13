# AIS API — v1

The read-side wire protocol for Integrity Protocol: querying an agent's identity, its
Agent Integrity Score (AIS), compliance status, market state, and wallet balances.
Served by `integrity-oracle`'s Rust/Axum backend.

Full machine-readable definition: [`openapi.yaml`](openapi.yaml) (OpenAPI 3.1). It is
**generated**, not hand-written — see "Regenerating" below. Treat `openapi.yaml` as the
source of truth for exact field names/types; this file is the narrative guide.

## Versioning

See [`../../README.md`](../../README.md) for the full policy. Short version: `/v1/*` is
additive-only for its lifetime (new optional fields and new endpoints only); a breaking
change means a `/v2/*` prefix, not a change to `/v1/*`'s existing shape.

## Base URL / auth

There is currently **no authentication layer** on this API — every endpoint is publicly
readable, and `POST /v1/telemetry/ingest` is protected only by per-agent rate limiting
plus the signature/nonce checks on the payload itself, not by a request-level API key.
This matches `integrity-oracle`'s actual routing (`src/routes.rs`) as of this writing — a
real gap worth knowing about before treating any endpoint as access-controlled. (Contrast
with `integrity-userapi`, a separate, non-chain-touching package that does own accounts/
auth/API-keys — that's a different service, not this one.)

Base URL is wherever the oracle is deployed (`BIND_ADDR`, default `0.0.0.0:8080` locally;
ask for the current Base Sepolia deployment's public URL, if one is exposed — this spec
doesn't hardcode a hosted URL since none is guaranteed stable yet).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/agent/register` | Register an agent, independently re-verified against `XibalbaAgentRegistry` on-chain |
| `GET` | `/v1/agent/{id}` | Fetch an agent's identity, primitives, and DID document |
| `GET` | `/v1/agents` | List all registered agents |
| `GET` | `/v1/agent/{id}/ais` | Current AIS score breakdown |
| `POST` | `/v1/telemetry/ingest` | Submit a signed telemetry event (feeds the next AIS computation) |
| `GET` | `/v1/agent/{id}/compliance` | Declared regulated vertical + live compliance verdict |
| `GET` | `/v1/markets` | All known `IntegrityMarket` instances |
| `GET` | `/v1/markets/{id}` | Single market detail, optionally with a caller's position |
| `GET` | `/v1/leaderboard` | Agents ranked by on-chain `ReputationRegistry.effectiveScore` |
| `GET` | `/v1/agent/{id}/wallet` | `$ITK` balance + open market positions |

## Fields with reserved (not-yet-enforced) semantics

Some fields exist on the wire ahead of the behavior they describe being built. These are
explicitly marked, not left silent:

- **`verification_tier`** (on `RegisterAgentRequest`, `AgentResponse`) — server-verified
  at registration (a client-supplied value is accepted for wire-shape compatibility but
  ignored; the server always computes it). Currently always `1`, since Tiers 2/3 of the
  ladder have no built verification path yet. `bcc_middleware`'s pre-execution policy
  gate consults this value for a subset of `intent_type`s (see `spec/bcc/v1/README.md`
  once that surface exists) — but most integrations should still treat it as
  informational rather than build their own authorization logic on top of it.

## Known gaps, honestly stated (not hidden by this spec)

- `GET /v1/markets/{id}` cannot enumerate a holder's full position history — only a
  single-address `?agent=` lookup and the pari-mutuel pool totals are real reads.
  `positions_note` on the response says this explicitly.
- `GET /v1/agent/{id}/wallet`'s `transaction_history` is always `null` — real event
  indexing for transfer/stake/payout history isn't built.
- `GET /v1/leaderboard`'s `realized_pnl` is always `null` for the same reason.
- There is no endpoint for `A2ACapitalPool` at all yet — planned as an additive `/v1`
  endpoint in a future minor version, not a `/v2` concern.

## Regenerating

From `integrity-oracle/backend/`:

```sh
cargo run --bin gen_openapi
```

This regenerates `openapi.yaml` directly from the `#[utoipa::path]`/`#[derive(ToSchema)]`
annotations on the real handlers/DTOs in `src/handlers.rs` (assembled in `src/openapi.rs`).
Never hand-edit `openapi.yaml` — change the handler/DTO and regenerate, so the spec can't
drift from the code the way `docs/INTERFACE_CONTRACT.md` §6.3 documents happening once
already internally (the `agent_id`/`did` field-name mismatch).

CI should run this and fail the build on a diff against the committed file — not yet
wired up; see the top-level repo's CI status (currently none exists at all for this repo).
