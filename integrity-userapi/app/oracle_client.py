"""
The ONLY place this package talks to integrity-oracle. Plain HTTP via
httpx -- no web3, no alloy, no chain RPC client anywhere in this package.
This module is the enforced boundary: `GET /me/agents` fans out through
`fetch_agent`, which returns a tri-state result (live data / not found /
unreachable) rather than raising, so a single bad lookup never takes down
the whole endpoint response, and a failure is always surfaced honestly
(never silently treated as "agent has no data").
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.config import Settings


@dataclass
class AgentLookupResult:
    live_data: dict[str, Any] | None
    error: str | None


async def fetch_agent(agent_did: str, settings: Settings) -> AgentLookupResult:
    url = f"{settings.oracle_url.rstrip('/')}/v1/agent/{agent_did}"
    try:
        async with httpx.AsyncClient(timeout=settings.oracle_timeout_seconds) as client:
            resp = await client.get(url)
    except httpx.HTTPError as exc:
        # Oracle unreachable / timed out / connection refused -- infra
        # failure, not "this DID doesn't exist". Never fabricate live_data.
        return AgentLookupResult(live_data=None, error=f"oracle unreachable: {exc}")

    if resp.status_code == 404:
        return AgentLookupResult(live_data=None, error="agent not found on oracle")
    if resp.status_code != 200:
        return AgentLookupResult(
            live_data=None, error=f"oracle returned HTTP {resp.status_code}"
        )

    try:
        return AgentLookupResult(live_data=resp.json(), error=None)
    except ValueError as exc:
        return AgentLookupResult(live_data=None, error=f"oracle returned malformed JSON: {exc}")
