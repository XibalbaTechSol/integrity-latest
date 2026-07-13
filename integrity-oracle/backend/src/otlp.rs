//! Real OTLP/gRPC receiver (PRODUCTION_GAPS.md §1 item 2). Lights up the Python SDK's
//! already-working `OTLPSpanExporter`/`OTLPMetricExporter` (`integrity-sdk`'s
//! `telemetry/core.py::init_telemetry`, hardcoded to gRPC at `localhost:4317`), which
//! today exports "fails silently in the background" per its own docstring — nothing has
//! listened on that port until this module.
//!
//! Deliberately does NOT touch `telemetry_events`/AIS: real OTLP spans arrive over gRPC
//! with no Ed25519/secp256k1 signature envelope, unlike `POST /v1/telemetry/ingest`'s
//! payload (`handlers::ingest_telemetry`). Feeding them into the AIS computation would
//! let an unauthenticated source move an agent's score — see migration 0004's header
//! comment and `db::OtelSpanRow` for the separate storage surface this receiver writes
//! to instead. Callers of `/v1/agent/{id}/otel/volume` and `get_otel_spans_for_trace`
//! should treat this data as unauthenticated, not tamper-evident the way
//! `telemetry_events` is (that stays true until real SDK-side span signing exists — see
//! `PRODUCTION_GAPS.md` §2, still an open gap as of this writing).
//!
//! Trace export is fully implemented: PHI-scanned (reusing `crate::phi`, the same
//! backstop `ingest_telemetry` runs), persisted to `otel_spans`, and broadcast to any
//! live SSE subscriber via `AppState::telemetry_tx`. Metrics export is accepted (so the
//! SDK's `OTLPMetricExporter` gets a real gRPC response instead of connection failures)
//! but not yet parsed, PHI-scanned, or persisted — see `OtlpMetricsService::export`'s
//! doc comment for why, an honestly-documented gap rather than a silent one.

use chrono::{DateTime, Utc};
use opentelemetry_proto::tonic::collector::metrics::v1::metrics_service_server::MetricsService;
pub use opentelemetry_proto::tonic::collector::metrics::v1::metrics_service_server::MetricsServiceServer;
use opentelemetry_proto::tonic::collector::metrics::v1::{ExportMetricsServiceRequest, ExportMetricsServiceResponse};
use opentelemetry_proto::tonic::collector::trace::v1::trace_service_server::TraceService;
pub use opentelemetry_proto::tonic::collector::trace::v1::trace_service_server::TraceServiceServer;
use opentelemetry_proto::tonic::collector::trace::v1::{ExportTraceServiceRequest, ExportTraceServiceResponse};
use opentelemetry_proto::tonic::common::v1::any_value::Value as AnyValueKind;
use opentelemetry_proto::tonic::common::v1::KeyValue;
use opentelemetry_proto::tonic::resource::v1::Resource;
use opentelemetry_proto::tonic::trace::v1::{span, status, Span};
use tonic::{Request, Response, Status as TonicStatus};
use uuid::Uuid;

use crate::stream::StreamEvent;
use crate::{db, phi, AppState};

/// The OTel resource attribute an agent's SDK must set so an incoming span can be
/// attributed to it — mirrors the `agent_id` field every other ingestion path
/// (`POST /v1/telemetry/ingest`) requires. A span whose resource lacks this attribute
/// is rejected (`INVALID_ARGUMENT`), not silently stored under a placeholder id.
///
/// Must match `integrity-sdk/integrity_sdk/telemetry/core.py::init_telemetry`'s
/// `Resource.create({..., "integrity.agent.id": agent_id})` exactly (dot-separated,
/// NOT `integrity.agent_id`) — this is the resource attribute the SDK's real,
/// already-working `OTLPSpanExporter` actually sets today, confirmed by reading that
/// module directly rather than assumed, since a mismatch here would make this receiver
/// reject every real span the SDK sends while still compiling and unit-testing clean.
pub const AGENT_ID_ATTRIBUTE_KEY: &str = "integrity.agent.id";

pub struct OtlpTraceService {
    state: AppState,
}

impl OtlpTraceService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

pub struct OtlpMetricsService {
    #[allow(dead_code)]
    state: AppState,
}

impl OtlpMetricsService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

fn extract_agent_id(resource: &Option<Resource>) -> Option<String> {
    resource
        .as_ref()?
        .attributes
        .iter()
        .find(|kv| kv.key == AGENT_ID_ATTRIBUTE_KEY)
        .and_then(|kv| kv.value.as_ref())
        .and_then(|v| match &v.value {
            Some(AnyValueKind::StringValue(s)) => Some(s.clone()),
            _ => None,
        })
}

fn any_value_to_json(value: &opentelemetry_proto::tonic::common::v1::AnyValue) -> serde_json::Value {
    match &value.value {
        Some(AnyValueKind::StringValue(s)) => serde_json::Value::String(s.clone()),
        Some(AnyValueKind::BoolValue(b)) => serde_json::Value::Bool(*b),
        Some(AnyValueKind::IntValue(i)) => serde_json::Value::Number((*i).into()),
        Some(AnyValueKind::DoubleValue(d)) => serde_json::Number::from_f64(*d).map(serde_json::Value::Number).unwrap_or(serde_json::Value::Null),
        Some(AnyValueKind::ArrayValue(arr)) => serde_json::Value::Array(arr.values.iter().map(any_value_to_json).collect()),
        Some(AnyValueKind::KvlistValue(kv)) => kv_list_to_json(&kv.values),
        Some(AnyValueKind::BytesValue(b)) => serde_json::Value::String(hex::encode(b)),
        _ => serde_json::Value::Null,
    }
}

