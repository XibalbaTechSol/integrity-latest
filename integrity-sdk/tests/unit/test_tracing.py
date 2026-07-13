from __future__ import annotations

import pytest

from integrity_sdk.telemetry.tracing import TraceRun, trace_run, traceable


class _FakeClient:
    def __init__(self):
        self.recorded = []

    def _record_trace_run(self, run):
        self.recorded.append(run)


def test_trace_run_captures_timing_and_no_error_on_success():
    with trace_run("step") as run:
        pass
    d = run.to_dict()
    assert d["error"] is None
    assert d["latency_ms"] is not None and d["latency_ms"] >= 0


def test_trace_run_records_and_reraises_exception():
    with pytest.raises(ValueError):
        with trace_run("step") as run:
            raise ValueError("boom")
    assert run.error == "ValueError: boom"


def test_nested_trace_run_sets_parent_run_id():
    with trace_run("outer") as outer:
        with trace_run("inner") as inner:
            pass
    assert inner.parent_run_id == outer.run_id


def test_trace_run_records_to_client_on_exit():
    client = _FakeClient()
    with trace_run("step", client=client):
        pass
    assert len(client.recorded) == 1
    assert client.recorded[0]["name"] == "step"


def test_traceable_captures_inputs_and_outputs():
    client = _FakeClient()

    @traceable(name="add", client=client)
    def add(a: int, b: int) -> int:
        return a + b

    assert add(2, 3) == 5
    run = client.recorded[0]
    assert run["inputs"] == {"a": 2, "b": 3}
    assert run["outputs"] == {"value": 5}


def test_traceable_still_reraises_on_error():
    @traceable(name="failing")
    def failing():
        raise RuntimeError("nope")

    with pytest.raises(RuntimeError):
        failing()


# --- PHI redaction (2026-07-11 fix) -----------------------------------------------------


def test_capture_inputs_redacts_pii_in_string_arguments():
    client = _FakeClient()

    @traceable(name="lookup", client=client)
    def lookup(query: str) -> str:
        return f"found record for {query}"

    lookup("patient email is jane.doe@example.com")
    run = client.recorded[0]
    assert "jane.doe@example.com" not in str(run["inputs"])
    assert "[REDACTED:EMAIL]" in run["inputs"]["query"]


def test_set_outputs_redacts_pii_in_return_value():
    client = _FakeClient()

    @traceable(name="lookup", client=client)
    def lookup() -> str:
        return "call this patient at 555-123-4567"

    lookup()
    run = client.recorded[0]
    assert "555-123-4567" not in str(run["outputs"])
    assert "[REDACTED:PHONE]" in run["outputs"]["value"]


def test_redaction_applies_inside_nested_dict_output():
    client = _FakeClient()

    @traceable(name="lookup", client=client)
    def lookup() -> dict:
        return {"patient": {"contact": "reach me at jane.doe@example.com"}}

    lookup()
    run = client.recorded[0]
    assert "jane.doe@example.com" not in str(run["outputs"])
    assert "[REDACTED:EMAIL]" in run["outputs"]["patient"]["contact"]


def test_redaction_applies_inside_list_of_strings():
    client = _FakeClient()

    @traceable(name="lookup", client=client)
    def lookup() -> list:
        return ["mrn: MRN123456", "no pii here"]

    lookup()
    run = client.recorded[0]
    assert "MRN123456" not in str(run["outputs"])
    assert "[REDACTED:MRN]" in run["outputs"]["value"][0]
    assert run["outputs"]["value"][1] == "no pii here"


def test_redaction_leaves_non_string_leaves_untouched():
    run = TraceRun(name="x")
    run.set_outputs({"count": 5, "ok": True, "score": 0.5, "nothing": None})
    assert run.outputs == {"count": 5, "ok": True, "score": 0.5, "nothing": None}
