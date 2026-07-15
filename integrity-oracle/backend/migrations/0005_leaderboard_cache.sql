-- Adds a read-through cache for GET /v1/leaderboard (PRODUCTION_GAPS.md §2), which
-- previously did a live `ReputationRegistry.effectiveScore` RPC call per registered
-- agent on every single hit -- an unauthenticated, N:1 RPC-amplification cost/DoS
-- vector as the agent population grows. Mirrors `markets_cache`/`markets_index_sync`'s
-- exact staleness-cache pattern (see `migrations/0002_markets_and_judge.sql`'s header
-- note) rather than inventing a new one: `leaderboard_cache` is a read-through cache of
-- per-agent effective-score reads, always safe to rebuild from chain;
-- `leaderboard_sync` is a single-row marker of when the full agent *membership* (not
-- just already-cached rows) was last re-enumerated from `agents`, since per-row
-- staleness alone would never surface a newly-registered agent.

CREATE TABLE IF NOT EXISTS leaderboard_cache (
    agent_id                  TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
    sovereign_agent_address   TEXT NOT NULL,
    effective_score           TEXT NOT NULL,  -- decimal string, uint256 (ReputationRegistry.effectiveScore)
    refreshed_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-row marker of when the full agent list was last re-enumerated (as opposed to
-- one agent's row being individually refreshed) -- see
-- handlers::refresh_leaderboard_if_stale. The `id` CHECK enforces at most one row.
CREATE TABLE IF NOT EXISTS leaderboard_sync (
    id          BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    agent_count INTEGER NOT NULL,
    synced_at   TIMESTAMPTZ NOT NULL
);
