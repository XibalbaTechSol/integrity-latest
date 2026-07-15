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

### 1a. AIS input-signal trust (server-side re-derivation)
*Current State:* `POST /v1/telemetry/ingest` used to store the client's self-reported
`derived_signals` (entropy/grounding/sacrifice/compliance) verbatim as the actual AIS
inputs — a signature proved *who* sent them, never *whether they were honest*. The
oracle now independently recomputes entropy/grounding/sacrifice server-side from the
raw `otel_spans` content already inside the same signed request (`backend/src/derive.rs`,
mirroring `integrity_sdk/telemetry/derive.py`'s algorithms and `crate::phi`'s
defense-in-depth posture), and does the on-chain "compliance gate wins" check itself
rather than trusting an SDK-side opt-in. Verified end-to-end
(`oracle_e2e_recomputed_grounding_overrides_inflated_client_claim`): a client claiming
an inflated grounding score while its own signed `otel_spans` contain hallucination
markers gets the oracle's low, real recomputation stored and scored, not its claim.
Two pre-existing scoring-formula bugs, found while making this change, were fixed in
the same pass: `performance_variance`'s polarity was inverted relative to what
`calculate_entropy_score` expects (stable claims scored *worse*), and `gpu_hours_verified`
was double-log-compressed (SDK pre-normalized to `[0,1]`, then `scoring-core` log-compressed
again) — both fixed at the `derive.rs` call site, no `scoring-core` changes needed.

**Still open, deliberately out of scope for this pass:**
* **ZK-boost binding is looser than the name implies.** `db::aggregate_for_ais` computes
  `zk_verified_this_period` as `BOOL_OR(zk_verified)` over the whole reporting window — a
  single ZK-proof-bearing submission flips the boost boolean for the *entire period's
  average*, not just the specific event the proof was submitted with.
  `ingest_telemetry` never decodes/cross-checks the proof's `public_inputs` against the
  specific submission's `nonce`/`derived_signals` either. Tightening this to a genuine
  per-event binding needs a circuit/on-chain change (the real ZK circuit,
  `integrity-zkp/src/main.nr`, proves identity+intent-commitment binding only — it has no
  numeric/behavioral inputs today, so it doesn't attest to entropy/grounding/sacrifice
  claims at all).
* **TEE/Tier-3 attestation is unwired.** `integrity_sdk/security/attestation.py`'s Nitro
  attestation *verifier* is real, tested against a real captured AWS fixture, and
  correctly pins the root CA — but nothing in the codebase calls it. No oracle endpoint
  resolves an agent to Tier 3 ("Institutional," AIS ceiling 1000 per the README's
  verification ladder) via a real attestation check.
  `NitroAttestationGenerator.get_attestation_document` is an honest
  `NotImplementedError` (no enclave hardware available), not a mock.
* **`covered_entity_address` spoofing.** The oracle's on-chain compliance check trusts
  whatever `covered_entity_address` a client supplies in `otel_spans[].metadata` — an
  agent could name a genuinely-compliant third party's address to earn the on-chain-wins
  ceiling without being that entity's agent. Identical, pre-existing behavior to the
  SDK's own caller-supplied `covered_entity_address` kwarg (`derive.py`) — not a new gap
  introduced here.
