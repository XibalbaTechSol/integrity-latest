"""
OpenAI integration: a drop-in `OpenAI` client subclass that transparently
wraps `chat.completions` with OTel spans + behavioral-signal telemetry
logging, covering both streaming and non-streaming calls. Real, working
glue code carried over from the old prototype (not a mocked piece),
tidied up.
"""

from __future__ import annotations

import math
import time
from typing import Any, Dict, Optional

try:
    from openai import OpenAI
    from openai.resources.chat import Completions
except ImportError:
    class OpenAI:  # type: ignore[no-redef]
        def __init__(self, *args, **kwargs):
            pass

    class Completions:  # type: ignore[no-redef]
        def __init__(self, client):
            pass

from ..client import IntegrityClient
from ..telemetry.core import get_tracer
from ..telemetry.conventions import GenAIAttributes, IntegrityAttributes, get_gen_ai_span_name
from ..telemetry.derive import lexical_stability_score, keyword_grounding_score
from ..security.redactor import redact_text


class IntegrityCompletionsWrapper:
    """Wraps the OpenAI completions interface to intercept inference calls
    with OTel spans and behavioral telemetry."""

    def __init__(self, original_completions: Completions, integrity_client: IntegrityClient):
        self.original_completions = original_completions
        self.integrity_client = integrity_client
        self.tracer = get_tracer("integrity_openai_wrapper")

    def create(self, *args, **kwargs):
        start_time = time.time()
        requested_model = kwargs.get("model", "unknown-model")
        span_name = get_gen_ai_span_name("openai", requested_model)

        messages = kwargs.get("messages", [])
        try:
            prompt_text = " ".join(m.get("content", "") for m in messages if isinstance(m, dict))
        except Exception:
            prompt_text = ""
        # Redact before anything downstream (span attributes, behavior
        # metrics, telemetry payload) ever touches this text — see
        # security/redactor.py. Every use of prompt/completion text below
        # this point uses the redacted version, never the raw capture.
        prompt_text = redact_text(prompt_text).text

        if kwargs.get("stream", False):
            response_generator = self.original_completions.create(*args, **kwargs)
            return self._stream_interceptor(response_generator, prompt_text, start_time, requested_model)

        with self.tracer.start_as_current_span(span_name) as span:
            span.set_attribute(GenAIAttributes.SYSTEM, "openai")
            span.set_attribute(GenAIAttributes.REQUEST_MODEL, requested_model)
            span.set_attribute(GenAIAttributes.PROMPT, prompt_text)

            response = self.original_completions.create(*args, **kwargs)

            try:
                completion_text = redact_text(response.choices[0].message.content or "").text
                actual_model = getattr(response, "model", requested_model)

                span.set_attribute(GenAIAttributes.RESPONSE_MODEL, actual_model)
                span.set_attribute(GenAIAttributes.COMPLETION, completion_text)

                usage = getattr(response, "usage", None)
                if usage:
                    span.set_attribute(GenAIAttributes.INPUT_TOKENS, usage.prompt_tokens)
                    span.set_attribute(GenAIAttributes.OUTPUT_TOKENS, usage.completion_tokens)

                self._calculate_and_set_behavior_metrics(span, prompt_text, completion_text)
            except Exception as e:
                span.record_exception(e)

            return response

    def _stream_interceptor(self, generator, prompt_text: str, start_time: float, requested_model: str):
        span_name = get_gen_ai_span_name("openai", requested_model)
        span = self.tracer.start_span(span_name)
        span.set_attribute(GenAIAttributes.SYSTEM, "openai")
        span.set_attribute(GenAIAttributes.REQUEST_MODEL, requested_model)
        span.set_attribute(GenAIAttributes.PROMPT, prompt_text)

        collected_chunks = []
        actual_model = requested_model
        chunk_latencies = []
        last_chunk_time = start_time
        ttft = 0.0

        try:
            for chunk in generator:
                now = time.time()
                chunk_latencies.append((now - last_chunk_time) * 1000)
                if not collected_chunks:
                    ttft = (now - start_time) * 1000
                last_chunk_time = now
                yield chunk
                try:
                    if chunk.choices and chunk.choices[0].delta.content:
                        collected_chunks.append(chunk.choices[0].delta.content)
                    if getattr(chunk, "model", None):
                        actual_model = chunk.model
                except Exception:
                    pass
        finally:
            completion_text = redact_text("".join(collected_chunks)).text
            total_latency_ms = (time.time() - start_time) * 1000

            jitter = 0.0
            if len(chunk_latencies) > 1:
                avg = sum(chunk_latencies[1:]) / (len(chunk_latencies) - 1)
                variance = sum((x - avg) ** 2 for x in chunk_latencies[1:]) / (len(chunk_latencies) - 1)
                jitter = math.sqrt(variance)

            span.set_attribute(GenAIAttributes.RESPONSE_MODEL, actual_model)
            span.set_attribute(GenAIAttributes.COMPLETION, completion_text)
            span.set_attribute("gen_ai.usage.ttft_ms", ttft)
            span.set_attribute("gen_ai.usage.token_jitter_ms", jitter)

            self._calculate_and_set_behavior_metrics(
                span,
                prompt_text,
                completion_text,
                {
                    "ttft_ms": ttft,
                    "token_jitter_ms": jitter,
                    "tokens_per_sec": (
                        len(collected_chunks) / (total_latency_ms / 1000.0) if total_latency_ms > 0 else 0
                    ),
                },
            )
            span.end()

    def _calculate_and_set_behavior_metrics(
        self, span, prompt: str, completion: str, extra_metrics: Optional[Dict] = None
    ):
        extra_metrics = extra_metrics or {}
        # Single source of truth for these two heuristics now lives in
        # telemetry/derive.py — this wrapper used to compute a cruder
        # type-token ratio (len(set(words))/len(words)) inline, which could
        # silently drift from the batch-level derivation the oracle receives.
        # Both now call the same functions.
        entropy = lexical_stability_score(completion)
        grounding = keyword_grounding_score(completion)

        if span:
            span.set_attribute(IntegrityAttributes.ENTROPY, entropy)
            span.set_attribute(IntegrityAttributes.GROUNDING, grounding)

        log_metadata: Dict[str, Any] = {
            "prompt_length_chars": len(prompt),
            "completion_length_chars": len(completion),
            "provider": "openai-integrity-wrapper",
            "text_output": completion,
        }
        log_metadata.update(extra_metrics)

        self.integrity_client.log_telemetry(metadata=log_metadata, entropy=entropy, grounding=grounding)


class IntegrityOpenAI(OpenAI):
    """Drop-in OpenAI client wrapper with non-blocking telemetry."""

    def __init__(self, *args, agent_id: str = "openai_agent_edge", oracle_url: str = "http://localhost:8080", **kwargs):
        super().__init__(*args, **kwargs)
        self.integrity_client = IntegrityClient(agent_id=agent_id, oracle_url=oracle_url)

        if hasattr(self, "chat") and hasattr(self.chat, "completions"):
            self.chat.completions = IntegrityCompletionsWrapper(
                original_completions=self.chat.completions,
                integrity_client=self.integrity_client,
            )
