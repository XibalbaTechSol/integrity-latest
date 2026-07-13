-- Initial schema for integrity-userapi.
--
-- This service owns USER data only -- accounts, developer API keys, the
-- user<->agent-DID ownership pointer, and per-user demo run records. It
-- never stores a cache of on-chain agent state (see app/oracle_client.py):
-- `user_agents.agent_did` is a pointer only, resolved live against
-- integrity-oracle on every `GET /me/agents` call.
--
-- Migration convention: applied by app/db.py's `run_migrations`, a small
-- hand-rolled runner (this package uses asyncpg directly, no ORM/migration
-- framework) modeled on the same "plain versioned SQL files" convention
-- integrity-oracle uses (there via sqlx::migrate!, tracked in
-- `_sqlx_migrations`; here via our own `schema_migrations` table -- same
-- idea, no sqlx dependency in Python). Files are applied in filename order,
-- each exactly once, inside a transaction.

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Developer API keys. Only `key_hash` is ever persisted -- the raw key is
-- returned exactly once, at creation time, and never stored or re-returned
-- (see app/security.py / POST /api-keys).
CREATE TABLE api_keys (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash              TEXT NOT NULL UNIQUE,
    -- Caps the AIS an agent acting under this key is trusted up to for
    -- whatever policy consumes it downstream. Default carried from the old
    -- integrity-dashboard "API Key Generation" convention -- see
    -- app/config.py's `default_api_key_trust_ceiling` docstring for the
    -- honest gap note (that README section no longer exists in this repo).
    ais_trust_ceiling     INTEGER NOT NULL DEFAULT 300,
    revoked_at            TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);

-- Ownership pointer ONLY. `agent_did` is a plain TEXT DID string (mirrors
-- integrity-oracle's `agents.id` being the DID itself, not a surrogate key)
-- -- deliberately NOT a foreign key into any table here, since this service
-- has no local copy of agent state to reference; the oracle is the sole
-- source of truth for whether a DID actually exists on-chain.
CREATE TABLE user_agents (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_did   TEXT NOT NULL,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, agent_did)
);

-- Tracks that a user REQUESTED a demo run, for history/audit purposes only.
-- This service does not orchestrate demos (that's integrity-demo, a
-- separate package/process) -- `status` starts at 'pending' and this table
-- is never written to a fabricated 'completed' state by this service.
CREATE TABLE demo_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    result_summary  JSONB
);

CREATE INDEX idx_demo_runs_user_id ON demo_runs (user_id);
