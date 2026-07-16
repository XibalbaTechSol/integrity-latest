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

## 3. Python SDK & CLI (`integrity-sdk`, `integrity-cli`) — findings from a full-package audit, ALL CLOSED

*Current State:* `integrity-cli` does not import `integrity-sdk` — independent
reimplementations kept in sync by cross-package tests, not shared code. Every finding below
was fixed AND verified by actually running the resulting test suite against real
infrastructure (real anvil for chain-touching tests, real HTTP mocks for client-only logic) —
no fix was accepted on code-review alone. SDK: 122 passed, 1 skipped. CLI: 68 passed, 1
skipped.

* **CLOSED — CLI minted testnet ITK to the agent's wallet, not its SovereignAgent contract.**
  Reordered `integrity-cli/integrity_cli/main.py`'s registration steps (funding → deploy
  SovereignAgent → deploy StateAnchor → mint ITK to the SovereignAgent *contract*, not the
  wallet → grant anchor role → register primitives), matching `integrity-sdk`'s already-fixed
  sequence. `integrity-cli/tests/test_chain.py::test_cli_chain_full_registration` now asserts
  the on-chain ITK balance lands on the contract, not the EOA.
* **CLOSED — registration had no idempotency, in both SDK and CLI.** `integrity_sdk/chain.py`
  gained `resolve_did()`, which calls the real `XibalbaAgentRegistry.resolveDID` and — a real
  bug caught while building this — had to be written to catch the contract's
  `UnknownDID()` custom-error *revert*, not treat the ABI's `view` mutability as proof it
  never reverts. `registration.py`'s `register_agent()` now short-circuits to the existing
  on-chain primitives when the DID already resolves, instead of deploying a second orphaned
  pair. Verified end-to-end: `test_register_agent_is_idempotent_for_an_already_registered_did`
  calls `register_agent()` twice for the same identity and asserts both calls return
  identical primitive addresses.
* **CLOSED — `EHRGate` ABI + Shield wrapper functions.** `scripts/sync_abis.py` now syncs
  `EHRGate`; new `integrity_sdk/shield.py` wraps `CoveredEntityRegistry`/`SmartBAAFactory`/
  `SmartBAA`/`ComplianceGate`/`EHRGate`, reusing `markets._execute_via_agent` for every
  agent-routed call. Verified against real anvil-deployed contracts in
  `tests/test_shield.py`: a full happy path (register covered entity → create BAA → agent
  signs it → self-declared compliance → patient grants EHR access → AIS pushed above
  threshold → access check passes → `verifyAndLogAccess` succeeds) plus a negative case
  proving the on-chain AIS-threshold gate is real, not decorative (access stays denied when
  the agent's score is left at the registry's zero default despite consent + an active BAA).
* **CLOSED — telemetry client nonce handling stalled permanently after a process restart.**
  `client.py`'s `flush_telemetry` now calls a new `_sync_nonce_from_oracle()` (reads
  `GET /v1/agent/{id}`'s `last_nonce`) before the first flush of a fresh client instance, and
  a 409 response re-syncs from the oracle instead of blindly rolling back (the old behavior,
  which just replayed the same already-consumed nonce forever). Verified with 4 new mocked-
  HTTP unit tests in `tests/unit/test_client.py` covering: first-flush sync, no redundant
  sync on later flushes, 409 → re-sync (not rollback), and non-409 failure → rollback (still
  correct for that case, since the oracle never saw that nonce at all).
