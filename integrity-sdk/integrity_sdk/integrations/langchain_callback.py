"""
LangChain integration: a callback handler that logs LLM interactions to an
`IntegrityClient` automatically. Real, working glue code (not one of the
previously-mocked pieces) — kept functionally equivalent to the old
prototype, with graceful degradation if `langchain_core` isn't installed
(this SDK doesn't want to force a LangChain dependency on every user).
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List

from ..security.redactor import redact_text

logger = logging.getLogger("integrity_sdk.integrations.langchain_callback")

try:
    from langchain_core.callbacks.base import BaseCallbackHandler
    from langchain_core.outputs import LLMResult
except ImportError:
    class BaseCallbackHandler:  # type: ignore[no-redef]
        pass

    LLMResult = Any  # type: ignore[assignment,misc]


class IntegrityLangChainCallback(BaseCallbackHandler):
    """
    Usage:
        client = IntegrityClient(agent_id="my-agent")
        callback = IntegrityLangChainCallback(client)
        llm = ChatOpenAI(callbacks=[callback])
    """

    def __init__(self, integrity_client):
        self.client = integrity_client
        self.start_times: Dict[str, float] = {}

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any) -> None:
        run_id = str(kwargs.get("run_id", "default"))
        self.start_times[run_id] = time.time()

    def on_chat_model_start(self, serialized: Dict[str, Any], messages: List[List[Any]], **kwargs: Any) -> None:
        run_id = str(kwargs.get("run_id", "default"))
        self.start_times[run_id] = time.time()

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        run_id = str(kwargs.get("run_id", "default"))
        start_time = self.start_times.pop(run_id, time.time())
        latency_ms = (time.time() - start_time) * 1000

        try:
            for generation in response.generations:
                for gen in generation:
                    # Redact before this ever reaches log_telemetry — see
                    # security/redactor.py. Applies to both the completion
                    # text and any model-reported reasoning trace.
                    text_output = redact_text(gen.text).text
                    reasoning_content = None
                    if hasattr(gen, "message") and hasattr(gen.message, "additional_kwargs"):
                        raw_reasoning = gen.message.additional_kwargs.get("reasoning_content")
                        if raw_reasoning:
                            reasoning_content = redact_text(raw_reasoning).text

                    token_usage = response.llm_output.get("token_usage", {}) if response.llm_output else {}
                    model_name = (
                        response.llm_output.get("model_name", "langchain-generic")
                        if response.llm_output
                        else "langchain-generic"
                    )

                    self.client.log_telemetry(
                        metadata={
                            "text_output": text_output,
                            "token_usage": token_usage,
                            "model_name": model_name,
                            "framework": "langchain",
                            "run_id": run_id,
                            "latency_ms": latency_ms,
                            "reasoning_content": reasoning_content,
                        }
                    )
        except Exception as e:
            # Telemetry extraction must never crash the agent's actual run.
            logger.warning(f"[IntegrityLangChainCallback] Failed to extract telemetry: {e}")

    def on_llm_error(self, error: Exception, **kwargs: Any) -> None:
        run_id = str(kwargs.get("run_id", "default"))
        start_time = self.start_times.pop(run_id, time.time())
        latency_ms = (time.time() - start_time) * 1000

        self.client.log_telemetry(
            metadata={
                "framework": "langchain",
                "error": str(error),
                "latency_ms": latency_ms,
                "status": "failed",
            }
        )
