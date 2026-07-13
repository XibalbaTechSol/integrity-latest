"""
Real OPA policy integration — docs/INTERFACE_CONTRACT.md §7.

The old prototype's `commit_action_intent` had this comment above a
hardcoded `{"allow": True}`:

    # 2. Mock OPA Evaluation (In production, this calls an OPA service)
    # For now, we assume success unless specified otherwise for testing

That's a fail-OPEN bug: if policy evaluation is mocked to always succeed,
every action is implicitly allowed regardless of what any real policy would
say, and "call the real thing later" never happened. This module replaces it
with an actual HTTP call to a running OPA server's REST API, and — this is
the important part — anything that isn't a clean "allow: true" response
(timeout, connection refused, 5xx, malformed JSON, missing `result` key)
is treated as DENY. There is no local regex/heuristic fallback path: OPA
unreachable means the action is blocked, full stop.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests

DEFAULT_OPA_URL = "http://localhost:8181"
DEFAULT_TIMEOUT_SEC = 2.0


@dataclass
class PolicyDecision:
    allow: bool
    reason: str
    # True if this decision was forced by an infrastructure failure (OPA
    # down, timeout, bad response) rather than an actual policy evaluation.
    # Callers can use this to distinguish "policy said no" from "we couldn't
    # ask policy at all" for logging/alerting purposes — both still deny.
    fail_closed: bool
    raw_response: Optional[Dict[str, Any]] = None


def evaluate_policy(
    policy_path: str,
    input_document: Dict[str, Any],
    opa_url: Optional[str] = None,
    timeout: float = DEFAULT_TIMEOUT_SEC,
) -> PolicyDecision:
    """
    POST {OPA_URL}/v1/data/{policy_path} with `{"input": input_document}`.

    `policy_path` is a slash-separated Rego package+rule path, e.g.
    "integrity/bcc/allow" for the `POST /v1/data/integrity/bcc/allow`
    endpoint the contract specifies. OPA's data API returns
    `{"result": <value>}` on success — for a boolean rule like `allow`,
    `<value>` is `true`/`false` directly.

    Fail-closed contract: ANY exception (connection error, timeout, non-2xx
    status, JSON decode failure) or an ambiguous response (missing `result`,
    or `result` not a bool) results in `PolicyDecision(allow=False, ...)`.
    This function never raises — callers can rely on always getting a
    decision object, and that object is never "allow" by default.
    """
    base_url = opa_url or os.getenv("OPA_URL", DEFAULT_OPA_URL)
    url = f"{base_url.rstrip('/')}/v1/data/{policy_path.strip('/')}"

    try:
        response = requests.post(
            url, json={"input": input_document}, timeout=timeout
        )
    except requests.exceptions.RequestException as exc:
        return PolicyDecision(
            allow=False,
            reason=f"OPA unreachable at {url}: {exc}",
            fail_closed=True,
        )

    if response.status_code != 200:
        return PolicyDecision(
            allow=False,
            reason=f"OPA returned HTTP {response.status_code} for {url}",
            fail_closed=True,
        )

    try:
        body = response.json()
    except ValueError as exc:
        return PolicyDecision(
            allow=False,
            reason=f"OPA response was not valid JSON: {exc}",
            fail_closed=True,
        )

    if "result" not in body:
        # OPA returns {} (no "result" key) when the queried path doesn't
        # exist yet — e.g. the policy hasn't been loaded. Treat exactly
        # like "unreachable": we cannot confirm allow, so deny.
        return PolicyDecision(
            allow=False,
            reason=f"OPA response for {policy_path} had no 'result' — policy not loaded?",
            fail_closed=True,
            raw_response=body,
        )

    result = body["result"]
    if not isinstance(result, bool):
        return PolicyDecision(
            allow=False,
            reason=f"OPA 'result' was {result!r}, expected a boolean allow decision",
            fail_closed=True,
            raw_response=body,
        )

    return PolicyDecision(
        allow=result,
        reason="policy evaluated" if result else "denied by policy",
        fail_closed=False,
        raw_response=body,
    )