* **CLOSED — `security/attestation.py` claimed test coverage that didn't exist.** Wrote
  `tests/test_attestation.py` against the real captured fixture
  (`tests/fixtures/aws_nitro_document.cbor`) — signature/chain/root-pin verification,
  payload field exposure, validity-period enforcement, five independent tamper-detection
  cases, and malformed-input handling. Running it for the first time surfaced two real,
  pre-existing bugs in the code under test, both fixed here:
  1. **The pinned root-CA fingerprint constant was truncated by one hex character** (63
     chars — an impossible length for a SHA-256 hexdigest, always 64) — every single call to
     `verify_nitro_attestation` unconditionally raised `AttestationError`, meaning Nitro
     attestation verification was completely non-functional in production, silently, until
     this test suite ran it for the first time. The bundled PEM itself is genuine (the real
     fixture's cert chain validates against it end-to-end once the constant is corrected).
  2. **A corrupted/tampered certificate could crash the verifier with an unhandled
     `ValueError`** rather than reporting `chain_valid = False`: `cryptography`'s ASN.1
     parsing is lazy, so a cert can load successfully yet still raise when a field like
     `.subject` is read later (exactly what an error-message-formatting f-string did). Added
     a `_safe_subject_name` helper and wrapped certificate loading in a typed
     `AttestationError`, so malformed attacker-supplied input degrades to a reported failure
     instead of an uncaught exception — this is security-critical code processing untrusted
     input, so a crash there is a real hardening gap, not just a test nuisance.
* **CLOSED — wallet keystore write path was an unguarded, non-atomic, check-then-act race,
  duplicated in both packages.** Both `integrity_sdk/wallet.py` and
  `integrity_cli/wallet.py` now write to a per-call temp file (`O_CREAT | O_EXCL`) and claim
  the final path via `os.link` (atomic, fails with `FileExistsError` instead of silently
  overwriting like `os.rename` would) — a losing concurrent caller discards its own generated
  keypair and loads the winner's instead of orphaning it. Added typed `CorruptedKeystoreError`
  / `WalletDecryptionError` in place of raw `JSONDecodeError`/`ValueError`. Verified with a
  race-simulation test in both packages (`test_concurrent_bootstrap_converges_on_one_keypair`,
  using a monkeypatched `os.open` to inject a second "concurrent" caller mid-write) proving
  both callers converge on one keypair with no leftover temp files.
* **NEW CAPABILITY — SDK telemetry integrations widened (operational metadata), plus a real
  breaking behavior change to redaction defaults.** Following a request to widen what the SDK
  captures per-call, `integrations/openai_integrity.py` and `integrations/langchain_callback.py`
  both gained real, previously-uncaptured fields the underlying provider already returns:
  `model_requested`/`model_actual`, `system_fingerprint`, `service_tier`, `tool_calls` (names
  only — `function.arguments`/tool `args` are deliberately never captured, since they can carry
  caller-supplied content that hasn't been through redaction), `conversation_length`, and a
  previously-nonexistent error path for the OpenAI wrapper (it had zero telemetry on a failed
  call before this; LangChain's `on_llm_error` already existed) that logs
  `type(exception).__name__` as a real, provider-native error taxonomy rather than a
  hand-maintained code mapping. Neither integration had any test coverage before this — both
  now do (`tests/unit/test_openai_integrity.py`, `tests/unit/test_langchain_callback.py`, 13
  new tests total, using realistic `SimpleNamespace`/real-`langchain_core`-class fixtures since
  hitting the real OpenAI/Anthropic APIs isn't feasible in a test run).
  **Real behavior change, explicitly requested and confirmed:** both integrations' `redact_phi`
  parameter now defaults to **`False`** (previously, `redact_text()` ran unconditionally on
  every prompt/completion/reasoning-trace/tool-call string in both files). Per explicit
  decision: PHI/PII redaction is now opt-in, scoped to Xibalba Shield / healthcare-vertical
  agents, who **must** pass `redact_phi=True` when constructing `IntegrityOpenAI` /
  `IntegrityLangChainCallback` — neither wrapper has any way to know an agent's
  `compliance_vertical` on its own (that's registered separately), so nothing here can safely
  auto-detect "this needs redaction." Both wrappers log a `logger.warning` naming the agent at
  construction time whenever `redact_phi` is left at its default `False`, so a misconfigured
  healthcare deployment is at least loud about it rather than silent — but there is **no
  runtime enforcement** preventing a healthcare-vertical agent from being built without
  `redact_phi=True`. This is a real, accepted residual risk from the chosen default, not an
  oversight: flagged here so it isn't lost track of, and worth a `shield.py`-level guard (e.g.
  refusing to proceed, or checking `compliance_vertical` against a resolvable registry) as a
  real follow-up rather than relying on every integrator remembering the flag.

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

## 5. BCC Middleware (`bcc_middleware`) — findings from a full-package audit, ALL CLOSED

*Current State:* 91 pytest (75 baseline + 16 new) + 28 OPA tests passing, with `uv run
pytest -q` (no env overrides) now matching that count exactly. `app/reputation.py`/
`scoring_loop.py` (the new score-push/dispute signer, see §1a) are real and tested. Every
finding below was fixed and verified against real infrastructure — real anvil for chain-writing
tests, real threading for the nonce-race and batcher-concurrency regressions, real HTTP
round-trips through the actual FastAPI app for the token fix.

*A second-pass review of these fixes (not the original audit) surfaced three follow-on
items, all closed in the same pass:*
* **`MerkleBatcher` wasn't thread-safe.** The hot-path fix below (wrapping
  `_flush_and_anchor` in `asyncio.to_thread`) made concurrent `add()`/`flush()` access
  possible for the first time — previously `run_intercept` was single-threaded end-to-end,
  so this was never reachable. `add`/`flush`/`is_full`/`reset`/`pending_count` are now
  guarded by a `threading.Lock` held for the full check-then-act sequence. A stress test
  (many concurrent adders + flushers) is included as regression coverage; note this
  specific race did NOT reproduce empirically even under aggressive
  `sys.setswitchinterval` stress testing (unlike the nonce race below, which reproduced
  reliably) — the fix is based on a direct code-level trace of the unguarded multi-op
  `batch, self._pending = self._pending, []` swap racing a concurrent `append`/second
  `flush()`, not on a captured failure. Documented here rather than silently claimed as
  "proven", per this repo's own rule.
* **`_issued_tokens` (new in the token fix below) grew unbounded** — one entry per
  authorized intercept, forever, unlike the agent-count-bounded `nonce_store`/
  `circuit_breaker`. Capped at 50,000 entries with oldest-first eviction.
* **Tests silently depended on `CHAIN_ID` being unset.** `_settings()`-style test helpers
  never passed `chain_id=` explicitly, relying on `Settings`' env-var default — which
  silently picks up the repo-root `.env`'s `CHAIN_ID=84532` (Base Sepolia) instead of the
  local anvil fixture's real `31337`, breaking 11 tests for anyone whose shell inherits
  that file. Fixed at the source: the session-scoped `anvil_chain` fixture now sets
  `os.environ["CHAIN_ID"]` to the real anvil's chain ID before any test constructs a
  `Settings()`, rather than requiring ~15 individual call sites across 5 test files to each
  remember to override it.

* **CLOSED — the intercept hot path blocked the single asyncio event loop on synchronous
  chain/oracle I/O.** `run_intercept`'s three offending calls (`resolve_verification_tier`,
  `check_baa_status`, `_flush_and_anchor`) are now wrapped in `asyncio.to_thread`, matching
  `_score_sync_loop`'s existing pattern — no I/O runs directly on the event loop anymore.
* **CLOSED — `verification_token` proved nothing and was checked by nobody.** New
  `app/verification_token.py`: the token is now HMAC-SHA256-keyed with a process-local
  secret (`Settings.bcc_verification_secret`) rather than a bare `sha256` of public fields —
  unforgeable without the secret — and persisted (in-memory, same accepted scope as
  `nonce_store.py`) so a relying party can ask `POST /v1/bcc/verify_token` whether a given
  token was genuinely issued for exactly those commitment fields. Verified: a token cannot
  be reproduced by recomputing `sha256` of the public fields (the old scheme could be, by
  construction); two independently-started `Settings()` instances get different secrets and
  reject each other's tokens; a full HTTP round trip through real `/v1/bcc/intercept` →
  `/v1/bcc/verify_token` confirms `valid: true` for a genuine token and `false` for a forged
  one.
* **CLOSED — cross-thread signer nonce race between anchoring and reputation sync.** New
  `app/nonce_lock.py`: a process-wide, per-signer-address `threading.Lock` held for the FULL
  read-nonce → sign → broadcast → mine sequence in `anchor.py::anchor_root`,
  `reputation.py::push_score`, and `reputation.py::raise_dispute`. Verified two ways: (1) with
  the lock removed, 8 concurrent `push_score` calls sharing one signer key against a real
  anvil produced 6/8 real `"nonce too low"` RPC errors, confirming this was a genuine,
  reproducible race, not a theoretical one; (2) with the lock restored, the same 8-thread test
  passes cleanly every time, on-chain state confirmed for all 8 agents.
* **CLOSED — `POST /v1/bcc/anchor/flush`'s returned `root` didn't match what was actually
  anchored.** `AnchorResult` gained a `root` field set to the real per-agent sub-root
  `anchor_batch_per_agent` computes and submits; the endpoint now returns each agent's own
  root under `agents[agent_id].root` instead of the discarded full-batch root. Verified
  against real anvil: the returned root for each agent independently recomputes to
  `merkle_root` over only that agent's own leaves, and two agents in the same flushed batch
  get two distinct, individually-correct roots.
* **CLOSED — score pushes were unconditional every cycle, even when unchanged.**
  `scoring_loop.py` caches the last-successfully-pushed `base_score` per agent
  (`_last_pushed_score`, same in-memory posture as the existing dispute cooldown) and skips
  the real transaction when unchanged, only updating the cache on a confirmed submission (so
  a failed push is retried, never permanently skipped). Verified against real anvil: a second
  sync cycle with an identical score submits no transaction; a cycle with a genuinely
  different score does, confirmed by reading the new value back on-chain.
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

## 6. `integrity-userapi` (user accounts, strictly non-chain) — ALL CLOSED

*Current State:* all four findings below are fixed and verified against a real Postgres
(`userapi-postgres`, port 5435) — 49 tests passing (up from 35), plus 6 new real-HTTP tests
in `integrity-mvp/demo` for the new userapi bridge. No mocked internals anywhere in the new
coverage: auth flows run through the real FastAPI app + `asgi-lifespan`, and the demo-bridge
tests hit a real local `ThreadingHTTPServer`, matching this package's existing
`_FakeOracleServer` pattern.

* **CLOSED — developer API keys now actually authenticate requests.** `get_current_user_id`
  (`app/deps.py`) accepts either a JWT bearer token *or* an `X-API-Key` header carrying a raw
  `uak_...` key; the latter is sha256-hashed and looked up against `api_keys.key_hash WHERE
  revoked_at IS NULL`, resolving to the key's owning `user_id`. Every existing route that
  depended on `get_current_user_id` gained this for free (no per-route changes needed) —
  `GET /me`, `GET /api-keys`, `/me/agents`, `/demo/*` are all now reachable with either
  credential. Deliberate exception: minting (`POST /api-keys`) and revoking (`DELETE
  /api-keys/{id}`) a key are JWT-only (`get_current_token`, not `get_current_user_id`) — an
  API key that could mint further keys would let one leaked long-lived credential perpetuate
  itself past its own revocation, so credential-management stays gated behind the shorter-lived,
  individually-revocable JWT. Revoking a key now has a real, immediate effect: `revoked_at IS
  NULL` in the lookup means a revoked key 401s on its very next use. Regression tests in
  `tests/test_api_keys.py` (`test_api_key_authenticates_a_request`,
  `test_revoked_api_key_no_longer_authenticates`, `test_unknown_api_key_401s`,
  `test_api_key_resolves_to_its_own_owner_not_another_users`,
  `test_api_key_cannot_mint_further_api_keys`, `test_api_key_cannot_revoke_api_keys`) replace
  the old docstring that explicitly said this code path didn't exist.
* **CLOSED — JWTs are now revocable.** `create_access_token` (`app/security.py`) stamps a
  per-token `jti` (uuid4) into every issued token; `decode_access_token` now returns a
  `DecodedToken(user_id, jti, expires_at)` instead of a bare string. New
  `migrations/0002_jwt_revocation.sql` adds a `revoked_tokens(jti PK, user_id, revoked_at,
  expires_at)` table. `get_current_token` (`app/deps.py`, the dependency `get_current_user_id`
  now delegates to for the bearer-token path) checks `revoked_tokens` on every request. New
  `POST /auth/logout` inserts the presented token's `jti` there — and, since it now has the
  transaction open, opportunistically `DELETE`s any `revoked_tokens` rows past their own
  `expires_at` first, so the table self-prunes without needing a separate cron/worker (a
  revoked token whose `exp` has already passed could never be replayed anyway — `jwt.decode`
  rejects it on expiry before `revoked_tokens` is ever consulted). Tests:
  `test_logout_revokes_the_token_immediately`,
  `test_logout_only_revokes_the_presented_token_not_others` (two independent logins for the
  same user get distinct `jti`s; revoking one doesn't touch the other),
  `test_logout_requires_a_valid_token`.
* **CLOSED — login now rate-limits repeated failures.** New `app/login_limiter.py`
  (`LoginRateLimiter`) mirrors `bcc_middleware/app/circuit_breaker.py`'s in-memory
  per-key-counter-plus-timed-lockout shape, keyed on the lowercased login email rather than an
  agent DID, with deliberately looser defaults (`login_failure_threshold=5`,
  `login_lockout_duration_seconds=300`, vs. bcc's `violation_threshold=3`/`900s`) since a login
  form has a much higher legitimate-typo rate than a signed agent commitment. `POST
  /auth/login` checks `is_locked_out` first (429 + `Retry-After` header if tripped), records a
  failure on a bad password, and clears the counter on success. Same accepted single-process
  state tradeoff as the circuit breaker it mirrors (would need Redis for multi-replica). Tests:
  `test_login_locks_out_after_repeated_failures` (even the *correct* password 429s once
  locked out), `test_login_lockout_is_scoped_to_one_email`,
  `test_login_success_resets_the_failure_count`.
* **CLOSED (real bridge added; UI trigger explicitly out of scope, documented) — `demo_runs`
  now has a real completion path.** New `PATCH /demo/runs/{id}` (`app/main.py`,
  `DemoRunUpdateRequest` in `app/schemas.py`) lets an authenticated owner transition their run
  through `running` → `completed`/`failed`, stamping `finished_at` only on a terminal status
  and storing a real `result_summary` JSONB payload (asyncpg now round-trips `jsonb` as plain
  dicts everywhere via a codec registered in `app/db.py::create_pool` — previously
  unregistered, since nothing had ever written non-null JSONB before this). New
  `integrity-mvp/demo/src/integrity_demo/userapi_bridge.py` calls this endpoint from the
  scenario engine itself: `main()` now reports `running` at start and `completed`/`failed` (with
  a real summary — agents registered, their sovereign-agent addresses, or the exception string)
  at the end, entirely opt-in via three env vars (`USERAPI_URL`/`USERAPI_TOKEN`/
  `USERAPI_RUN_ID`) an operator sets when they want a specific `make demo` invocation tied back
  to a `demo_runs` row created beforehand — unset, it's a no-op, so the engine still runs
  standalone exactly as before. Callback failures are logged and swallowed, never raised,
  matching this repo's fail-open posture for non-authorization side channels (same posture as
  `bcc_middleware`'s best-effort Merkle anchoring). Tests: `tests/test_demo_runs.py` (PATCH
  transitions, 404 on unknown/other-user's run, 422 on an invalid status) and
  `integrity-mvp/demo/tests/test_userapi_bridge.py` (6 tests against a real local HTTP server:
  no-op when unset, bearer-vs-`X-API-Key` header selection, and that HTTP/connection errors are
  swallowed, not raised). Honest coverage note: `main()`/`_run_scenario()`'s own refactor (the
  split that lets `main()` wrap the real scenario in a try/except and report `completed` vs.
  `failed`) is inspection-verified, not runtime-tested — running it needs a live Base Sepolia
  RPC + funded wallet, which is outside what this fix's test run could exercise. The
  `userapi_bridge` module itself (what actually talks to userapi) has full real-HTTP coverage;
  the call sites around it in `main()` do not. Genuinely still out of scope, not fixed here:
  nothing in `integrity-mvp`'s dashboard UI currently creates a `demo_runs` row or launches this
  CLI process (`userapi.ts` has no demo-run calls, no "Start Demo" button exists) — `make demo`
  remains an operator-run script against live Base Sepolia using a funder private key, not
  something the frontend can trigger; wiring that would need a job-queue/worker service, a
  materially bigger and separate piece of scope than closing the recording/reporting gap this
  finding was actually about.

## 7. Frontend (`integrity-mvp`) — findings from a full-package audit, ALL CLOSED

*Current State:* real backend wiring landed this session for `ChainOfThoughtPage`,
`SdkTelemetryPage`, `IntelligencePage`, `CompareTracesPage`, `ShieldPage`'s Stability
Certification tab, and the dashboard's `throughput`/`events`/`radar` widgets.
`AgentContext.tsx` is confirmed real (calls `oracle.listAgents()`) — this doc previously,
incorrectly, listed it as mock; that was stale. Two real on-chain write paths already
exist via wagmi (`ShieldPage.tsx`'s BAA sign/revoke, `ExchangePage.tsx`'s market entry) —
the prior "zero Web3 connectivity" claim in this doc was also stale and has been removed.
`npm run build` (`tsc -b && vite build`) now succeeds cleanly — verified end-to-end,
including the 3 unrelated pre-existing unused-import errors that were silently failing
the production build before anyone had run it locally.

* **CLOSED — `npm run test` currently fails.** `vitest.config.ts`'s exclude list doesn't cover
  `demo/`, so Vitest picks up a `node:test`-based file inside `integrity-mvp/demo/` and
  fails to bundle it — red CI/local runs even though the app's own tests pass. **Fix:**
  add `'demo/**'` to the exclude array. One line.
* **CLOSED — undefined CSS custom properties beyond the `--primary`/`--gold` pair fixed
  earlier this session.** `--bg-surface` (12 files), `--border`/`--border-main` (5+3
  files), `--space-2` through `--space-12` (a full spacing scale, 9+ files), the broken
  `hsla(var(--accent-primary) / 0.5)` in `.glass-panel-hover:hover` (was a hex string,
  not an HSL triplet — the whole declaration silently dropped), `--accent-primary-hsl`
  (added per-theme, since it can't be derived from the hex color at runtime), plus ~25
  more (`--bg-card`, `--shadow`/`--shadow-lg`, `--glass-*`, `--r-xs/sm/md`, status/brand
  aliases) found by a full `var(...)`-reference sweep, not just the originally-named
  ones. All added to `:root` as aliases of existing theme tokens. Verified visually
  across Dashboard/Contracts/Exchange/CompareTraces/Shield/Documents/Finance/Identity.
* **CLOSED — `AuditPage.tsx` made a specific, false security claim with no mock-data
  disclosure.** Its copy asserted actions are "cryptographically hashed and anchored to
  Base L2" and "cannot be tampered with by the agent, host, or hypervisor," backed by 3
  hardcoded `LoggerContext.tsx` entries (including a fabricated tx hash) — nothing was
  hashed, nothing was anchored. Rewritten to honestly state what's real (BCC Middleware
  DOES batch-anchor approved intents, best-effort, not yet per-event) versus what this
  specific page shows (a simulated local event feed, now `SeededDataBadge`-marked, no
  real audit-trail query endpoint exists yet).
* **CLOSED — `ShieldPage.tsx`'s consent/slash actions were theater, not disclosed
  stubs.** `handleSlashViolation` showed a native `alert()` claiming "Locked ITK Stake
  Slashed" with no contract call at all. Neither action can honestly be wired to a real
  transaction from this dashboard (EHRGate.grantAccess/revokeAccess are PATIENT-signed;
  a real slash needs Slasher's arbiter role after a dispute window) — both now use
  `addToast('info', ...)` with an explicit "Simulated only... No transaction was sent"
  message, matching the real wagmi handlers' toast pattern instead of a native `alert()`
  that read as more legitimate than it was. Fixing this surfaced a second, separate real
  bug: `.toast`/`.toast-container` had NO CSS anywhere in the app, so every toast in the
  app (including the real wagmi success/error toasts) rendered invisibly — fixed
  alongside, verified visually (toast now renders bottom-right, styled, on click).
* **CLOSED — `CompareTracesPage.tsx` was 100% hardcoded to 3 fixed fake trace IDs
  despite `oracle.getTraceTree()` already working in `ChainOfThoughtPage`.** Now
  discovers recent trace_ids from the real SSE stream (same "no list-traces endpoint,
  only get-by-id" pattern `ChainOfThoughtPage` already proved out) and fetches each via
  the real endpoint; Gantt offsets/widths/durations, the JSON payload tab, and the
  Deviations panel are now all computed from the real fetched span trees instead of a
  curated fake pair. Honest empty/error states when no real trace has streamed in yet.
* **CLOSED — radar widgets in `WidgetRegistry.tsx`/`IntelligencePage.tsx` plotted fixed,
  fabricated dimensions ignoring real `AisComponents` already fetched elsewhere.** Both
  now plot the real entropy/grounding/sacrifice/compliance breakdown
  (`oracle.getAis()`) — the dashboard widget for the selected agent, the Intelligence
  page for the top 2 real leaderboard agents — with an honest "select an agent" /
  "needs 2+ leaderboard agents" fallback instead of ever showing a fabricated number.
* **CLOSED — `ShieldPage.tsx`'s "Stability Certification" tab was hardcoded despite
  sibling tabs on the same page already proving the live oracle+on-chain-read pattern.**
  The tier badge is now derived from the real AIS score; the BAA Compliance Ratio from
  the real per-agent BAA data this same page already fetches via `getLogs`/
  `readContract`. "Prediction Accuracy (Markets)" and "Collateral Health Factor" have no
  real backend source anywhere in the monorepo (no market-prediction-scoring endpoint;
  `Slasher.sol`'s real `stakeOf`/`lockedStakeOf` aren't wired to this frontend) — shown
  as an explicit "Not available" state instead of a fabricated percentage.
* **VERIFIED, NOT A REAL GAP — `ActuarialHub.tsx`'s original finding ("could use real
  `oracle.listMarkets()`") doesn't hold up under inspection.** `oracle.listMarkets()`
  returns `MarketSummaryDto` — real `IntegrityMarket` prediction-market data (`question`,
  `outcome_count`, `resolve_deadline`, per-outcome staking), already correctly used by
  `ExchangePage`. `ActuarialHub`'s agent-hiring-task marketplace concept (`title`,
  `reward_itk`, bidding, escrow) is a structurally different domain with no
  corresponding oracle endpoint at all — substituting `listMarkets()` in would produce a
  broken, nonsensical page, not a fix. The component already carries precise, accurate
  disclosure at both of its real mock points (`"A2ACapitalPool has no oracle read
  endpoint yet"`, `"No benchmark-ingestion endpoint yet"`) — no code change needed here;
  this bullet is corrected rather than closed by a wire-up.
* **CLOSED — several buttons had no handler at all, undisclosed.** `IdentityPage.tsx`'s
  "Rotate Keys"/"Request Credential"/"Launch XNS Explorer" turned out to already be wired
  in a later redesign this session missed on first read; "Regenerate Attestation
  Document" and "Stake ITK"/"Withdraw" are now `disabled` with an honest `title` tooltip
  (`NitroAttestationGenerator` really does raise `NotImplementedError` rather than fake a
  document; `Slasher.sol` has real `stake()`/`unstake()` entrypoints but this frontend
  doesn't sync the Slasher ABI or resolve the agent's Slasher clone address yet — a real
  follow-up, not silently abandoned). `FinancePage.tsx`'s Receive/Send/Swap/Buy are
  disabled with per-action tooltips (no transfer/DEX/fiat-onramp integration exists
  anywhere in this stack); "New Allowance Rule" is disabled (OPA policies are static
  Rego files, not dynamically editable via a UI); "View Explorer" is now wired for real
  — opens the connected wallet's address on the actual configured chain's block explorer
  via wagmi's chain config, not a placeholder.
* **CLOSED — `DocumentsPage.tsx`** was fully fabricated with no backing capability
  anywhere (`oracle.ts`/`userapi.ts` have no document/RAG-indexing endpoint) and no
  disclosure badge. Added an explicit "Not yet implemented" banner + `SeededDataBadge`,
  and disabled the "Upload Document" button with a tooltip explaining there's nowhere
  for an uploaded file to go — matching the honestly-badged posture of every other
  Tier-4 mock in the app instead of being the one silent exception.
* **CLOSED — `TriMetricWidget.tsx` (dashboard's "Tri-Metric Risk Analysis" panel) badged
  itself "LIVE MODEL" while every number on it was fake.** Found during a follow-up audit
  focused specifically on this widget. `avgAis` was picked from 3 hardcoded magic
  constants (920/850/950) gated on a crude threshold; `blockedRate` ("0.42") and
  `riskExposure` ("12,500") were literal strings with no computation at all; all three
  sparklines were fabricated trend arrays. Unlike every sibling in
  `WidgetRegistry.tsx` (which either fetches real data or renders a `SeededDataBadge`),
  this one did neither — the single most severe fake-data surface left in the dashboard.
  Fixed two of the three metrics with real data reusing existing infrastructure: `AIS
  Deficit` and `BCC Intent Violation Rate` now fan out `oracle.getAis()` across every
  agent in the already-global `AgentContext` (same real-data pattern `DashboardPage.tsx`'s
  `gauge` widget already used), averaging real `ais` and `components.compliance` — the
  latter is exactly `(1 - flagged_ratio) * 1000` per scoring-core's own polarity, so
  inverting it back out recovers the real BCC-violation ratio the formula names, not a
  proxy. The third metric ("Smart BAA Value at Risk") is now honestly marked unavailable
  via `SeededDataBadge` instead of showing a number: no probability-of-leak model exists
  anywhere in this protocol (same conclusion independently reached for ActuarialHub
  earlier this session), and no network-wide index of staked BAA collateral exists either
  — `SmartBAA.requiredCollateral()` is only readable per-BAA-address today (confirmed via
  `ShieldPage.tsx`), there's no "list every active BAA" capability to sum across. Building
  that real aggregate would need a new oracle-side indexing endpoint — logged as a genuine
  follow-up, not fabricated here. Fabricated sparklines were removed rather than kept
  under the now-real numbers (a fake trend line under a real value would itself be
  misleading — implies historical data that isn't being fetched). `npx tsc -b --noEmit`,
  `npm run lint`, and `npm run build` all pass clean.
  **Two real runtime bugs were only caught by actually loading the dashboard in a browser
  against the live local stack** (real Postgres/oracle/anvil, one real registered agent,
  `VITE_MOCK_MODE` temporarily overridden to `false` for the test run since the default
  `.env` filters `listAgents()` down to `mock-agent-*` IDs and the one real local agent
  doesn't match that prefix):
  1. The 3 KaTeX formula sub-components (`AisFormula`/`BccFormula`/`ExposureFormula`) were
     defined as local consts *inside* the widget's function body — a pre-existing pattern
     copied forward from the original file, harmless while the widget was static props-only.
     Adding real `useEffect`/`useState` here meant the widget now re-renders on its own
     fetch-driven state changes too, and each re-render redefined those consts as new
     component *types*, forcing React to fully unmount+remount (re-parse) all 3 KaTeX
     formulas every render — observed as `mathVsTextAccents` console warnings flooding
     multiple times per second and freezing the tab (`Page.captureScreenshot` timing out).
     Fixed by hoisting all 3 to module scope; also added a reference-equality guard on the
     `agents.length === 0` branch's `setSamples([])` call to avoid an unnecessary render
     from a fresh-but-equivalent empty-array literal.
  2. Even after the freeze was fixed, the two now-real value numbers ("50.0%"/"0.00%") were
     visually clipped by the grid cell boundary — `DashboardPage.tsx`'s hardcoded
     `DEFAULT_LAYOUTS` gives this widget `h: 2` (300px at `rowHeight=150`), sized for the
     *old* layout where the sparklines were absolutely-positioned background decoration
     that consumed no real flex height. The new layout's formula+value+label content
     needs more room. Bumped to `h: 3`/`minH: 3` in both `lg`/`md` breakpoints
     (`DEFAULT_LAYOUTS`) and `WidgetRegistry.tsx`'s `defaultSize` for consistency;
     react-grid-layout's default vertical compaction reflows every widget below it
     automatically, no other entry's coordinates needed hand-adjusting. Re-verified via
     screenshot: all three metrics (including the honest "Not available" disclosure text)
     now render fully visible with no clipping and no repeated console warnings.

## 8. CI / Autonomous Fix-Forward (`.github/workflows/ci.yml`)
*Current State:* A real CI workflow now runs every package's test suite (mirroring the root `Makefile`'s `test` target) as separate per-package jobs on push/PR to `main`. The `notify-jules-on-failure` job makes a real call to the Jules API (`POST https://jules.googleapis.com/v1alpha/sessions`, `X-Goog-Api-Key` auth, `AUTOMATION_MODE_AUTO_CREATE_PR`) — verified against `@google/jules-sdk`'s actual published source, not guessed.
* **Gap - One-time repo-owner authorization still required:** the workflow will fail loudly (not silently no-op) until (1) Jules is authorized for `XibalbaTechSol/integrity-latest` at jules.google.com (grants its GitHub App repo access), and (2) a `JULES_API_KEY` secret (from jules.google.com/settings/api) is added under repo Settings → Secrets and variables → Actions. Both are account-holder actions no automation can complete on the owner's behalf.
* **CLOSED (2026-07-16) — `auto-merge-jules.yml`'s own actor filter never actually matched anything.** Confirmed via the API: every PR in this repo, including ones on `jules-<id>-<hash>` branches, is attributed to user `XibalbaTechSol` (type `User`), not a distinct `jules-google[bot]` identity `github.actor == 'jules-google[bot]'` checks for. The workflow has likely never fired. Also confirmed `allow_auto_merge` was `false` at the repo level — a documented prerequisite in that workflow's own setup comments that was never actually done; fixed via `gh api` PATCH. `auto-merge-jules.yml` itself was not rewritten (not this pass's file to unilaterally edit) — flagged here so the mismatch isn't lost.
* **CLOSED (2026-07-16) — 21 stale branches, 5 of 8 open PRs in real CONFLICTING state.** Root cause: `auto-merge-jules.yml` only re-evaluates a PR on `opened`/`synchronize`/`reopened`, never when `main` itself advances past it — several Jules branches cut from a similar base drifted into genuine git conflicts as earlier ones merged serially, then sat forever (GitHub won't auto-merge a conflicting PR regardless of how long auto-merge stays "enabled" on it). Verified directly: `gh pr view --json mergeable` showed `CONFLICTING` for #12/14/18/19/24/26. Separately, 18 of 26 total PRs were already merged but their branches were never deleted (no "automatically delete head branches" repo setting). **GitHub Merge Queue is unavailable for this repo** — a `merge_queue` ruleset rule is rejected by the API while an otherwise-identical `required_status_checks` rule succeeds; likely a personal-account plan restriction (org-owned repos get merge queue, and this repo's owner returns `404` on `/orgs/{owner}`). Fix applied instead: a `required_status_checks` ruleset naming the 8 real CI job names from `ci.yml` (verified against the workflow source, not guessed), plus a new hourly workflow (`.github/workflows/close-conflicting-jules-prs.yml`) that finds Jules-branch PRs (matched by branch-name pattern, not the broken actor check) sitting in `CONFLICTING` state and closes them with an explanatory comment — if the underlying CI failure is still real, the next failure on `main` has Jules open a fresh PR against current `main`. **Note:** an earlier attempt also added `required_status_checks` alone (without `merge_queue`) directly to `main`'s branch protection and discovered empirically that it blocks *direct* pushes to `main`, not just PR merges — removed again since that conflicts with this repo's established direct-push workflow; only the auto-close-conflicting-PRs workflow was kept.

## 9. `integrity-mvp/demo` (scenario engine) — real bugs found by actually running it end-to-end

*Current State:* Previously undocumented — this section is new. Found and fixed by running the real 4-persona scenario engine against a real local anvil chain + real deployed contracts + a real running oracle (not by code inspection), per this repo's "no silent mocks" rule applied to testing itself: a bug that only shows up when you actually run the thing doesn't count as covered just because the code reads plausibly.
* **CLOSED — every span this engine ever exported was silently rejected by the oracle.** `main.py` built one shared, module-level OTel `Resource` with no `integrity.agent.id` attribute at all — the oracle's real OTLP receiver requires it and was rejecting every single span (`resource missing required 'integrity.agent.id' attribute`), 100% of the time, for as long as this file has existed. Worse than a one-line omission: the engine manages 4 *different* agent identities in one process, and OTel's global tracer-provider model (`opentelemetry.trace.set_tracer_provider`, and this SDK's own `telemetry/core.py::init_telemetry` which wraps it) is a one-shot singleton — the first call wins, every later call silently no-ops — so even a naive fix would have misattributed every agent's spans to whichever agent registered first. Fixed with a real per-agent `TracerProvider`/`Tracer` (`_tracer_for(agent_id)`, cached, used directly via `.get_tracer()` and never installed as the process-global provider — the standard OTel pattern for multiple independent resources in one process). Verified for real, not just re-run without error: queried the oracle's `otel_spans` table directly after a run and confirmed real, correctly-attributed `register_agent`/`agent_conversation` rows for all 4 distinct agent IDs.
* **CLOSED — one LLM call failure crashed the entire process.** The capital-allocation tool-calling section had no error handling at all, unlike the registration loop just above it (which already degrades one agent at a time and continues). Reproduced with a real invalid API key present in the environment: a raw Python traceback, non-zero exit, no clean failure report. Wrapped in try/except matching the registration loop's own pattern — the failure is now logged, recorded in the run summary (which `userapi_bridge.report_status("failed", ...)` already had a real path for, previously unable to fire cleanly for this failure mode), and the process exits 0 with whatever did succeed intact.
* **CLOSED — no preflight funder-balance check.** The live Base Sepolia funder wallet sits at ~0.001 ETH — under the SDK's own default per-agent funding amount (0.01 ETH) by 10x, a pre-existing state `FAUCET_INFO.md` already documented but nothing in the demo engine checked before spending gas. A real run against the live network would have failed registration 1 of 4 with a deep RPC error instead of a clear one. `_check_funder_balance` now reads the real on-chain balance via the same `FUNDER_PRIVATE_KEY`/`RPC_URL` `register_agent()` itself uses, and compares against `register_agent`'s own default `fund_amount_wei` (read via `inspect.signature`, not a second hardcoded constant that could drift from the real one) times the agent count, raising a clear, actionable error before any registration is attempted.
* **CLOSED — `make demo` didn't exist.** Referenced in `README.md`/`CLAUDE.md`/`docs/TESTING.md` for the whole life of this rewrite, with no actual Makefile target backing it — the only way to run the demo was to know to `cd integrity-mvp/demo && uv run integrity-demo` and hand-export four env vars. Added the target (defaults to live Base Sepolia per the existing docs' own description; a local-anvil override is documented in the target's own comment for exactly the funding-shortfall situation above).
