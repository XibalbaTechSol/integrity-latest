from __future__ import annotations

from typing import Any, Dict

import pytest

from integrity_sdk import bcc
from integrity_sdk.client import IntegrityClient
from integrity_sdk.did import Keypair, verify_signature


class _FakeResponse:
    def __init__(self, status_ok: bool = True):
        self._ok = status_ok

    def raise_for_status(self):
        if not self._ok:
            import requests

            raise requests.HTTPError("simulated oracle error")


@pytest.fixture
def captured_posts(monkeypatch):
    posts = []

    def _fake_post(url, json=None, timeout=None):
        posts.append({"url": url, "json": json})
        return _FakeResponse(status_ok=True)

    monkeypatch.setattr("integrity_sdk.client.requests.post", _fake_post)
    return posts


def test_log_telemetry_buffers_without_flushing(captured_posts):
    client = IntegrityClient("agent-a", auto_flush=False)
    client.log_telemetry({"text_output": "hello"})
    assert captured_posts == []  # no flush yet


def test_flush_derives_signals_and_posts(captured_posts):
    client = IntegrityClient("agent-a", oracle_url="http://oracle.test", auto_flush=False)
    client.log_telemetry({"text_output": "yes yes yes", "token_usage": {"total_tokens": 1000}})
    assert client.flush_telemetry() is True

    assert len(captured_posts) == 1
    payload = captured_posts[0]["json"]
    assert captured_posts[0]["url"] == "http://oracle.test/v1/telemetry/ingest"
    assert payload["agent_id"] == "agent-a"
    assert payload["nonce"] == 1
    assert set(payload["derived_signals"].keys()) == {"entropy", "grounding", "sacrifice", "compliance"}


def test_nonce_increments_across_flushes(captured_posts):
    client = IntegrityClient("agent-a", auto_flush=False)
    client.log_telemetry({"text_output": "a"})
    client.flush_telemetry()
    client.log_telemetry({"text_output": "b"})
    client.flush_telemetry()
    assert captured_posts[0]["json"]["nonce"] == 1
    assert captured_posts[1]["json"]["nonce"] == 2


def test_flush_with_nothing_buffered_is_noop_success(captured_posts):
    client = IntegrityClient("agent-a", auto_flush=False)
    assert client.flush_telemetry() is True
    assert captured_posts == []


def test_failed_flush_requeues_and_rolls_back_nonce(monkeypatch):
    import requests

    def _failing_post(url, json=None, timeout=None):
        raise requests.ConnectionError("oracle down")

    monkeypatch.setattr("integrity_sdk.client.requests.post", _failing_post)

    client = IntegrityClient("agent-a", auto_flush=False)
    client.log_telemetry({"text_output": "important"})
    assert client.flush_telemetry() is False
    # Nonce rolled back to 0 so the retry reuses nonce 1, not 2.
    assert client._nonce == 0
    # Entry re-queued: a subsequent successful flush should still carry it.
    posts = []
    monkeypatch.setattr(
        "integrity_sdk.client.requests.post",
        lambda url, json=None, timeout=None: posts.append(json) or _FakeResponse(True),
    )
    assert client.flush_telemetry() is True
    assert posts[0]["nonce"] == 1
    assert len([s for s in posts[0]["otel_spans"] if s["kind"] == "telemetry"]) == 1


def test_record_trace_run_rides_along_on_flush(captured_posts):
    client = IntegrityClient("agent-a", auto_flush=False)
    client._record_trace_run({"run_id": "r1", "name": "step"})
    client.flush_telemetry()
    trace_runs = [s for s in captured_posts[0]["json"]["otel_spans"] if s["kind"] == "trace_run"]
    assert trace_runs[0]["run_id"] == "r1"


def test_traceable_wraps_and_records(captured_posts):
    client = IntegrityClient("agent-a", auto_flush=False)

    @client.traceable(name="my_step", run_type="tool")
    def do_work(x: int) -> int:
        return x * 2

    assert do_work(21) == 42
    client.flush_telemetry()
    runs = [s for s in captured_posts[0]["json"]["otel_spans"] if s["kind"] == "trace_run"]
    assert any(r["name"] == "my_step" for r in runs)