* **Oracle-to-chain score push — CLOSED.** `bcc_middleware/app/reputation.py` +
  `app/scoring_loop.py` now periodically (`SCORE_SYNC_INTERVAL_SECONDS`, default 300s)
  list every agent the oracle knows about, recompute each one's pre-boost weighted AIS
  from `GET /v1/agent/{id}/ais`'s `components`/`weights` (deliberately not
  `ais / zk_boost`, to avoid float round-trip error), and sign+submit a real
  `ReputationRegistry.updateScore(agent, baseScore)` transaction per agent. Also raises
  a real `Slasher.raiseDispute` when an agent's oracle-computed flagged-telemetry ratio
  (`GET /v1/agent/{id}/telemetry/volume`) crosses `DISPUTE_FLAGGED_RATIO_THRESHOLD`
  (default 50%) over a minimum sample size (`DISPUTE_MIN_EVENTS`), locking
  `DISPUTE_STAKE_BPS` (default 10%) of the agent's currently-available stake, subject to
  a per-agent cooldown (`DISPUTE_COOLDOWN_SECONDS`) so one ongoing misbehavior pattern
  doesn't spam duplicate disputes. `POST /v1/reputation/sync` triggers one cycle
  on-demand for ops/tests. 21 real tests (12 against a real anvil chain via
  `MockReputationRegistry`/`MockSlasher` fixtures, 9 orchestration tests with the oracle
  HTTP boundary mocked) in `bcc_middleware/tests/test_reputation.py` and
  `test_scoring_loop.py`.

  Deliberately reuses `bcc_middleware`'s existing `ANCHOR_SIGNER_PRIVATE_KEY` /
  `ANCHOR_ROLE` signer (via a `REPUTATION_SIGNER_PRIVATE_KEY` override that falls back to
  it) rather than standing up a new dedicated oracle-signer service — an explicit,
  user-made tradeoff: less new infrastructure and no new key to custody, at the cost of
  coupling `bcc_middleware`'s pre-execution policy-gate trust domain to score-settlement
  and dispute-raising. `integrity-oracle` itself remains deliberately read-only
  (`chain.rs`'s own invariant is untouched).

  Residual gaps, explicitly out of scope for this pass:
  - **Single signer, still.** On today's single-operator testnet deployment
    (`deployments.baseSepolia.json`), `ANCHOR_SIGNER_PRIVATE_KEY` and the on-chain
    `oracleSigner`/`disputer` roles are the same address, so this "just works" without
    any new role grant. Production key-separation (a distinct `ORACLE_ROLE` /
    `DISPUTER_ROLE` key from the anchor signer) is not built — `REPUTATION_SIGNER_PRIVATE_KEY`
    exists as the seam for that, but nothing forces its use.
  - **Dispute signal is a flagged-ratio heuristic, not a BCC-commitment-vs-on-chain-action
    comparator.** `raiseDispute` fires off the oracle's already-real per-event `flagged`
    boolean (see the entropy/grounding/sacrifice/compliance re-derivation above), not a
    dedicated "does this agent's signed BCC commitment match what it actually did
    on-chain" check — that comparator still doesn't exist anywhere in the monorepo.
  - **No idempotency/backoff tuning beyond the fixed interval + cooldown.** A crashed
    or slow score-push cycle simply retries on the next `SCORE_SYNC_INTERVAL_SECONDS`
    tick; there's no exponential backoff or per-agent staggering, so a large agent
    population could see one slow cycle delay everyone's next update.
  - **Merkle anchoring is still batch-size-triggered only** (see `bcc_middleware/app/anchor.py`),
    not on the same periodic loop this section adds — a low-traffic agent's anchoring can
    still lag independently of its now-working score sync.

## 2. Oracle (`integrity-oracle/backend`) — findings from a full-package audit, ALL CLOSED

*Current State:* the audit below covers `routes.rs`/`handlers.rs`/`derive.rs`/`chain.rs`/`otlp.rs`/`db.rs` end-to-end. Every finding from this pass has been fixed and verified against real infra (9 e2e tests, up from 6, all passing against real Postgres/Redis/anvil/SDK; 72 backend + 8 scoring-core unit tests; `cargo clippy` clean).

* **CLOSED — compliance/`flagged` polarity was inverted, live, for every agent.**
  `handlers.rs`'s `ingest_telemetry` computed `flagged = compliance > 0.5` against a
  high-is-good `compliance` value (from `oracle_compliance()`, matching
  `derive::self_reported_compliance`'s `1.0 - flagged_ratio` and the on-chain branch's
  `Ok(false) => 0.0`) — inverted for every agent: a clean batch scored `flagged = true`
  (penalized), an all-violation batch scored `flagged = false` (not penalized). Fixed to
  `compliance < 0.5`. Regression test `oracle_e2e_compliance_flagged_polarity_is_correct`
  submits both a clean and an all-violation batch over real HTTP and asserts polarity via
  both the ingest response and the `GET /v1/agent/{id}/telemetry` read-back — verified to
  actually catch the bug (fails on the pre-fix comparator, passes on the fix).
* **CLOSED — `GET /v1/leaderboard` had no cache.** Now backed by `leaderboard_cache`/
  `leaderboard_sync` (migration `0005_leaderboard_cache.sql`), mirroring
  `markets_cache`/`markets_index_sync`'s exact staleness-cache pattern
  (`MARKETS_CACHE_STALENESS_SECS`, reused). `refresh_leaderboard_if_stale` re-enumerates
  `agents` and refreshes every row only when the last full sync is >30s old; reads are
  served from cache and sorted numerically via `U256` comparison (not lexicographic
  string sort, which would have put "9" above "10").
* **CLOSED — OTLP gRPC receiver had no rate limiting.** `otlp.rs` now runs the same
  fixed-window Redis limiter shape as `POST /v1/telemetry/ingest`
  (`check_otlp_rate_limit`, distinct `ratelimit:otlp:*` key namespace, same configured
  `telemetry_rate_limit_per_minute`), checked once per resource-spans group before any
  PHI scan or Postgres write. Verified end-to-end
  (`oracle_e2e_otlp_rate_limit_rejects_excess_spans`): the real SDK exporter's third
  export within a tiny-overridden window gets a real `RESOURCE_EXHAUSTED` gRPC status,
  and only the within-limit spans land in `otel_spans`.
* **Documented, not removed — Merkle-anchoring dead code.** `db::fetch_pending_leaves`/
  `create_merkle_root_and_assign` (`db.rs`) are confirmed to have zero callers anywhere;
  real anchoring happens entirely through `bcc_middleware/app/anchor.py`'s independent
  per-agent batching, an incompatible single-global-root vs. per-agent-sub-root design.
  Left in place (real, tested in isolation) rather than deleted, since deleting would
  also mean dropping the `merkle_root_id`/`leaf_index` fields `GET /v1/agent/{id}/telemetry`
  already exposes (now doc-commented as "always null today" at both the DB and DTO
  layers) — kept as the oracle-side alternative if a future design ever needs the oracle
  itself, not bcc_middleware, to anchor a cross-agent root.
* **CLOSED — nonce-replay (409) and rate-limit (429) test coverage.** Three new e2e
  tests: `oracle_e2e_telemetry_nonce_replay_returns_409` (same nonce twice → second
  submission 409s, event count stays at 1), `oracle_e2e_telemetry_rate_limit_returns_429`
  (tiny rate-limit override, third submission in-window 429s), and the OTLP rate-limit
  test above. `GET /v1/agents`/`GET /v1/agent/{id}`/history endpoints/single-market
  detail remain untested by e2e — smaller, lower-risk gap, not addressed this pass.

## 3. Python SDK & CLI (`integrity-sdk`, `integrity-cli`)

*Current State:* `integrity-cli` does not import `integrity-sdk` — independent
reimplementations kept in sync by cross-package tests, not shared code. Findings below
are from a full-package audit (SDK + CLI test suites passing).

* **Confirmed, unfixed — CLI mints testnet ITK to the agent's wallet, not its
  SovereignAgent contract.** `integrity-cli/integrity_cli/main.py:328-331` calls
  `chain.mint_testnet_itk(..., evm_account.address, ...)` *before*
  `deploy_sovereign_agent` even runs, whereas `integrity-sdk/integrity_sdk/registration.py`
  was fixed this session to mint to the SovereignAgent *contract* address (required
  because `IntegrityMarket`/`A2ACapitalPool` pull ITK from `msg.sender`, which is the
  SovereignAgent contract when routed through `execute`). CLI-registered agents end up
  with testnet ITK stranded on an address they can't spend through market/capital-pool
  calls. **Fix:** reorder CLI's registration steps to match the SDK's.
* **Confirmed, unfixed — registration has no idempotency, in BOTH the SDK and the CLI
  independently.** `integrity_sdk/registration.py`'s `register_agent()` and
  `integrity-cli/integrity_cli/chain.py`'s equivalent both always deploy a *fresh*
  `SovereignAgent`/`StateAnchor` pair rather than checking for an existing registration
  first — a retry after partial failure (or against an already-registered DID) orphans a
  contract pair and burns gas/ITK before reverting with `AlreadyRegistered`. Two separate
  fixes needed (SDK and CLI don't share code).
* **`EHRGate` ABI missing from `scripts/sync_abis.py` and `integrity-sdk/integrity_sdk/abis/`
  — zero Python wrapper functions exist anywhere in the SDK for `CoveredEntityRegistry`,
  `SmartBAAFactory`, `ComplianceGate`, or `EHRGate` calls.** Only the low-level generic
  `chain._contract()` helper exists to build on. Blocks the Shield/healthcare persona of
  any future demo work.
* **Telemetry client nonce handling stalls permanently after a process restart.**
  `integrity_sdk/integrity_sdk/client.py:69` hardcodes `self._nonce = 0`, never seeded
  from the oracle's persisted `last_nonce` (exposed at `GET /v1/agent/{id}`). Any restart
  after even one successful flush causes every subsequent flush to replay the same stale
  nonce, get a 409, and roll back again — forever. **Fix:** seed `_nonce` from the oracle
  at construction, and stop treating a 409 (proof the prior nonce *was* consumed) as a
  reason to roll back.
* **`security/attestation.py` claims test coverage that doesn't exist.** Its own docstring
  cites `test_attestation.py` as covering the Nitro attestation verifier against a real
  captured fixture (`tests/fixtures/aws_nitro_document.cbor`, which IS present and real) —
  but that test file doesn't exist anywhere in the tree, and the verifier has zero test
  references. This misrepresents security-critical code (root-CA pinning, cert-chain walk,
  COSE signature verification) as tested when it isn't — a direct instance of the repo's
  own "no silent mocks" rule being violated by omission. **Fix:** write the test against
  the existing fixture; both are ready for it.
* **Wallet keystore write path is an unguarded, non-atomic, check-then-act race —
  duplicated in both packages.** `integrity_sdk/wallet.py` and `integrity_cli/wallet.py`
  both do `.exists()` → generate → `write_text()` with no lock, no atomic rename, and no
  typed error for a corrupted file (raises a raw `JSONDecodeError`) or a wrong password
  (raises a raw `ValueError`, and the existing test asserts on that raw type rather than
  flagging it as wrong). Two concurrent bootstrap calls for the same `agent_id` can each
  generate a different keypair and race on which one gets persisted, silently orphaning
  whichever account the losing caller kept in memory. **Fix:** atomic create (`O_EXCL` or
  a lock) + write-to-temp-then-rename + typed exceptions, in both packages.

## 4. Smart Contracts (`contracts/src`) — findings from a full-package audit, ALL CLOSED

*Current State:* 172 Foundry tests passing (up from 165), 66%+ line coverage. Web3 wallet
connectivity and real on-chain writes from the frontend already exist (see §7) — the
prior version of this section's "zero Web3 connectivity" claim was stale and has been
removed. Every finding below is fixed and covered by a new regression test.

* **CLOSED — `SmartBAAFactory.createBAA` permanently blocked re-forming a BAA after
  termination.** `baaOf[coveredEntity][businessAssociate]` was set once and never
  cleared — neither `SmartBAA.revoke()` nor a slashing `arbitrate(true)` cleared it, so
  `createBAA` reverted `BAAAlreadyExists` forever after the first termination, with no
  renewal path (BAAs are routinely renewed in practice). Fixed: `createBAA` now allows
  re-formation once the existing BAA's `status()` reaches `Terminated`, while still
  blocking a duplicate while `Proposed`/`Active`/`Disputed`. Three new tests
  (`test_canReformBAAAfterRevoke`, `test_canReformBAAAfterSlash`,
  `test_cannotReformBAAWhileDisputed`) in `test/shield/SmartBAA.t.sol`.
* **CLOSED — `IntegrityMarket.resolve()` to a zero-stake outcome permanently locked the
  whole pool.** No check that `outcomeStaked[_winningOutcome] > 0`; an honest resolver
  reporting a genuinely zero-stake true outcome made every position hit `LosingPosition`
  with `totalStaked` unclaimable by anyone, forever. Fixed: `claimPayout` now handles the
  "push" case — when `winningPool == 0`, every position holder is refunded exactly their
  own original stake instead of a pari-mutuel share, draining the pool completely with no
  shortfall. New test `test_resolveToZeroStakeOutcome_refundsEveryoneTheirOwnStake` in
  `test/markets/IntegrityMarket.t.sol`.
* **CLOSED — `A2ACapitalPool.flagBreach` had no status guard, contradicting its own
  NatSpec.** NatSpec said it's for a *Released* allocation, but the code never checked
  `a.status` — calling it on a still-`Escrowed` or already-`ClawedBack` allocation
  (wrong id, stale data) set `Breached` with funds still inside and no path back to
  `Escrowed`. Fixed: requires `status == Released`, reverting `NotReleased()` otherwise.
  Two new tests (`test_flagBreach_revertsOnStillEscrowedAllocation`,
  `test_flagBreach_revertsOnClawedBackAllocation`) in `test/markets/A2ACapitalPool.t.sol`.
* **CLOSED — `EHRGate` (the actual PHI-access enforcement contract) was never deployed
  anywhere.** Not in `Deploy.s.sol`, `DeployMarkets.s.sol`, or
  `deployments.baseSepolia.json`, despite being real, fully tested in isolation, and
  explicitly relied on by `ComplianceGate`'s own NatSpec. Fixed: `Deploy.s.sol` now
  deploys `EHRGate` as part of genesis (verified end-to-end against local anvil — logs,
  deploys, and writes the address into `deployments.local.json` correctly). A new
  incremental script, `script/DeployEHRGate.s.sol` (mirrors `DeployMarkets.s.sol`'s
  established "add one singleton to an already-live deployment without re-running
  genesis" pattern), adds it to Base Sepolia's existing deployment without touching any
  other singleton — verified end-to-end against local anvil simulating the live file's
  exact current shape (including the missing-`XibalbaNameService` case below, handled via
  a `keyExistsJson` guard rather than reverting). **Not yet run against live Base
  Sepolia** — that's a real, gas-costing, operator-triggered action
  (`forge script script/DeployEHRGate.s.sol --rpc-url base_sepolia --broadcast --verify`
  with `FUNDER_PRIVATE_KEY` set) deliberately left for the account holder to run.
* **Still open — `deployments.baseSepolia.json` is missing `XibalbaNameService`.**
  Confirmed via a live read of the checked-in file: no such key exists. `DeployEHRGate.s.sol`
  above is written to tolerate this (skips re-writing that key rather than reverting) but
  does not fix it — recovering the real deployed XNS address (if one exists) or deploying
  a fresh one is a separate, live-network decision out of scope for this pass.
* **CLOSED — `CCIPReputationBridge.bridgeReputation` had no refund for overpaid native
  fee.** `msg.value - fee` was permanently trapped (no `receive()`/`withdraw()`/sweep
  anywhere). Fixed: the excess is now refunded to `msg.sender` via a low-level call
  immediately after `ccipSend`, with the function now `nonReentrant` (added
  `ReentrancyGuard`) since that refund is a call to an attacker-controlled address, unlike
  the trusted, fixed-address router call preceding it. New test
  `test_bridgeReputation_refundsExcessNativeFee` in `test/CCIPReputationBridge.t.sol`.

## 5. BCC Middleware (`bcc_middleware`) — findings from a full-package audit

*Current State:* 75 pytest + 28 OPA tests passing. `app/reputation.py`/`scoring_loop.py`
(the new score-push/dispute signer, see §1a) are real and tested. Findings below are
beyond that work.

* **The intercept hot path blocks the single asyncio event loop on synchronous chain/
  oracle I/O — systemic, not just anchoring.** `run_intercept` (`main.py`) is `async def`,
  but `resolve_verification_tier` (plain sync `httpx.get`, fired on every single request),
  `check_baa_status` (sync web3.py calls), and `_flush_and_anchor` (`w3.eth.wait_for_
  transaction_receipt(..., timeout=30)`, up to 30s blocking) all run directly on the loop,
  unlike `_score_sync_loop`, which correctly uses `asyncio.to_thread`. Under real
  concurrency this head-of-line-blocks every other agent's request (and `/health`) behind
  whichever one is waiting on an oracle round-trip or an anchor tx receipt — directly
  contradicting this service's own stated design goal of being a low-latency pre-execution
  gate. **Fix:** wrap those three calls in `asyncio.to_thread`, same as the scoring loop.
* **`verification_token` proves nothing and is checked by nobody.** `main.py:210-212`'s
  token is an unsigned, unpersisted SHA-256 hash — `schemas.py` documents it as "proving
  this middleware evaluated and approved the commitment," but there's no signature or
  lookup table any relying party could verify it against. Every consumer found just
  displays/threads it through. **Fix:** HMAC over a persisted record, or drop the claim
  from the docs.
* **Cross-thread signer nonce race between anchoring and reputation sync.** Since
  `REPUTATION_SIGNER_PRIVATE_KEY` falls back to the same key as anchoring (documented,
  §1a), `_flush_and_anchor` (running synchronously inside a request-handler thread) and
  `_score_sync_loop`'s chain writes (running via `asyncio.to_thread` every
  `SCORE_SYNC_INTERVAL_SECONDS`) can both independently call `get_transaction_count` with
  no shared nonce manager or lock — an overlapping anchor-flush and scoring-cycle can race
  into a "nonce too low" failure for one of the two. **Fix:** a shared nonce-managing
  signer (or lock) whenever `anchor.py` and `reputation.py` share a key.
* **`POST /v1/bcc/anchor/flush`'s returned `root` doesn't match what's actually anchored.**
  `MerkleBatcher.flush()`'s full-batch root is computed then discarded in favor of
  per-agent sub-roots (the real, per-agent anchoring path) — but the endpoint still
  returns the discarded full-batch root, which matches nothing on-chain. **Fix:** return
  the per-agent sub-roots that were actually anchored, or drop the field.
* **Score pushes are unconditional every cycle, even when unchanged** — real gas cost
  every `SCORE_SYNC_INTERVAL_SECONDS` per agent forever, even idle ones. **Fix:** cache
  the last-pushed score per agent and skip the tx if unchanged.
* **Gap - Active Quarantine Enforcement (confirmed still open).** Nothing reads back
  on-chain slash/dispute state to affect a future `run_intercept` decision — OPA
  evaluation and the circuit breaker are still driven purely by this service's own request
  history. `scoring_loop.py` can now *raise* a dispute but nothing closes the loop back
  into policy enforcement.
* **Merkle anchoring is still batch-size-triggered only (confirmed, see §1a)** — no
  periodic equivalent to the score-sync loop exists for it yet.
* **In-memory `nonce_store`/`circuit_breaker` are safe today but block horizontal
  scale-out.** Verified `docker-compose.yml`: single instance, no `deploy.replicas` — so
  this is a real gap only the moment this service is ever scaled to >1 replica (an
  attacker could replay a commitment or reset a lockout by hitting a different replica).
  Needs Redis-backed state before that happens, not urgent today.

## 6. `integrity-userapi` (user accounts, strictly non-chain)

*New section — this package wasn't previously covered here.*

* **Developer API keys and `ais_trust_ceiling` are entirely unwired — a dead feature
  end-to-end.** The service issues/lists/revokes `uak_...` keys with a stamped
  `ais_trust_ceiling`, and the frontend surfaces them (`SettingsPage.tsx`), but nothing
  anywhere in the monorepo (oracle, bcc_middleware, SDK, CLI) ever authenticates a request
  using a raw API key — `get_current_user_id` only ever decodes a JWT. Self-documented in
  the package's own test docstring but absent from this gap doc until now.
* **JWTs have no revocation path.** 24h HS256 tokens, no blocklist/`jti` tracking/logout/
  refresh flow anywhere. A leaked bearer token — the only credential capable of managing
  API keys or account data — stays valid up to 24h with no way to kill it early, unlike
  API keys' explicit `revoked_at`.
* **No login rate-limiting.** `POST /auth/login` has no lockout/throttle on repeated
  failed attempts, unlike `bcc_middleware`'s circuit breaker for agent misbehavior.
* **`demo_runs` remains a dead-end bookkeeping table.** `POST /demo/run` inserts
  `status='pending'` and nothing ever transitions it. `integrity-mvp/demo/` now exists on
  disk (a real scaffold has appeared there this session, likely from concurrent work) but
  doesn't call this service at all — the bridge between "a demo run was requested" and
  "a demo run actually happened" is still fully undesigned.

## 7. Frontend (`integrity-mvp`) — findings from a full-package audit

*Current State:* real backend wiring landed this session for `ChainOfThoughtPage`,
`SdkTelemetryPage`, `IntelligencePage`, and the dashboard's `throughput`/`events` widgets.
`AgentContext.tsx` is confirmed real (calls `oracle.listAgents()`) — this doc previously,
incorrectly, listed it as mock; that was stale. Two real on-chain write paths already
exist via wagmi (`ShieldPage.tsx`'s BAA sign/revoke, `ExchangePage.tsx`'s market entry) —
the prior "zero Web3 connectivity" claim in this doc was also stale and has been removed.

* **`npm run test` currently fails.** `vitest.config.ts`'s exclude list doesn't cover
  `demo/`, so Vitest picks up a `node:test`-based file inside `integrity-mvp/demo/` and
  fails to bundle it — red CI/local runs even though the app's own tests pass. **Fix:**
  add `'demo/**'` to the exclude array. One line.
* **Undefined CSS custom properties beyond the `--primary`/`--gold` pair fixed this
  session — same bug class, wider blast radius, not yet fixed.** `--bg-surface` (12
  files, including the chrome wrapping every dashboard widget), `--border` (5 files,
  visually confirmed near-invisible on `IdentityPage`), `--space-6` (9 files, collapses
  intended spacing to zero), plus a genuinely broken `hsla(var(--accent-primary) / 0.5)`
  in `.glass-panel-hover:hover` (`--accent-primary` is a hex string, not an HSL triplet —
  the whole declaration is dropped, silently killing hover states on 10 files' worth of
  elements), and `--accent-primary-hsl` used with no fallback in 3 files (wallet-connect
  pill border, sidebar logo glow). **Fix:** same pattern as the already-applied fix — add
  the missing tokens to `:root`, aliasing to existing semantic equivalents where one
  exists (`--border` → `--border-color`, etc).
* **`AuditPage.tsx` makes a specific, false security claim with no mock-data
  disclosure — the most serious frontend finding.** Its copy asserts actions are
  "cryptographically hashed and anchored to Base L2" and "cannot be tampered with by the
  agent, host, or hypervisor." The data backing it (`LoggerContext.tsx`'s `INITIAL_LOGS`,
  including a fabricated tx hash) is 3 hardcoded entries plus client-side session state —
  nothing is hashed, nothing is anchored. Unlike every other mock surface in the app, this
  one carries no `SeededDataBadge`. **Fix:** either badge it honestly or wire real logging
  before this page ships to a real user.
* **`ShieldPage.tsx`'s consent/slash actions are theater, not disclosed stubs.**
  `handleSlashViolation` shows a native `alert()` claiming "Locked ITK Stake Slashed" with
  **no contract call at all**, despite `Slasher.sol` existing on-chain and this same page
  proving the real wagmi-write pattern works elsewhere (`handleSignBaa`). A user clicking
  "Slash Stake" is told collateral was slashed; nothing happened. **Fix:** wire to a real
  `Slasher` call, or disable+badge like the page's own "Create BAA" button already does.
* **Several pages have mock data with a real backend endpoint already proven working
  elsewhere, just not wired to this page:** `CompareTracesPage.tsx` (100% hardcoded
  despite `oracle.getTraceTree()` already working in `ChainOfThoughtPage`),
  `ActuarialHub.tsx` (could use real `oracle.listMarkets()`, already used by
  `ExchangePage`), radar widgets in `WidgetRegistry.tsx`/`IntelligencePage.tsx` (ignore
  real `AisComponents` already fetched elsewhere), `ShieldPage.tsx`'s "Stability
  Certification" tab (hardcoded despite sibling tabs on the same page proving the live
  pattern).
