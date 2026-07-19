"""
BCC Middleware -- pre-execution policy gating ("Behavioral Commitment Chain").

Request flow for POST /v1/bcc/intercept, in order (see inline comments for
why each step is where it is):

  0. Schema validation (FastAPI/pydantic, via BCCCommitment).
  1. Circuit breaker check -- cheap, no I/O, so it goes first.
  2. Signature verification -- if we can't trust the commitment came from
     `agent_id`, nothing downstream matters.
  3. Nonce replay check.
  4. Freshness (timestamp) check.
  5. OPA policy evaluation -- FAIL CLOSED if OPA is unreachable/erroring.
  6. On-chain BAA check, only if OPA flagged `requires_baa` -- FAIL CLOSED
     if we can't positively confirm an active BAA.
  7. Merkle batch admission + best-effort anchoring (not a gate -- see
     app/anchor.py).
  8. Best-effort audit reporting -- every allow AND deny decision (not just
     approved ones) is reported to the oracle's durable `audit_log` table
     (app/audit.py) so the dashboard's Audit Logs panel has a real event
     source. Never a gate; see app/audit.py's docstring for why.

Every deny path records *why* in the response `reason` field with a
consistent `SOME_CODE: detail` shape so operators/tests can pattern-match
on the failure category.
"""

from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.baa import BAAStatus, check_baa_status
from app.canonical import SignatureVerificationError, verify_commitment_signature
from app.chain import resolve_verification_tier
from app.circuit_breaker import AgentCircuitBreaker
from app.config import Settings, settings as default_settings
from app.merkle import MerkleBatcher
from app.nonce_store import NonceStore
from app.opa_client import OPAUnavailableError, evaluate as opa_evaluate
from app.schemas import BCCCommitment, BCCInterceptResponse, HealthResponse, VerifyTokenRequest, VerifyTokenResponse
from app import anchor as anchor_module
from app import audit as audit_module
from app import opa_client
from app import scoring_loop as scoring_loop_module
from app import verification_token as verification_token_module

logger = logging.getLogger("bcc_middleware")

_score_sync_task: asyncio.Task | None = None


