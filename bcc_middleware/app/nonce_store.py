"""
Per-agent nonce tracking for replay protection.

§4.2 defines `nonce` as a "monotonic per-agent integer". We enforce that
strictly: a commitment is rejected if its nonce is not greater than the
last nonce we accepted for that agent_id. This is what makes it safe for
`intended_state_hash`/`signature` alone to authorize an action -- without a
monotonic nonce check, a captured, still-signature-valid commitment could
be replayed indefinitely within its freshness window.

In-memory only for this service (a single-process dev/demo deployment). A
production multi-replica deployment would move this to Redis (already in
the docker-compose topology for integrity-oracle) so nonce state is shared
across replicas -- called out in the README as a scaling follow-up, not a
correctness bug for the current single-process scope.
"""

from __future__ import annotations


class NonceStore:
    def __init__(self) -> None:
        self._last_nonce: dict[str, int] = {}

    def check_and_record(self, agent_id: str, nonce: int) -> bool:
        """
        Returns True and records the nonce if it's strictly greater than the
        last one seen for this agent (or this is the agent's first
        commitment). Returns False (and does NOT record) on replay/reorder,
        so a rejected request never advances the watermark.
        """
        last = self._last_nonce.get(agent_id)
        if last is not None and nonce <= last:
            return False
        self._last_nonce[agent_id] = nonce
        return True

    def reset(self, agent_id: str | None = None) -> None:
        if agent_id is None:
            self._last_nonce.clear()
        else:
            self._last_nonce.pop(agent_id, None)
