"""
IntegrityClient: the SDK's telemetry client — the piece that ties the OTel
run-tree tracing (telemetry/tracing.py), the edge batcher (batcher.py), the
AIS-signal derivation (telemetry/derive.py), and the oracle's
`POST /v1/telemetry/ingest` endpoint together.

Before this module existed, `telemetry/tracing.py` referenced
`client._record_trace_run(...)`, `integrations/openai_integrity.py` and
`integrations/langchain_callback.py` referenced `client.log_telemetry(...)`,
and `telemetry/metrics.py`'s docstring referenced `client.py`'s
`_process_and_send` — all dangling references to a client that was never
written in this rewrite. This closes them: those are the real methods below.

Telemetry here is best-effort observability, NOT part of the trust chain
(unlike the BCC/OPA/ZK/attestation paths, which fail closed) — a flush that
can't reach the oracle logs a warning and re-queues, it never crashes the
agent's actual work. That asymmetry is deliberate and matches
bcc_middleware's own fail-closed-vs-best-effort split.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import requests

from . import bcc
from .batcher import TelemetryBatcher
from .did import Keypair
from .telemetry import derive, intent as intent_module, metrics as metrics_module, tracing

logger = logging.getLogger("integrity_sdk.client")


class IntegrityClient:
    """
    Buffers per-inference telemetry and finished trace runs, derives the four
    AIS input signals from a batch, and flushes them to integrity-oracle.

    Deliberately does NOT block the agent's hot path: `log_telemetry` and
    `_record_trace_run` only append to an in-memory queue (see batcher.py);
    the network POST happens in `flush_telemetry`, which a caller invokes
    explicitly (or which fires automatically once the batcher's size/time
    threshold trips, checked on each `log_telemetry`).
    """

    def __init__(
        self,
        agent_id: str,
        oracle_url: Optional[str] = None,
        *,
        auto_flush: bool = True,
        batch_size_limit: int = 50,
        flush_interval_sec: float = 5.0,
        keypair: Optional[Keypair] = None,
        bcc_nonce_store: Optional[Any] = None,
    ):
        self.agent_id = agent_id
        self.oracle_url = (oracle_url or os.getenv("ORACLE_URL", "http://localhost:8080")).rstrip("/")
        self._batcher = TelemetryBatcher(batch_size_limit=batch_size_limit, flush_interval_sec=flush_interval_sec)
        self._trace_runs: List[Dict[str, Any]] = []
        self._auto_flush = auto_flush
        # Monotonic per-flush nonce, so the oracle's replay protection (see
        # db.rs's insert_telemetry_event nonce check) has a strictly-increasing
        # value per agent. Starts at a wall-clock-independent 0 and only ever
        # increments — the oracle rejects any nonce <= the last one it saw.
        self._nonce = 0
        # Escape-hatch metric recording (telemetry/metrics.py) — was fully
        # built but never actually wired into this client (see flush_telemetry's
        # docstring on where its drained output now goes). Fixed here rather
        # than left as another dangling reference.
        self._metrics = metrics_module.MetricsRegistry()
        # Optional: only needed to call `invoke_intent`. `keypair` signs BCC
        # commitments (see bcc.py — a DIFFERENT keypair concern from the
        # telemetry-envelope signing gap `flush_telemetry` already documents
        # as unresolved); `bcc_nonce_store` is a `bcc.NonceStore` providing
        # the BCC-specific monotonic nonce, which is intentionally a SEPARATE
        # counter from `self._nonce` above (docs/INTERFACE_CONTRACT.md keeps
        # the BCC replay-protection nonce and the telemetry-ingestion nonce
        # as distinct spaces — conflating them would let a used-up BCC nonce
        # block an unrelated telemetry flush, or vice versa).
        self._keypair = keypair
        self._bcc_nonce_store = bcc_nonce_store

    def log_telemetry(
        self,
        metadata: Dict[str, Any],
        *,
        entropy: Optional[float] = None,
        grounding: Optional[float] = None,
    ) -> None:
        """Append one telemetry entry to the batch. `metadata` carries the
        raw per-call context (completion text, token usage, model, framework,
        etc — see integrations/); `entropy`/`grounding` are optional
        pre-computed signals an integration may supply if it already had the
        completion text at hand (see derive.py's `_entry_entropy`)."""
        entry: Dict[str, Any] = {"metadata": metadata}
        if entropy is not None:
            entry["entropy"] = entropy
        if grounding is not None:
            entry["grounding"] = grounding
        self._batcher.add_telemetry(entry)

        if self._auto_flush and self._batcher.should_flush():
            self.flush_telemetry()

    def _record_trace_run(self, run: Dict[str, Any]) -> None:
        """Called by telemetry/tracing.py's `trace_run`/`traceable` when a run
        finishes, if this client was passed in. Buffers the finished run so it
        rides along on the next telemetry flush as part of the OTel span
        payload."""
        self._trace_runs.append(run)

    def traceable(self, name: Optional[str] = None, run_type: str = "chain"):
        """Pre-bound convenience wrapper over telemetry/tracing.py's
        `traceable`, with this client already wired in as the trace sink — the
        form that module's own docstring recommends callers prefer."""
        return tracing.traceable(name=name, run_type=run_type, client=self)

    def define_metric(self, name: str, *, aggregation: str = "last", unit: Optional[str] = None, description: Optional[str] = None) -> None:
        """Pre-bound convenience over telemetry/metrics.py's `MetricsRegistry.define` —
        optional; `record_metric` auto-registers an implicit definition on first use."""
        self._metrics.define(metrics_module.MetricDefinition(name=name, aggregation=aggregation, unit=unit, description=description))

    def record_metric(self, name: str, value: float, tags: Optional[Dict[str, str]] = None) -> None:
        """
        Pre-bound convenience over telemetry/metrics.py's `MetricsRegistry.record`.
        Recorded values are drained and attached to the `otel_spans` array on
        the next `flush_telemetry` call (see that method) — this is the
        open-ended escape hatch for anything beyond the four fixed AIS
        signals, e.g. `IntentInvocation.record_outcome`'s plan-adherence score.
        """
        self._metrics.record(name, value, tags)

    def invoke_intent(
        self,
        *,
        intent_type: str,
        intent_payload: Dict[str, Any],
        goal: Optional[str] = None,
        plan: Optional[List[str]] = None,
        planned_action: Optional[Dict[str, Any]] = None,
        policy_scope: Optional[List[str]] = None,
        reasoning: Optional[str] = None,
        covered_entity_address: Optional[str] = None,
    ):
        """
        Pre-bound convenience over telemetry/intent.py's `invoke_intent`, with
        this client's `keypair`/`bcc_nonce_store` (see `__init__`) and `self`
        already wired in — the same "same function, pre-bound to self" pattern
        `traceable` above already establishes. Raises `RuntimeError` if this
        client wasn't constructed with both `keypair` and `bcc_nonce_store` —
        BCC commitments cannot be built or nonce-tracked without them, and
        this fails loudly rather than silently skipping the intent gate.
        """
        if self._keypair is None or self._bcc_nonce_store is None:
            raise RuntimeError(
                "invoke_intent requires this IntegrityClient to have been constructed with "
                "both keypair= and bcc_nonce_store= (see bcc.NonceStore) — neither was provided."
            )
        return intent_module.invoke_intent(
            intent_type=intent_type,
            intent_payload=intent_payload,
            keypair=self._keypair,
            nonce=self._bcc_nonce_store.next(),
            agent_id=self.agent_id,
            goal=goal,
            plan=plan,
            planned_action=planned_action,
            policy_scope=policy_scope,
            reasoning=reasoning,
            covered_entity_address=covered_entity_address,
            client=self,
        )

    def flush_telemetry(
        self,
        *,
        zk_proof: Optional[Dict[str, Any]] = None,
        compliance_gate_address: Optional[str] = None,
        covered_entity_address: Optional[str] = None,
        w3: Optional[Any] = None,
    ) -> bool:
        """
        Drains the current batch, derives the four AIS signals from it, and
        POSTs to `{oracle_url}/v1/telemetry/ingest`.

        FIXED 2026-07-11 — this method was shipping a request the real oracle
        could never accept, on two independent counts, confirmed against
        `integrity-oracle/backend/src/handlers.rs`'s actual
        `TelemetryIngestRequest` struct and its own real-HTTP e2e test
        (`tests/e2e.rs`, which hand-builds a request in the *correct* shape —
        that's what exposed this):
          1. `otel_spans` is typed `Vec<serde_json::Value>` (a JSON array) on
             the oracle side. This method was sending a JSON *object*
             (`{"telemetry": [...], "trace_runs": [...]}`) — Axum's JSON
             extractor rejects that at deserialization, before the handler
             ever runs. Fixed: both lists are now flattened into one tagged
             array (`{"kind": "telemetry"|"trace_run", ...}` per element) —
             the oracle stores this column as opaque JSONB and never
             destructures individual elements, so any array shape works; the
             tag is for a human/future-code reader distinguishing the two
             origins, not a schema requirement.
          2. `signature` is a required `String` on the oracle side, not
             `Option<String>` — this method was sending `None`/`null`, a
             second, independent deserialization failure. Worse: even a
             syntactically-valid empty string would still fail, since
             `ingest_telemetry`'s handler calls `crypto::verify_agent_signature`
             and returns 401 on a bad signature — the "handler currently
             treats the signature as optional" claim this docstring used to
             make was simply wrong. Fixed: if `self._keypair` was provided at
             construction, this method now signs the canonical JSON of
             `{agent_id, nonce, otel_spans, derived_signals, zk_proof}` —
             same field set, same `bcc.canonical_json_bytes` convention the
             oracle's own `crypto::canonical_json_bytes` mirrors (sorted
             keys, no whitespace) — exactly as `ingest_telemetry`'s handler
             reconstructs and checks it. Without a keypair, this still sends
             an empty-string signature (so the request at least
             *deserializes*) and will get a real, honest 401 from the oracle,
             which the existing failure/re-queue path below already handles
             — construct this client with `keypair=` to actually succeed.

        Known remaining narrower gap, not fixed here: Rust's `serde_json`
        does not escape non-ASCII characters by default, while this SDK's
        canonicalization (matching `bcc.py`, shared for consistency) uses
        `ensure_ascii=True`. For telemetry content containing non-ASCII text,
        the two sides' canonical bytes — and therefore the signature — could
        disagree. Not exercised by any current test; flagged rather than
        silently assumed fine, same as `bcc.py`'s own canonicalization
        docstring already does for a related concern.

        Also now drains `telemetry/metrics.py`'s `MetricsRegistry` (see
        `record_metric`) into the same tagged `otel_spans` array — that
        module was fully built but never wired into any flush path at all
        until now (a separate dangling-reference gap from the two above).

        Returns True if the oracle accepted the batch, False on any failure
        (logged + re-queued, never raised) — telemetry is best-effort.
        """
        batch = self._batcher.get_batch_and_clear()
        trace_runs = self._trace_runs
        self._trace_runs = []
        custom_metrics = self._metrics.drain()

        if not batch and not trace_runs and not custom_metrics:
            return True  # nothing to flush is a success, not a failure

        self._nonce += 1
        derived = derive.derive_ais_signals(
            batch,
            compliance_gate_address=compliance_gate_address,
            covered_entity_address=covered_entity_address,
            w3=w3,
        )

        # One flat, opaque-to-the-oracle array — see docstring point 1.
        otel_spans: List[Dict[str, Any]] = (
            [{"kind": "telemetry", **entry} for entry in batch]
            + [{"kind": "trace_run", **run} for run in trace_runs]
            + ([{"kind": "custom_metrics", "metrics": custom_metrics}] if custom_metrics else [])
        )

        signable = {
            "agent_id": self.agent_id,
            "nonce": self._nonce,
            "otel_spans": otel_spans,
            "derived_signals": derived,
            "zk_proof": zk_proof,
        }
        if self._keypair is not None:
            signature = "0x" + self._keypair.sign(bcc.canonical_json_bytes(signable)).hex()
        else:
            signature = ""  # deserializes fine; the oracle will 401 it (see docstring point 2)

        payload = {**signable, "signature": signature}

        try:
            resp = requests.post(f"{self.oracle_url}/v1/telemetry/ingest", json=payload, timeout=10)
            resp.raise_for_status()
            return True
        except requests.RequestException as exc:
            # Re-queue the drained batch so a later flush retries it — a
            # transient oracle outage shouldn't silently drop telemetry.
            # (Trace runs and custom metrics are best-effort-only and not
            # re-queued; they're observability sugar, not the signal-bearing
            # payload.)
            for entry in batch:
                self._batcher.add_telemetry(entry)
            self._nonce -= 1  # roll back so the retry reuses this nonce
            logger.warning("telemetry flush to %s failed, re-queued %d entries: %s", self.oracle_url, len(batch), exc)
            return False
