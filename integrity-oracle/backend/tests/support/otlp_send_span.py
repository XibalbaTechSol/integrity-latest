#!/usr/bin/env python3
"""
Test support: sends ONE real span to a live OTLP/gRPC endpoint using the SDK's actual,
unmodified exporter machinery (`opentelemetry-exporter-otlp-proto-grpc`) with a
`SimpleSpanProcessor` (synchronous export, so this process's exit code/stderr reflects
the real export result rather than a fire-and-forget batch outcome) — deliberately NOT
a hand-rolled tonic/gRPC client, since the point is proving the receiver's resource-
attribute extraction agrees with what the real SDK sends.

Args (all via argv): otlp_endpoint (host:port), agent_id, mode ("real" | "phi" | "nested")
  "real":   a clean span named "verify-span" with a benign attribute.
  "phi":    a span carrying an unredacted SSN in an attribute — must be rejected by the
            receiver's PHI backstop; this script's own exit reflects the exporter's
            real INVALID_ARGUMENT error (printed to stderr by the OTel SDK itself).
  "nested": a real 3-level parent/child/grandchild span tree (genuine OTel context
            propagation, not hand-constructed parent_span_id fields) for exercising
            GET /v1/traces/{trace_id}. Prints the trace_id (hex) to stdout on success.
"""

import sys

from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import format_trace_id


def main() -> None:
    endpoint = sys.argv[1]
    agent_id = sys.argv[2]
    mode = sys.argv[3]

    resource = Resource.create({"service.name": "integrity-agent", "integrity.agent.id": agent_id})
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer("otlp-send-span")

    if mode == "real":
        with tracer.start_as_current_span("verify-span") as span:
            span.set_attribute("test.marker", "otlp-e2e-verify")
    elif mode == "phi":
        with tracer.start_as_current_span("phi-span") as span:
            span.set_attribute("prompt", "patient ssn is 123-45-6789")
    elif mode == "nested":
        # Real OTel context propagation (nested `with` blocks), not hand-constructed
        # parent_span_id fields — proves the receiver's parent/child linkage is
        # extracted correctly from genuine SDK-generated spans.
        with tracer.start_as_current_span("agent-run") as root:
            trace_id = format_trace_id(root.get_span_context().trace_id)
            with tracer.start_as_current_span("llm-call") as child:
                child.set_attribute("model", "test-model")
                with tracer.start_as_current_span("tool-call"):
                    pass
        print(trace_id)
    else:
        raise ValueError(f"unknown mode: {mode}")


if __name__ == "__main__":
    main()
