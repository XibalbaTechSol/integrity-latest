//! Live SSE streaming (PRODUCTION_GAPS.md §1 item 1). Pushes AIS updates and raw
//! ingestion events to any connected frontend page (`IntelligencePage`,
//! `SdkTelemetryPage`, `ChainOfThoughtPage`, `FinancePage`) as they happen, instead of
//! those pages only ever reading seeded/mock data.
//!
//! SSE, not WebSocket: every consumer here only receives pushed data, never sends
//! anything back over the same connection — `axum::response::sse` needs no extra Cargo
//! feature (unlike `axum`'s `"ws"` feature), and the browser's native `EventSource`
//! reconnects automatically on a dropped connection, so the frontend needs no custom
//! retry logic either.
//!
//! Fan-out is an in-process `tokio::sync::broadcast` channel (`AppState::telemetry_tx`),
//! not Postgres LISTEN/NOTIFY or Redis pub/sub: `docker-compose.yml` runs exactly one
//! `oracle-backend` instance today, so in-process is the least infrastructure that
//! satisfies the real requirement. Redis (already in `AppState` as `redis`) is the noted
//! scale-out path if the oracle is ever run as more than one replica — not built now,
//! since it isn't needed yet.

use axum::extract::{Path, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use chrono::{DateTime, Utc};
use futures::{Stream, StreamExt};
use serde::Serialize;
use uuid::Uuid;

use crate::handlers::AisResponse;
use crate::AppState;

/// One push over `/v1/stream` or `/v1/agent/{id}/stream`. `AisUpdate` is always computed
/// by `handlers::compute_ais_for_agent` — the same function `GET /v1/agent/{id}/ais`
/// calls — so a live-pushed score can never drift from what a direct REST read returns
/// (see that function's doc comment, and `docs/INTERFACE_CONTRACT.md` §4.3).
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    TelemetryEvent {
        agent_id: String,
        event_id: Uuid,
        flagged: bool,
        created_at: DateTime<Utc>,
    },
    /// Emitted by the real OTLP receiver (`otlp.rs`) after a span is persisted to
    /// `otel_spans`. Unlike `TelemetryEvent`, this reflects unauthenticated input (see
    /// `otlp.rs`'s module doc comment) — the stream frame is labeled the same way the
    /// storage table is.
    OtelSpan {
        agent_id: String,
        trace_id: String,
        span_id: String,
        name: String,
    },
    AisUpdate(AisResponse),
}

/// Broadcast channel capacity: a lagging SSE client drops the oldest buffered events
/// rather than back-pressuring ingestion (`tokio::sync::broadcast`'s designed-for
/// behavior) — correct here, since a client that falls behind or reconnects can always
/// recover current state from the REST/history endpoints rather than needing every
/// intermediate event replayed.
pub const CHANNEL_CAPACITY: usize = 1024;

fn event_agent_id(event: &StreamEvent) -> &str {
    match event {
        StreamEvent::TelemetryEvent { agent_id, .. } => agent_id,
        StreamEvent::OtelSpan { agent_id, .. } => agent_id,
        StreamEvent::AisUpdate(ais) => &ais.agent_id,
    }
}

fn to_sse_event(event: &StreamEvent) -> Event {
    let name = match event {
        StreamEvent::TelemetryEvent { .. } => "telemetry",
        StreamEvent::OtelSpan { .. } => "otel_span",
        StreamEvent::AisUpdate(_) => "ais_update",
    };
    // `Event::json_data` only fails on a serialization bug in `StreamEvent`'s own
    // `Serialize` impl, never on a per-message basis — falling back to a `data: {}`
    // frame rather than dropping the subscriber keeps one bad frame from silently
    // killing an otherwise-healthy connection.
    Event::default().event(name).json_data(event).unwrap_or_else(|_| Event::default().event(name).data("{}"))
}

/// `GET /v1/stream` — every event, unfiltered by agent.
pub async fn stream_events(State(state): State<AppState>) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let rx = state.telemetry_tx.subscribe();
    let stream = tokio_stream::wrappers::BroadcastStream::new(rx).filter_map(|res| async move { res.ok().map(|event| Ok(to_sse_event(&event))) });
    Sse::new(stream).keep_alive(KeepAlive::default())
}

/// `GET /v1/agent/{id}/stream` — events for one agent only.
pub async fn stream_agent(State(state): State<AppState>, Path(id): Path<String>) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let rx = state.telemetry_tx.subscribe();
    let stream = tokio_stream::wrappers::BroadcastStream::new(rx)
        .filter_map(move |res| {
            let id = id.clone();
            async move { res.ok().filter(|event| event_agent_id(event) == id).map(|event| Ok(to_sse_event(&event))) }
        });
    Sse::new(stream).keep_alive(KeepAlive::default())
}
