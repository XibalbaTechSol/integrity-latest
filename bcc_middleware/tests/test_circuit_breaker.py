"""Tests for app/circuit_breaker.py and app/nonce_store.py."""

import time

from app.circuit_breaker import AgentCircuitBreaker
from app.nonce_store import NonceStore


def test_agent_not_locked_out_below_threshold():
    cb = AgentCircuitBreaker(violation_threshold=3, lockout_duration_seconds=60)
    cb.record_violation("agent-1")
    cb.record_violation("agent-1")
    assert not cb.is_locked_out("agent-1")


def test_agent_locked_out_at_threshold():
    cb = AgentCircuitBreaker(violation_threshold=3, lockout_duration_seconds=60)
    for _ in range(3):
        cb.record_violation("agent-1")
    assert cb.is_locked_out("agent-1")
    assert cb.lockout_remaining_seconds("agent-1") > 0


def test_lockout_does_not_affect_other_agents():
    cb = AgentCircuitBreaker(violation_threshold=1, lockout_duration_seconds=60)
    cb.record_violation("agent-1")
    assert cb.is_locked_out("agent-1")
    assert not cb.is_locked_out("agent-2")


def test_lockout_expires_after_duration():
    cb = AgentCircuitBreaker(violation_threshold=1, lockout_duration_seconds=0)
    cb.record_violation("agent-1")
    time.sleep(0.05)
    assert not cb.is_locked_out("agent-1")


def test_reset_clears_a_single_agent():
    cb = AgentCircuitBreaker(violation_threshold=1, lockout_duration_seconds=60)
    cb.record_violation("agent-1")
    cb.record_violation("agent-2")
    cb.reset("agent-1")
    assert not cb.is_locked_out("agent-1")
    assert cb.is_locked_out("agent-2")


def test_nonce_store_accepts_strictly_increasing_nonces():
    store = NonceStore()
    assert store.check_and_record("agent-1", 1)
    assert store.check_and_record("agent-1", 2)
    assert store.check_and_record("agent-1", 100)


def test_nonce_store_rejects_replay():
    store = NonceStore()
    assert store.check_and_record("agent-1", 5)
    assert not store.check_and_record("agent-1", 5)
    assert not store.check_and_record("agent-1", 3)


def test_nonce_store_is_independent_per_agent():
    store = NonceStore()
    assert store.check_and_record("agent-1", 5)
    assert store.check_and_record("agent-2", 1)  # different agent, no conflict
