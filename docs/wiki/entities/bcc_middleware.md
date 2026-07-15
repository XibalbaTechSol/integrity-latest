---
title: bcc_middleware
created: 2026-07-07
updated: 2026-07-14
type: entity
tags: [infrastructure, compliance, cryptography, metrics]
confidence: high
source_files:
  - bcc_middleware/app/main.py
  - bcc_middleware/app/canonical.py
  - bcc_middleware/app/baa.py
  - bcc_middleware/app/chain.py
  - bcc_middleware/app/merkle.py
  - bcc_middleware/app/reputation.py
  - bcc_middleware/app/scoring_loop.py
  - bcc_middleware/app/config.py
  - bcc_middleware/policies/bcc.rego
---

The pre-execution policy gate (FastAPI + OPA). An agent signs a
[BCC commitment](../concepts/bcc.md) to what it's about to do and POSTs it to
`POST /v1/bcc/intercept`; this service decides allow/deny before the agent acts.
It also runs a second, independent responsibility: a periodic background loop
that pushes each agent's oracle-computed [AIS](../concepts/ais.md) on-chain and
raises slashing disputes (see "Reconciled this cycle" below) — the only place
in the monorepo that closes that loop.

## Pipeline

Schema validation → circuit breaker → **signature verification** → nonce-replay
check → freshness window → **OPA policy** (now including a
[verification-tier gate](../concepts/identity-ceiling.md)) → **on-chain BAA
check** (if OPA flags `requires_baa`) → admit to
[Merkle batch](../concepts/merkle-batching.md) + best-effort anchor.

**Fail-closed vs. best-effort** is the one property to get right: OPA and BAA are
*authorization* decisions and fail closed (any inability to positively confirm =
deny); anchoring happens after authorization and is best-effort. The circuit
breaker only counts violations attributable to the agent — an OPA/RPC outage
denies but never trips the breaker (else one outage locks out the whole fleet).
The reputation-sync loop below follows the same best-effort posture for score
pushes (a stale on-chain score, not a wrongly-trusted one) but the opposite for
disputes — see below.

## Reconciled this cycle (2026-07-14)