* **Several buttons have no handler at all, undisclosed:** `IdentityPage.tsx`'s
  "Rotate Keys"/"Request Credential"/"Regenerate Attestation Document"/"Stake ITK"/
  "Withdraw"/"Launch XNS Explorer", `FinancePage.tsx`'s Receive/Send/Swap/Buy/View
  Explorer/New Allowance Rule.
* **`DocumentsPage.tsx`** is fully fabricated with no backing capability anywhere
  (`oracle.ts`/`userapi.ts` have no document/RAG-indexing endpoint) and no disclosure
  badge — genuinely no capability yet, unlike the honestly-badged Tier-4 mocks elsewhere
  in the app.

## 8. CI / Autonomous Fix-Forward (`.github/workflows/ci.yml`)
*Current State:* A real CI workflow now runs every package's test suite (mirroring the root `Makefile`'s `test` target) as separate per-package jobs on push/PR to `main`. The `notify-jules-on-failure` job makes a real call to the Jules API (`POST https://jules.googleapis.com/v1alpha/sessions`, `X-Goog-Api-Key` auth, `AUTOMATION_MODE_AUTO_CREATE_PR`) — verified against `@google/jules-sdk`'s actual published source, not guessed.
* **Gap - One-time repo-owner authorization still required:** the workflow will fail loudly (not silently no-op) until (1) Jules is authorized for `XibalbaTechSol/integrity-latest` at jules.google.com (grants its GitHub App repo access), and (2) a `JULES_API_KEY` secret (from jules.google.com/settings/api) is added under repo Settings → Secrets and variables → Actions. Both are account-holder actions no automation can complete on the owner's behalf.
