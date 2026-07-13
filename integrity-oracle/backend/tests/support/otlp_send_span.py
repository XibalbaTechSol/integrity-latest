#!/usr/bin/env python3
"""
Test support: sends ONE real span to a live OTLP/gRPC endpoint using the SDK's actual,
unmodified exporter machinery (`opentelemetry-exporter-otlp-proto-grpc`) with a
`SimpleSpanProcessor` (synchronous export, so this process's exit code/stderr reflects
the real export result rather than a fire-and-forget batch outcome) — deliberately NOT
a hand-rolled tonic/gRPC client, since the point is proving the receiver's resource-
attribute extraction agrees with what the real SDK sends.

Args (all via argv): otlp_endpoint (host:port), agent_id, mode ("real" | "phi")
  "real": a clean span named "verify-span" with a benign attribute.
  "phi":  a span carrying an unredacted SSN in an attribute — must be rejected by the
          receiver's PHI backstop; this script's own exit reflects the exporter's
          real INVALID_ARGUMENT error (printed to stderr by the OTel SDK itself).
"""

import sys

from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor


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
    else:
        raise ValueError(f"unknown mode: {mode}")


if __name__ == "__main__":
    main()