- **Reputation-sync & slashing loop, new.** `app/reputation.py` +
  `app/scoring_loop.py` add a background asyncio task (started at FastAPI
  `lifespan` startup, `SCORE_SYNC_INTERVAL_SECONDS`, default 300s; also
  triggerable on-demand via `POST /v1/reputation/sync`) that lists every agent
  the oracle knows about and, per agent: (1) recomputes the **pre-boost**
  weighted AIS from `GET /v1/agent/{id}/ais`'s `components`/`weights` and
  signs+submits a real `ReputationRegistry.updateScore(agent, baseScore)`;
  (2) if the oracle's flagged-telemetry ratio for that agent crosses
  `DISPUTE_FLAGGED_RATIO_THRESHOLD` over a lookback window, signs+submits a
  real `Slasher.raiseDispute(agent, amount, reason)` locking
  `DISPUTE_STAKE_BPS` of the agent's available stake (subject to a per-agent
  `DISPUTE_COOLDOWN_SECONDS`). `integrity-oracle` itself stays strictly
  read-only (see its own `chain.rs` docstring) — this is what makes
  `bcc_middleware` the load-bearing signer for this role rather than a
  decorative one. Reuses `ANCHOR_SIGNER_PRIVATE_KEY` as the
  `REPUTATION_SIGNER_PRIVATE_KEY` fallback, a deliberate tradeoff on today's
  single-operator testnet deployment where oracle-signer/disputer/anchor-signer
  are already the same key (see `PRODUCTION_GAPS.md` §1 and
  [Interface Contract §7a](../../INTERFACE_CONTRACT.md#7a-reputation-sync--slashing-signer-bcc_middlewareappreputationpy-scoring_looppy)).
  Automated dispute-raising is safe to run unattended because raising only
  *locks* stake — a separate arbiter role and challenge window (see
  `Slasher.sol`'s NatSpec) is required to actually resolve/burn anything.

```mermaid
sequenceDiagram
    participant Loop as scoring_loop (periodic, 300s)
    participant Oracle as integrity-oracle
    participant RR as agent's ReputationRegistry
    participant Slasher as agent's Slasher

    Loop->>Oracle: GET /v1/agents
    loop each agent
        Loop->>Oracle: GET /v1/agent/{id}/ais
        Loop->>RR: updateScore(agent, preBoostBaseScore)
        Loop->>Oracle: GET /v1/agent/{id}/telemetry/volume
        alt flagged ratio over threshold and cooldown elapsed
            Loop->>Slasher: raiseDispute(agent, amount, reason)
            Note right of Slasher: only LOCKS stake —<br/>a separate arbiter resolves/burns
        end
    end
```
- **Interface-contract §4.2 schema doc caught up to reality.** `agent_public_key`
  (required) and `covered_entity_address` (optional) have been real, signed,
  load-bearing fields in `app/schemas.py`/`app/canonical.py` since the previous
  cycle's signature-scheme/BAA reconciliation (below) — but
  `docs/INTERFACE_CONTRACT.md`'s own §4.2 JSON example never caught up and
  still showed the original 6-field shape. Fixed in the same pass as this
  entry; see [BCC](../concepts/bcc.md), which already had the correct shape.
- **Two stale artifacts found and fixed while verifying the above:**
  `.env.example`'s `BAA_CONTRACT_NAME=SmartBAA` (must be `SmartBAAFactory` —
  the per-pair `SmartBAA` escrow instances don't implement `isBAAActive`;
  the actual `app/config.py` default was already correct, only the example
  file was wrong) and `app/canonical.py`'s module docstring (still described
  the pubkey/fingerprint binding as an open "INTEGRATION FLAG" guess, now
  updated to state its actual ✅ RECONCILED status).

## Reconciled 2026-07-11

- **Verification-tier gate, real for the first time.** `input.verification_tier`
  (resolved by `app/chain.py::resolve_verification_tier` from the oracle's
  `GET /v1/agent/{id}`, fails closed to tier 0 on any lookup failure — see that
  function's docstring for why this differs from `agent_id_to_address`'s
  hard-fail) now feeds `bcc.rego`'s new `min_tier_by_intent_type` rule. This
  closes the gap [identity-ceiling.md](../concepts/identity-ceiling.md) used to
  describe as "0% enforced" — it's now enforced for the clinical intent-type
  set, as defense-in-depth on top of (not a replacement for) the existing
  allowlist. See that page for why thresholds are capped at 1 until Tier 2/3
  verification is real.
- **`verification_tier` is no longer client-asserted.** `integrity-oracle`'s
  `register_agent` handler previously stored whatever tier value the client
  sent — a real hole, since nothing stopped a client from self-asserting
  `verification_tier: 3`. It now always computes `SERVER_VERIFIED_TIER` (=1)
  itself; the client-supplied field is accepted on the wire but ignored. This
  is what makes the gate above meaningful rather than trivially bypassable.

## Reconciled previous cycle

- **Signature scheme:** the commitment carries a signed `agent_public_key`
  (multibase), bound by `sha256(pubkey) == did_fingerprint` before the Ed25519
  check — because the DID fingerprint is `sha256(pubkey)`, not the raw key.
  Canonical JSON uses `ensure_ascii=True`, matching the SDK/CLI byte-for-byte.
- **BAA check:** the real two-arg
  `SmartBAAFactory.isBAAActive(coveredEntity, businessAssociate)`; the hospital
  comes from the commitment's signed `covered_entity_address`.
- **OPA clinical allowlist:** now data-driven — static demo set UNION
  `data.clinical_allowlist.agents`, so a real-DID agent is authorized by a loaded
  data document, no policy edit.

## State

**75 pytest + 28 OPA tests.** Real coverage: a fail-closed test points at a dead
OPA port; `test_baa_shield_integration.py` deploys the real
[Shield contracts](../concepts/compliance-gate.md) on a local anvil and exercises
the real two-arg BAA call; `test_reputation.py`/`test_scoring_loop.py` cover the
reputation-sync loop above, including real `updateScore`/`raiseDispute`
transactions against `MockReputationRegistry.sol`/`MockSlasher.sol` fixtures.

## Resolved gap (found stale during `integrity-mvp/demo` work, 2026-07-09)

This page previously said `app/chain.py::agent_id_to_address` derives the
agent's EVM address with a placeholder `keccak256(pubkey)[-20:]`. Re-read
against current source while building `integrity-mvp/demo` (2026-07-09): this
is no longer true — `agent_id_to_address` now resolves the real
`SovereignAgent` contract address via `resolve_agent_primitives(oracle_url,
agent_id)` (an oracle lookup), matching what `EHRGate.checkAccess`/
`ComplianceGate` actually treat as `msg.sender`. Not independently re-verified
end-to-end against a live current-schema oracle this session (see
[integrity-mvp](integrity-mvp.md)'s demo section: no such oracle instance was
running), but the placeholder code path itself is confirmed gone from source.

Related: [BCC](../concepts/bcc.md),
[ComplianceGate](../concepts/compliance-gate.md),
[Merkle batching](../concepts/merkle-batching.md).
