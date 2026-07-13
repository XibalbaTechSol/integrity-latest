-- Adds TimescaleDB + real OTLP span storage (PRODUCTION_GAPS.md §1, items 1-3:
-- streaming/OTLP ingestion/TSDB — this migration lands the storage half).
--
-- Design notes:
--   * `otel_spans` is a NEW, separate table from `telemetry_events` — never fed into
--     `scoring_core::AisEngine`/`db::aggregate_for_ais`. Real OTLP spans (received over
--     the new gRPC receiver, see `otlp.rs`) arrive with no Ed25519/secp256k1 signature
--     envelope, unlike `POST /v1/telemetry/ingest`'s payload. Mixing an unauthenticated
--     input source into the AIS computation would let anyone move an agent's score;
--     keeping it a separate table/read surface is the point, not an oversight.
--   * `otel_spans.agent_id` deliberately has NO foreign key into `agents(id)`, unlike
--     `telemetry_events.agent_id` — an OTLP span naming an unknown/not-yet-registered
--     agent_id (taken from the span's OTel resource attributes, not verified against any
--     signature) is legitimate unauthenticated input to accept and store, not an error.
--     Same rationale `agent_primitives` already uses for not FK-ing into `agents`.
--   * `otel_spans` becomes a genuine TimescaleDB hypertable — it has no inbound foreign
--     keys (nothing else references it) and no pre-existing data/constraint shape to
--     migrate, so this is a clean conversion.
--   * `telemetry_events` is deliberately NOT converted to a hypertable here, despite
--     being the other time-series-shaped table. `judge_evaluations.telemetry_event_id`
--     holds a real foreign key INTO `telemetry_events(id)` (see 0002_markets_and_judge.sql)
--     — TimescaleDB does not support foreign keys that reference a hypertable, so
--     converting `telemetry_events` would either break that constraint outright or
--     require restructuring `judge_evaluations`' referential integrity for no clear
--     payoff. `time_bucket()` (the function this migration's endpoints actually need)
--     works against any table once the `timescaledb` extension is installed — it does
--     NOT require the table to be a hypertable — so `telemetry_events`-based history
--     queries (see `db::ais_history_buckets`) get real bucketing without the conversion.
--     Hypertable-specific wins (compression, continuous aggregates, chunk pruning) only
--     matter once event volume is large enough that ad hoc `GROUP BY time_bucket(...)`
--     over plain Postgres gets expensive — not true at current/MVP data volumes.

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE otel_spans (
    id              UUID NOT NULL,
    agent_id        TEXT NOT NULL,
    trace_id        TEXT NOT NULL,
    span_id         TEXT NOT NULL,
    parent_span_id  TEXT,
    name            TEXT NOT NULL,
    kind            TEXT NOT NULL,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    status_code     TEXT NOT NULL,
    attributes      JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite, not a bare `id` PK: TimescaleDB requires every unique constraint
    -- (including the primary key) on a hypertable to include the partitioning column
    -- (`created_at`). `id` (a fresh UUIDv4 per span) is still effectively unique on its
    -- own; the composite is a hypertable mechanical requirement, not a real relaxation
    -- of the uniqueness guarantee.
    PRIMARY KEY (id, created_at)
);

SELECT create_hypertable('otel_spans', 'created_at');

-- db::otel_volume_buckets and db::get_otel_spans_for_trace's agent-scoped list filter by
-- (agent_id, created_at); db::insert_otel_span dedup/lookup and ChainOfThoughtPage's DAG
-- reconstruction filter by trace_id/parent_span_id respectively.
CREATE INDEX idx_otel_spans_agent_created ON otel_spans (agent_id, created_at);
CREATE INDEX idx_otel_spans_trace ON otel_spans (trace_id);
CREATE INDEX idx_otel_spans_parent ON otel_spans (parent_span_id);