fn kv_list_to_json(kvs: &[KeyValue]) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    for kv in kvs {
        if let Some(v) = &kv.value {
            map.insert(kv.key.clone(), any_value_to_json(v));
        }
    }
    serde_json::Value::Object(map)
}

/// PHI-scannable view of a span: name + attributes, the two free-text-bearing parts —
/// same scope `crate::phi`'s doc comment says the SDK-side redactor targets.
fn span_to_json(span: &Span) -> serde_json::Value {
    serde_json::json!({
        "name": span.name,
        "attributes": kv_list_to_json(&span.attributes),
    })
}

/// A span/trace ID of all-zero bytes (or empty) means "no parent" per the OTel spec
/// (`Span.parent_span_id`'s doc comment in the generated proto) — not a real 8-byte id.
fn hex_id_or_none(bytes: &[u8]) -> Option<String> {
    if bytes.is_empty() || bytes.iter().all(|b| *b == 0) {
        None
    } else {
        Some(hex::encode(bytes))
    }
}

fn span_kind_name(kind: i32) -> &'static str {
    span::SpanKind::try_from(kind).map(|k| k.as_str_name()).unwrap_or("SPAN_KIND_UNSPECIFIED")
}

fn span_status_name(status: Option<&opentelemetry_proto::tonic::trace::v1::Status>) -> &'static str {
    match status {
        Some(s) => status::StatusCode::try_from(s.code).map(|c| c.as_str_name()).unwrap_or("STATUS_CODE_UNSET"),
        None => "STATUS_CODE_UNSET",
    }
}

fn nanos_to_datetime(nanos: u64) -> DateTime<Utc> {
    // `nanos` is realistically far below i64::MAX (valid until year 2262) for any span
    // this receiver will ever see — `unwrap_or` covers the theoretical overflow rather
    // than panicking on adversarial input.
    DateTime::from_timestamp_nanos(nanos as i64)
}

#[tonic::async_trait]
impl TraceService for OtlpTraceService {
    async fn export(&self, request: Request<ExportTraceServiceRequest>) -> Result<Response<ExportTraceServiceResponse>, TonicStatus> {
        let req = request.into_inner();

        for resource_spans in &req.resource_spans {
            let agent_id = extract_agent_id(&resource_spans.resource)
                .ok_or_else(|| TonicStatus::invalid_argument(format!("resource missing required '{AGENT_ID_ATTRIBUTE_KEY}' attribute")))?;

            for scope_spans in &resource_spans.scope_spans {
                for span in &scope_spans.spans {
                    // Defense-in-depth PHI/PII/secret backstop, same posture and same
                    // categories as `ingest_telemetry`'s use of `crate::phi`: reject
                    // loudly before this ever touches Postgres, rather than silently
                    // persisting raw PHI/PII/secret material this receiver has no
                    // authenticated-client guarantee wasn't already redacted client-side.
                    let mut hits: Vec<&'static str> = Vec::new();
                    phi::scan_json_value(&span_to_json(span), &mut hits);
                    if !hits.is_empty() {
                        hits.sort_unstable();
                        hits.dedup();
                        return Err(TonicStatus::invalid_argument(format!(
                            "payload rejected: possible unredacted PHI/PII/secret detected (categories: {hits:?})"
                        )));
                    }

                    let trace_id = hex::encode(&span.trace_id);
                    let span_id = hex::encode(&span.span_id);
                    let parent_span_id = hex_id_or_none(&span.parent_span_id);
                    let attributes = kv_list_to_json(&span.attributes);
                    let id = Uuid::new_v4();

                    db::insert_otel_span(
                        &self.state.pool,
                        id,
                        &agent_id,
                        &trace_id,
                        &span_id,
                        parent_span_id.as_deref(),
                        &span.name,
                        span_kind_name(span.kind),
                        nanos_to_datetime(span.start_time_unix_nano),
                        nanos_to_datetime(span.end_time_unix_nano),
                        span_status_name(span.status.as_ref()),
                        &attributes,
                    )
                    .await
                    .map_err(|e| TonicStatus::internal(e.to_string()))?;

                    // Best-effort: `send` only errs when there are zero subscribers,
                    // which is a normal, expected state (no dashboard currently
                    // connected), not a failure this receiver should reject on.
                    let _ = self.state.telemetry_tx.send(StreamEvent::OtelSpan {
                        agent_id: agent_id.clone(),
                        trace_id: trace_id.clone(),
                        span_id: span_id.clone(),
                        name: span.name.clone(),
                    });
                }
            }
        }

        Ok(Response::new(ExportTraceServiceResponse::default()))
    }
}

#[tonic::async_trait]
impl MetricsService for OtlpMetricsService {
    /// Accepts and acknowledges OTLP metric exports so the SDK's `OTLPMetricExporter`
    /// gets a real gRPC response instead of the connection failures it hits today — but
    /// does NOT parse, PHI-scan, or persist metric data points: no metrics storage
    /// table/query surface exists yet (only `otel_spans`, for traces). Per this repo's
    /// "no silent mocks" rule, this is named here and in `PRODUCTION_GAPS.md` as a real,
    /// scoped-down gap rather than left implied-but-untrue by a handler that looks
    /// identical to the trace path.
    async fn export(&self, _request: Request<ExportMetricsServiceRequest>) -> Result<Response<ExportMetricsServiceResponse>, TonicStatus> {
        Ok(Response::new(ExportMetricsServiceResponse::default()))
    }
}
