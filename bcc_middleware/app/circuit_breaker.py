"""
Per-agent circuit breaker: repeated policy/security violations by the same
agent trip a temporary lockout, independent of any single OPA decision.

This exists because OPA answers "is this one intent allowed" -- it has no
memory across requests. An agent that racks up several distinct violations
in a row (each individually denied) is a stronger signal of compromise or
malicious behavior than any single denial, and should be locked out from
even *attempting* further actions for a cooldown window rather than making
us re-derive that verdict from OPA on every request.

Important distinction (see main.py): only violations attributable to the
AGENT (bad signature, replayed nonce, expired commitment, an OPA policy
denial from a working OPA, an inactive on-chain BAA) count here. Failures
that are OUR infrastructure's fault (OPA unreachable, chain RPC unreachable)
must still deny the individual request (fail closed) but must NOT trip the
breaker -- otherwise an OPA outage would lock out every well-behaved agent
in the fleet for the lockout window, which is its own denial-of-service bug.
"""

from __future__ import annotations

import time
from dataclasses import dataclass


@dataclass
class _AgentState:
    violation_count: int = 0
    locked_out_until: float | None = None  # monotonic time.time() seconds


class AgentCircuitBreaker:
    def __init__(self, violation_threshold: int = 3, lockout_duration_seconds: int = 900):
        self.violation_threshold = violation_threshold
        self.lockout_duration_seconds = lockout_duration_seconds
        self._agents: dict[str, _AgentState] = {}

    def is_locked_out(self, agent_id: str) -> bool:
        state = self._agents.get(agent_id)
        if state is None or state.locked_out_until is None:
            return False
        if time.time() >= state.locked_out_until:
            # Lockout has naturally expired -- clear it so the agent gets a
            # clean slate rather than an instantly-re-triggered lockout.
            state.locked_out_until = None
            state.violation_count = 0
            return False
        return True

    def lockout_remaining_seconds(self, agent_id: str) -> float:
        state = self._agents.get(agent_id)
        if state is None or state.locked_out_until is None:
            return 0.0
        return max(0.0, state.locked_out_until - time.time())

    def record_violation(self, agent_id: str) -> None:
        state = self._agents.setdefault(agent_id, _AgentState())
        state.violation_count += 1
        if state.violation_count >= self.violation_threshold:
            state.locked_out_until = time.time() + self.lockout_duration_seconds

    def reset(self, agent_id: str | None = None) -> None:
        """Test/admin hook. Resets one agent, or the whole breaker if agent_id is None."""
        if agent_id is None:
            self._agents.clear()
        else:
            self._agents.pop(agent_id, None)
