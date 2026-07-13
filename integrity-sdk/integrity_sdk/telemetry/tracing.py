"""
LangSmith-shaped run tracing, built on top of this SDK's existing OTel wiring.

Why this shape: LangSmith's `@traceable` decorator + run-tree model is the
de facto pattern for agent observability — a top-level agent invocation is a
"run", and every tool call / sub-step it makes while executing is a *child*
run nested underneath it, forming a tree. That tree is what makes a single
agent action and all its sub-steps show up as one connected trace instead of
a pile of unrelated log lines. We adopt the same ergonomics (`@traceable`,
automatic input/output/latency/error capture, parent-child nesting) without
depending on the `langsmith` package or its hosted backend:

  - Spans still go through `telemetry/core.py`'s real OTel `TracerProvider` —
    OTel already handles nesting correctly within a process via `contextvars`
    (`start_as_current_span` reads/writes the ambient span context), so we
    get "child span inside parent span" for free by using it as designed.
  - In parallel, we track an explicit, plain-dict "run tree" (run_id,
    parent_run_id, name, run_type, inputs, outputs, error, timing) because
    OTel spans require a collector to *see* them (none may be running in a
    given deployment), whereas a plain nested structure is exactly what the
    telemetry envelope this SDK already batches and POSTs to integrity-oracle
    can carry regardless of OTel collector availability.

No network call to smith.langchain.com, no LangSmith API key, no hard
dependency on the `langsmith` PyPI package — this is the pattern, implemented
locally and pluggably. If a project wants to ALSO export to real LangSmith,
that's a matter of adding another OTel exporter / span processor in
`telemetry/core.py`; nothing here precludes it.
"""

from __future__ import annotations

import contextvars
import functools
import inspect
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional

from ..security.redactor import redact_text
from .core import get_tracer

# Tracks the currently-active run's id within this logical call stack.
# `contextvars` (rather than a plain thread-local) is what lets this nest
# correctly across `asyncio` tasks too, matching how OTel's own context
# propagation works — a child task inherits the parent's context snapshot.
_current_run_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "integrity_sdk_current_run_id", default=None
)


@dataclass
class TraceRun:
    """One node in the run tree. Mirrors LangSmith's run object closely
    enough to be familiar (`run_id`, `parent_run_id`, `run_type`, `inputs`,
    `outputs`, `error`) while staying a plain dataclass with no server
    round-trip required to construct or finish one."""

    name: str
    run_type: str = "chain"
    run_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    parent_run_id: Optional[str] = None
    inputs: Dict[str, Any] = field(default_factory=dict)
    outputs: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None

    def set_outputs(self, outputs: Any) -> None:
        """Record a return value as this run's `outputs`. Wrapped so a
        non-dict return (the common case — most functions don't return a
        dict) still ends up as a JSON-shaped telemetry field.

        FIXED 2026-07-11: this used to store the raw return value verbatim.
        `integrations/openai_integrity.py`/`langchain_callback.py` already
        called `security.redactor.redact_text` before touching a span
        attribute or telemetry field, but this — the SDK's own documented,
        *recommended* general-purpose tracing API ("Prefer
        `IntegrityClient.traceable(...)`", client.py) — did not, despite
        `docs/wiki/concepts/observability-vtl.md` claiming redaction was
        "wired into both instrumentation paths." Any consumer decorating
        their own LLM-calling function with `@client.traceable(...)` was
        forwarding raw, unredacted return values toward the oracle. See
        `_capture_inputs` below for the matching fix on the input side."""
        value = outputs if isinstance(outputs, dict) else {"value": outputs}
        self.outputs = _redact_value(value)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "parent_run_id": self.parent_run_id,
            "name": self.name,
            "run_type": self.run_type,
            "inputs": self.inputs,
            "outputs": self.outputs,
            "error": self.error,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "latency_ms": (
                round((self.end_time - self.start_time) * 1000, 3)
                if self.end_time is not None
                else None
            ),
        }