def test_flush_without_keypair_sends_empty_signature_string(captured_posts):
    # Confirms the payload at least deserializes against the oracle's real
    # `signature: String` (non-nullable) field -- see flush_telemetry's
    # docstring on why `None` used to break this. An empty string still
    # fails the oracle's own signature check (real, honest 401), which is
    # correct: a client with no keypair genuinely cannot produce a valid one.
    client = IntegrityClient("agent-a", auto_flush=False)
    client.log_telemetry({"text_output": "hi"})
    client.flush_telemetry()
    assert captured_posts[0]["json"]["signature"] == ""


def test_flush_with_keypair_produces_a_real_verifiable_signature(captured_posts):
    keypair = Keypair.generate()
    client = IntegrityClient("agent-a", auto_flush=False, keypair=keypair)
    client.log_telemetry({"text_output": "hi"})
    client.flush_telemetry()

    payload = captured_posts[0]["json"]
    sig_hex = payload["signature"]
    assert sig_hex.startswith("0x")

    # Independently re-derive exactly what the oracle's own ingest_telemetry
    # handler reconstructs (same field set, same canonical_json_bytes
    # convention) and confirm the signature verifies against it.
    signable = {
        "agent_id": payload["agent_id"],
        "nonce": payload["nonce"],
        "otel_spans": payload["otel_spans"],
        "derived_signals": payload["derived_signals"],
        "zk_proof": payload["zk_proof"],
    }
    assert verify_signature(
        keypair.public_bytes(),
        bcc.canonical_json_bytes(signable),
        bytes.fromhex(sig_hex[2:]),
    )


def test_flush_drains_custom_metrics_into_otel_spans(captured_posts):
    client = IntegrityClient("agent-a", auto_flush=False)
    client.log_telemetry({"text_output": "hi"})
    client.record_metric("integrity.intent.plan_adherence", 1.0, tags={"intent_id": "abc"})
    client.flush_telemetry()

    metrics_entries = [s for s in captured_posts[0]["json"]["otel_spans"] if s["kind"] == "custom_metrics"]
    assert len(metrics_entries) == 1
    assert metrics_entries[0]["metrics"]["integrity.intent.plan_adherence"]["value"] == 1.0


# --- invoke_intent convenience method ----------------------------------------------------


def test_invoke_intent_without_keypair_raises_clear_error():
    client = IntegrityClient("agent-a", auto_flush=False)
    with pytest.raises(RuntimeError, match="keypair"):
        with client.invoke_intent(intent_type="EMR_WRITE", intent_payload={}):
            pass


def test_invoke_intent_without_nonce_store_raises_clear_error(tmp_path):
    client = IntegrityClient("agent-a", auto_flush=False, keypair=Keypair.generate())
    with pytest.raises(RuntimeError, match="bcc_nonce_store"):
        with client.invoke_intent(intent_type="EMR_WRITE", intent_payload={}):
            pass


def test_invoke_intent_convenience_pulls_nonce_from_store_and_rides_along_on_flush(captured_posts, tmp_path):
    keypair = Keypair.generate()
    nonce_store = bcc.NonceStore(tmp_path / "bcc_nonce.txt")
    client = IntegrityClient("agent-a", auto_flush=False, keypair=keypair, bcc_nonce_store=nonce_store)

    with client.invoke_intent(intent_type="EMR_WRITE", intent_payload={"a": 1}, planned_action={"tool": "write_emr"}) as intent:
        intent.record_outcome({"tool": "write_emr"})

    client.flush_telemetry()
    trace_runs = [s for s in captured_posts[0]["json"]["otel_spans"] if s["kind"] == "trace_run"]
    assert trace_runs[0]["run_type"] == "intent"
    assert trace_runs[0]["outputs"]["adherence_score"] == 1.0

    metrics_entries = [s for s in captured_posts[0]["json"]["otel_spans"] if s["kind"] == "custom_metrics"]
    assert metrics_entries[0]["metrics"]["integrity.intent.plan_adherence"]["value"] == 1.0