async def _score_sync_loop(settings: Settings) -> None:
    """
    Background loop, started at app startup: every
    `score_sync_interval_seconds`, runs one full run_sync_cycle over every
    agent the oracle knows about. Wrapped in try/except so one bad cycle
    (oracle hiccup, RPC blip) logs and retries on the next tick rather than
    killing the loop -- this is the ONLY thing that keeps agent scores
    moving on-chain at all today, so it must not silently stop running.
    """
    while True:
        try:
            result = await asyncio.to_thread(scoring_loop_module.run_sync_cycle, settings, now=time.time())
            pushed = sum(1 for r in result.results if r.score_pushed)
            disputed = sum(1 for r in result.results if r.dispute_raised)
            if result.errors:
                logger.warning("score sync cycle: %s", "; ".join(result.errors))
            else:
                logger.info(
                    "score sync cycle: %d agents seen, %d scores pushed, %d disputes raised",
                    result.agents_seen, pushed, disputed,
                )
        except Exception:
            logger.exception("score sync cycle crashed, will retry next interval")
        await asyncio.sleep(settings.score_sync_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _score_sync_task
    if default_settings.score_sync_enabled:
        _score_sync_task = asyncio.create_task(_score_sync_loop(default_settings))
    yield
    if _score_sync_task is not None:
        _score_sync_task.cancel()


app = FastAPI(title="BCC Middleware", version="3.0.0", lifespan=lifespan)

# Process-local state. See nonce_store.py / circuit_breaker.py docstrings
# for why in-memory is an accepted scope limitation for this service today
# (single replica dev/demo topology) rather than a correctness bug.
circuit_breaker = AgentCircuitBreaker(
    violation_threshold=default_settings.circuit_breaker_violation_threshold,
    lockout_duration_seconds=default_settings.circuit_breaker_lockout_seconds,
)
nonce_store = NonceStore()
batcher = MerkleBatcher(batch_size=default_settings.merkle_batch_size)


# Holds references to in-flight audit-report background tasks so asyncio doesn't
# garbage-collect (and silently cancel) them before the HTTP call completes --
# `asyncio.ensure_future` alone doesn't keep a task alive on its own.
_audit_report_tasks: set[asyncio.Task] = set()


def _report_decision_background(settings: Settings, *, agent_id: str | None, decision: str, reason_code: str | None = None, detail: str | None = None, intent_type: str | None = None) -> None:
    task = asyncio.ensure_future(
        asyncio.to_thread(
            audit_module.report_decision,
            settings,
            agent_id=agent_id,
            decision=decision,
            reason_code=reason_code,
            detail=detail,
            intent_type=intent_type,
        )
    )
    _audit_report_tasks.add(task)
    task.add_done_callback(_audit_report_tasks.discard)


def _deny(reason: str, *, agent_id: str | None, settings: Settings, intent_type: str | None = None) -> BCCInterceptResponse:
    # Reported in the background (not awaited) so a slow/unreachable oracle can
    # never add latency to this response -- see audit.py's module docstring for
    # why this is best-effort, same asymmetry as anchor.py's on-chain anchoring.
    code, _, detail = reason.partition(": ")
    _report_decision_background(settings, agent_id=agent_id, decision="deny", reason_code=code, detail=detail or reason, intent_type=intent_type)
    return BCCInterceptResponse(authorized=False, reason=reason)


def _flush_and_anchor(settings: Settings) -> None:
    """
    Flushes the pending batch (if full) and best-effort submits it on-chain.
    Anchoring failure is logged, not raised -- see app/anchor.py docstring
    for why this is intentionally not a gate on the caller's response.
    """
    if not batcher.is_full():
        return
    flushed = batcher.flush()
    if flushed is None:
        return
    _root, leaves = flushed
    # Anchor per-agent: each agent's leaves go to that agent's own StateAnchor
    # (StateAnchor is a per-agent primitive now — see anchor.anchor_batch_per_agent).
    anchor_module.anchor_batch_per_agent(settings, leaves)


async def run_intercept(commitment: BCCCommitment, settings: Settings) -> BCCInterceptResponse:
    """
    Core interception logic, factored out of the route handler so tests can
    call it directly (and so a future non-HTTP entrypoint, e.g. a queue
    consumer, could reuse it).
    """
    agent_id = commitment.agent_id

    # --- 1. Circuit breaker -------------------------------------------------
    if circuit_breaker.is_locked_out(agent_id):
        remaining = int(circuit_breaker.lockout_remaining_seconds(agent_id))
        return _deny(f"CIRCUIT_BREAKER_OPEN: agent is locked out for {remaining}s due to prior violations", agent_id=agent_id, settings=settings, intent_type=commitment.intent_type)

    # --- 2. Signature verification ------------------------------------------
    # An invalid signature means we cannot trust `agent_id` authored this
    # commitment at all -- this DOES count as an agent-attributable
    # violation (either the agent is misbehaving, or someone is attempting
    # to forge commitments on its behalf; either way, lock it down).
    try:
        verify_commitment_signature(commitment)
    except SignatureVerificationError as exc:
        circuit_breaker.record_violation(agent_id)
        return _deny(f"BCC_INVALID_SIGNATURE: {exc}", agent_id=agent_id, settings=settings, intent_type=commitment.intent_type)

    # --- 3. Replay protection ------------------------------------------------
    if not nonce_store.check_and_record(agent_id, commitment.nonce):
        circuit_breaker.record_violation(agent_id)
        return _deny(f"BCC_NONCE_REPLAY: nonce {commitment.nonce} is not greater than the last accepted nonce for this agent", agent_id=agent_id, settings=settings, intent_type=commitment.intent_type)

    # --- 4. Freshness ----------------------------------------------------------
    age_ms = (time.time() * 1000) - commitment.timestamp
    if age_ms > settings.max_commitment_age_ms:
        circuit_breaker.record_violation(agent_id)
        return _deny(f"BCC_EXPIRED: commitment is {int(age_ms)}ms old, exceeds max age {settings.max_commitment_age_ms}ms", agent_id=agent_id, settings=settings, intent_type=commitment.intent_type)
    if age_ms < -settings.max_commitment_age_ms:
        # Clock skew / a timestamp claiming to be from the future beyond our
        # tolerance is just as suspicious as a stale one.
        circuit_breaker.record_violation(agent_id)
        return _deny("BCC_EXPIRED: commitment timestamp is implausibly far in the future", agent_id=agent_id, settings=settings, intent_type=commitment.intent_type)

    # --- 5. OPA policy evaluation (FAIL CLOSED) -------------------------------
    # verification_tier is resolved unconditionally (not just for intent_types the
    # policy happens to gate) because Rego needs it as an input field to evaluate
    # `min_tier_by_intent_type` against -- see chain.resolve_verification_tier's
    # docstring for why an unresolvable tier fails to 0 rather than failing the
    # whole request closed.
    verification_tier = await asyncio.to_thread(resolve_verification_tier, commitment.agent_id, oracle_url=settings.oracle_url)
    opa_input = {
        "agent_id": commitment.agent_id,
        "intent_type": commitment.intent_type,
        "intended_state_hash": commitment.intended_state_hash,
        "nonce": commitment.nonce,
        "timestamp": commitment.timestamp,
        "verification_tier": verification_tier,
    }
    try:
        decision = await opa_evaluate(settings, opa_input)
    except OPAUnavailableError as exc:
        # Infra failure, NOT an agent violation -- do not trip the circuit
        # breaker (see circuit_breaker.py docstring). Still deny: this is
        # the fail-closed behavior the interface contract requires.
        logger.error("OPA unavailable, failing closed: %s", exc)
        return _deny(f"BCC_POLICY_ENGINE_UNAVAILABLE: {exc}", agent_id=agent_id, settings=settings, intent_type=commitment.intent_type)

    if not decision.allow:
        circuit_breaker.record_violation(agent_id)
        reasons = "; ".join(decision.violations) or "policy denied without a specific reason"
        return _deny(f"OPA_REJECTION: {reasons}", agent_id=agent_id, settings=settings, intent_type=commitment.intent_type)

    # --- 6. On-chain BAA check (FAIL CLOSED), only for healthcare-vertical intents ---
    # `commitment.covered_entity_address` (schemas.py) names WHICH covered
    # entity (hospital) this healthcare-vertical commitment is against --
    # the real on-chain isBAAActive(coveredEntity, businessAssociate) call
    # (app/baa.py) is keyed on that pair, not on the agent alone. If it's
    # unset here, check_baa_status fails closed with CANNOT_VERIFY rather
    # than guessing or skipping the check.
    if decision.requires_baa:
        status, detail = await asyncio.to_thread(check_baa_status, settings, agent_id, commitment.covered_entity_address)
        if status is not BAAStatus.ACTIVE:
            # Both "definitively inactive" and "cannot verify" deny -- an
            # unverifiable BAA must never be treated as compliant.
            circuit_breaker.record_violation(agent_id)
            code = "BAA_INACTIVE" if status is BAAStatus.INACTIVE else "BAA_CANNOT_VERIFY"
            return _deny(f"{code}: {detail}", agent_id=agent_id, settings=settings, intent_type=commitment.intent_type)

    # --- 7. Approved: admit to the merkle batch, issue a verification token ---
    batch_index = batcher.add(commitment)
    await asyncio.to_thread(_flush_and_anchor, settings)

    token = verification_token_module.issue_token(
        settings, commitment.agent_id, commitment.nonce, commitment.intended_state_hash
    )
    _report_decision_background(
        settings,
        agent_id=agent_id,
        decision="allow",
        detail=f"admitted to merkle batch index {batch_index}",
        intent_type=commitment.intent_type,
    )
    return BCCInterceptResponse(authorized=True, verification_token=token, batch_index=batch_index)


@app.post("/v1/bcc/intercept", response_model=BCCInterceptResponse)
async def intercept(commitment: BCCCommitment) -> BCCInterceptResponse:
    return await run_intercept(commitment, default_settings)


@app.post("/v1/reputation/sync")
async def force_score_sync() -> dict:
    """
    Operational/testing hook: run one score-sync cycle right now instead of
    waiting for the periodic loop. Not part of the interface contract; only
    exists so integration tests and operators don't have to wait
    `score_sync_interval_seconds` to observe a push.
    """
    result = await asyncio.to_thread(scoring_loop_module.run_sync_cycle, default_settings, now=time.time())
    return {
        "agents_seen": result.agents_seen,
        "errors": result.errors,
        "results": [
            {
                "agent_id": r.agent_id,
                "score_pushed": r.score_pushed,
                "score_detail": r.score_detail,
                "dispute_raised": r.dispute_raised,
                "dispute_detail": r.dispute_detail,
            }
            for r in result.results
        ],
    }


@app.post("/v1/bcc/verify_token", response_model=VerifyTokenResponse)
async def verify_token(request: VerifyTokenRequest) -> VerifyTokenResponse:
    """
    Lets a relying party (not just the agent that received the token) ask
    this service whether `token` was genuinely issued for exactly the given
    (agent_id, nonce, intended_state_hash) -- see app/verification_token.py.
    """
    valid = verification_token_module.verify_token(
        default_settings, request.token, request.agent_id, request.nonce, request.intended_state_hash
    )
    return VerifyTokenResponse(valid=valid)


@app.post("/v1/bcc/anchor/flush")
async def force_flush() -> dict:
    """
    Operational/testing hook: anchor whatever's pending right now instead of
    waiting for the batch to fill. Not part of the interface contract; only
    exists so integration tests and operators don't have to send
    `merkle_batch_size` real commitments to observe an anchoring transaction.
    """
    flushed = batcher.flush()
    if flushed is None:
        return {"flushed": False, "detail": "no pending commitments"}
    _discarded_full_batch_root, leaves = flushed
    # Per-agent anchoring: one StateAnchor tx per distinct agent in the batch.
    # NOTE: no single "root" field here anymore -- anchoring is per-agent
    # (see anchor.py), so the full-batch root above matches nothing that was
    # actually submitted on-chain. Each agent's OWN sub-root (the thing that
    # really got anchored, or attempted) is under `agents[agent_id].root`
    # instead (PRODUCTION_GAPS.md §5).
    results = anchor_module.anchor_batch_per_agent(default_settings, leaves)
    return {
        "flushed": True,
        "leaf_count": len(leaves),
        "agents": {
            agent_id: {
                "anchored": r.submitted,
                "detail": r.detail,
                "tx_hash": r.tx_hash,
                "root": f"0x{r.root.hex()}" if r.root is not None else None,
            }
            for agent_id, r in results.items()
        },
    }


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    opa_ok = await opa_client.is_reachable(default_settings)
    from app.chain import get_w3

    try:
        chain_ok = get_w3(default_settings.rpc_url).is_connected()
    except Exception:  # a misconfigured RPC URL shouldn't crash the health check
        chain_ok = False
    return HealthResponse(
        status="online",
        opa_reachable=opa_ok,
        chain_reachable=chain_ok,
        pending_batch_size=batcher.pending_count,
    )
