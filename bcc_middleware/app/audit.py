"""
Reports every `run_intercept` decision (allow AND deny) to the oracle's real,
durable `audit_log` table via `POST /v1/audit/ingest`.

Before this module existed, `bcc_middleware` had ZERO durable storage anywhere
(confirmed by grep across app/ for sqlite/psycopg/sqlalchemy/CREATE TABLE) --
the single most audit-worthy event type in the whole protocol (real per-request
OPA ALLOW/DENY policy decisions) only ever existed in the HTTP response body,
gone the instant the response was sent. This is what made the dashboard's old
"Audit Logs" panel 100% fake: there was nothing real to query.

*** Reporting is best-effort, NOT a security gate ***
Same asymmetry as anchor.py's on-chain anchoring: by the time this is called,
run_intercept has already decided allow/deny. Reporting failure (oracle down,
network blip) must never change that decision or block the caller's response
-- it only means this one decision is missing from the audit trail until the
next successful report, a documented gap rather than a correctness issue.
"""

from __future__ import annotations

import logging

import httpx

from app.config import Settings

logger = logging.getLogger("bcc_middleware.audit")


def report_decision(
    settings: Settings,
    *,
    agent_id: str | None,
    decision: str,
    reason_code: str | None = None,
    detail: str | None = None,
    intent_type: str | None = None,
) -> None:
    """Fire-and-forget POST to the oracle's audit ingest endpoint. Never raises --
    catches and logs any failure so a slow/unreachable oracle can't add latency
    or failure modes to the actual intercept decision path."""
    payload = {
        "agent_id": agent_id,
        "source": "bcc_middleware",
        "event_type": "bcc_intercept",
        "decision": decision,
        "reason_code": reason_code,
        "detail": detail,
        "intent_type": intent_type,
    }
    try:
        resp = httpx.post(
            f"{settings.oracle_url.rstrip('/')}/v1/audit/ingest",
            json=payload,
            timeout=3.0,
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("failed to report audit decision for agent %s: %s", agent_id, exc)