class trace_run:
    """
    Context manager form: `with trace_run("fetch_price", run_type="tool", client=c) as run: ...`

    Handles: starting a real OTel span (nested automatically under whatever
    span, if any, is already active), assigning this run a parent from
    whatever run is currently active in this context, capturing an
    exception if the body raises (re-raised after recording — this never
    swallows errors), and — if `client` is given — pushing the finished run
    into the client's trace buffer so it rides along on the next telemetry
    flush to integrity-oracle.
    """

    def __init__(
        self,
        name: str,
        run_type: str = "chain",
        inputs: Optional[Dict[str, Any]] = None,
        client: Optional[Any] = None,
    ):
        self._client = client
        parent_id = _current_run_id.get()
        self.run = TraceRun(name=name, run_type=run_type, parent_run_id=parent_id, inputs=inputs or {})
        self._token: Optional[contextvars.Token] = None
        self._span_cm = None
        self._span = None

    def __enter__(self) -> TraceRun:
        self._token = _current_run_id.set(self.run.run_id)
        tracer = get_tracer("integrity_sdk.tracing")
        self._span_cm = tracer.start_as_current_span(self.run.name)
        self._span = self._span_cm.__enter__()
        self._span.set_attribute("integrity.run_id", self.run.run_id)
        self._span.set_attribute("integrity.run_type", self.run.run_type)
        if self.run.parent_run_id:
            self._span.set_attribute("integrity.parent_run_id", self.run.parent_run_id)
        return self.run

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        self.run.end_time = time.time()
        if exc_val is not None:
            self.run.error = f"{exc_type.__name__}: {exc_val}"
            if self._span is not None:
                self._span.record_exception(exc_val)
                self._span.set_attribute("integrity.run_error", self.run.error)

        if self._span_cm is not None:
            self._span_cm.__exit__(exc_type, exc_val, exc_tb)
        if self._token is not None:
            _current_run_id.reset(self._token)

        if self._client is not None:
            self._client._record_trace_run(self.run.to_dict())

        # Returning False (falsy) re-raises any exception from the `with`
        # body — tracing must never silently swallow an agent error.
        return False


def traceable(
    name: Optional[str] = None,
    run_type: str = "chain",
    client: Optional[Any] = None,
):
    """
    Decorator form: `@traceable(name="lookup_price", run_type="tool", client=my_client)`

    Captures the wrapped function's arguments as `inputs`, its return value
    as `outputs`, wall-clock latency, and any raised exception — then
    re-raises. Composes with nesting exactly like `trace_run`: a `@traceable`
    function calling another `@traceable` function produces a parent/child
    pair in the run tree, whether or not `client` was passed to either
    (nesting is tracked via `_current_run_id` regardless; `client` only
    controls whether finished runs get forwarded to a telemetry buffer).

    Prefer `IntegrityClient.traceable(...)` (see client.py) over calling
    this directly with `client=` wired up by hand — it's the same function,
    just pre-bound to `self`.
    """

    def decorator(func: Callable) -> Callable:
        run_name = name or func.__name__

        if inspect.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                inputs = _capture_inputs(func, args, kwargs)
                with trace_run(run_name, run_type=run_type, inputs=inputs, client=client) as run:
                    result = await func(*args, **kwargs)
                    run.set_outputs(result)
                    return result

            return async_wrapper

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            inputs = _capture_inputs(func, args, kwargs)
            with trace_run(run_name, run_type=run_type, inputs=inputs, client=client) as run:
                result = func(*args, **kwargs)
                run.set_outputs(result)
                return result

        return sync_wrapper

    return decorator


def _capture_inputs(func: Callable, args: tuple, kwargs: dict) -> Dict[str, Any]:
    """Best-effort capture of call arguments as a JSON-shapeable dict, bound
    by parameter name via `inspect.signature` so `inputs` reads like
    `{"query": "...", "top_k": 5}` rather than an opaque positional tuple.
    Falls back to a coarse repr if a value isn't reasonably serializable —
    tracing must never crash the traced call because an argument was
    unusual (e.g. a file handle, a lock). Redacted before returning — see
    `TraceRun.set_outputs`'s docstring for why (same 2026-07-11 fix, input
    side)."""
    try:
        bound = inspect.signature(func).bind_partial(*args, **kwargs)
        bound.apply_defaults()
        captured = {}
        for k, v in bound.arguments.items():
            if k in ("self", "cls"):
                continue
            try:
                captured[k] = v if _is_plain_jsonish(v) else repr(v)
            except Exception:
                captured[k] = "<unrepresentable>"
        return _redact_value(captured)
    except Exception:
        return {}


def _is_plain_jsonish(value: Any) -> bool:
    return isinstance(value, (str, int, float, bool, type(None), list, dict, tuple))


def _redact_value(value: Any) -> Any:
    """Recursively applies `security.redactor.redact_text` to every string
    leaf in an arbitrarily-nested JSON-ish structure (dict/list/tuple of
    str/int/float/bool/None), leaving non-string leaves untouched. Shared by
    `TraceRun.set_outputs` and `_capture_inputs` — the two places this
    module hands arbitrary caller data to the telemetry pipeline."""
    if isinstance(value, str):
        return redact_text(value).text
    if isinstance(value, dict):
        return {k: _redact_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        redacted = [_redact_value(v) for v in value]
        return type(value)(redacted) if isinstance(value, tuple) else redacted
    return value
