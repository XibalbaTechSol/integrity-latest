-- Adds the market/application-layer read cache (§6.9 of the interface contract) and
-- judge-evaluation storage/ingestion plumbing to the oracle's schema.
--
-- Design notes:
--   * Token amounts (`min_ais_to_enter`, `total_staked`, `outcome_staked`'s elements)
--     are stored as TEXT, not BIGINT/DOUBLE PRECISION: a Solidity `uint256` (e.g.
--     `IntegrityMarket.totalStaked`, `IntegrityToken.balanceOf`) can exceed both i64's
--     range and f64's safe-integer range, so these are carried as exact decimal
--     strings end-to-end (chain.rs's `U256::to_string()` -> this column -> the DTO's
--     JSON string field) rather than risking silent precision loss. This mirrors why
--     `agent_primitives`' addresses are TEXT, not a numeric type.
--   * `markets_cache` is a read-through cache of `MarketFactory`/`IntegrityMarket`
--     view state, refreshed on a staleness window (see
--     `handlers::MARKETS_CACHE_STALENESS_SECS`) — always safe to rebuild from chain,
--     same rationale as `agent_primitives`.
--   * `markets_index_sync` is a single-row marker (enforced by the `id` CHECK) of when
--     the full market *membership* (not just existing rows) was last re-enumerated via
--     `MarketFactory.allMarketsCount()` — per-row staleness alone would never discover
--     a market created after the last full sync, only refresh rows already cached.
--   * `judge_evaluations` is storage + ingestion plumbing ONLY (task write-up item 6)
--     — no judge/rubric implementation exists yet. Deliberately NOT covered by
--     `POST /v1/telemetry/ingest`'s signature check (see `handlers.rs`'s `signable`
--     JSON construction, which does not include `judge_evaluation`): adding it there
--     would retroactively invalidate every already-signed telemetry payload from a
--     client that never knew this field existed.

CREATE TABLE markets_cache (
    address           TEXT PRIMARY KEY,      -- lowercase 0x-address of the IntegrityMarket clone
    creator_address   TEXT NOT NULL,
    question          TEXT NOT NULL,
    outcome_count     SMALLINT NOT NULL CHECK (outcome_count >= 2),
    min_ais_to_enter  TEXT NOT NULL,          -- decimal string, uint256
    resolve_deadline  BIGINT NOT NULL,        -- unix seconds
    resolved          BOOLEAN NOT NULL,
    winning_outcome   SMALLINT NOT NULL,
    total_staked      TEXT NOT NULL,          -- decimal string, uint256
    outcome_staked    JSONB NOT NULL,         -- JSON array of decimal strings, index = outcome index
    refreshed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-row marker of when the full market list was last re-enumerated from
-- MarketFactory (as opposed to one market's row being individually refreshed) — see
-- handlers::refresh_markets_index_if_stale. The `id` CHECK enforces at most one row.
CREATE TABLE markets_index_sync (
    id           BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    market_count INTEGER NOT NULL,
    synced_at    TIMESTAMPTZ NOT NULL
);

-- Judge (LLM-as-judge) evaluations optionally attached to a telemetry ingestion.
-- `agent_id` FKs into `agents` (unlike `agent_primitives`, which deliberately doesn't —
-- see 0001_init.sql) because `POST /v1/telemetry/ingest` already 404s on an unknown
-- agent before this table is ever written to, so the row's existence is a safe
-- invariant. `telemetry_event_id` is nullable/ON DELETE SET NULL rather than a hard
-- dependency, since a judge evaluation is conceptually its own record even though this
-- pass only ever ingests it alongside a telemetry event.
CREATE TABLE judge_evaluations (
    id                 UUID PRIMARY KEY,
    agent_id           TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    run_id             TEXT NOT NULL,
    judge_model        TEXT NOT NULL,
    verdict            TEXT NOT NULL,
    score              DOUBLE PRECISION,
    rationale_summary  TEXT,
    telemetry_event_id UUID REFERENCES telemetry_events(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_judge_evaluations_agent_created ON judge_evaluations (agent_id, created_at);
