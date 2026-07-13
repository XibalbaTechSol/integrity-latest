-- Initial schema for the integrity-oracle backend.
--
-- Nothing has shipped yet (docs/INTERFACE_CONTRACT.md's "no silent mocks" ground rule
-- applies to schema too: no legacy back-compat constraint to honor), so this migration
-- is free to match `db.rs`'s runtime-checked queries exactly rather than accreting
-- ALTER TABLEs on top of an inherited shape.
--
-- Design notes (see backend/CLAUDE.md task write-up for the fuller rationale):
--   * `agents.id` is the agent's DID string (e.g. "did:integrity:<fingerprint>"), not a
--     surrogate UUID — every db.rs query binds `id` as the primary lookup key and the
--     interface contract treats the DID as the canonical off-chain identifier, so using
--     it directly as the primary key avoids an extra UUID<->DID indirection everywhere.
--   * The 7 on-chain primitive addresses (§6.1 of the interface contract) are NOT columns
--     on `agents` itself. `db::register_agent`'s existing signature (id, ed25519_pubkey,
--     eth_address, verification_tier) predates this task and is reused as-is rather than
--     reshaped, so primitive addresses are persisted in a separate `agent_primitives`
--     table instead, written by a new `db::upsert_agent_primitives` helper after
--     `chain::resolve_primitives` confirms them on-chain. `agent_primitives.agent_id` is
--     deliberately NOT a foreign key into `agents.id`: an agent can be fully registered
--     on-chain (via AgentPrimitivesFactory, directly through integrity-sdk/cli) without
--     ever having called this oracle's POST /v1/agent/register, so `agent_primitives` is a
--     live-chain-resolution cache keyed by DID, independent of whether this oracle also
--     holds off-chain verification material (ed25519/eth key) for that DID in `agents`.
--     GET /v1/agent/{id}'s "refreshed/backfilled from chain on miss" behavior relies on
--     being able to populate this cache even when no `agents` row exists yet.
--   * `telemetry_events.leaf_hash` / `merkle_roots.root_hash` are BYTEA(32) (keccak256
--     digests, §4.4) — CHECK constraints pin the length so a coding mistake that hashes
--     with the wrong algorithm fails loudly at insert time instead of silently anchoring
--     a malformed tree.
--   * `telemetry_events` has a UNIQUE(agent_id, nonce) constraint: replay protection is
--     enforced by `db::insert_telemetry_event`'s `SELECT ... FOR UPDATE` + nonce check
--     inside a transaction, but the constraint is a second, storage-level backstop against
--     the same bug class (e.g. a future code path that inserts without going through that
--     helper).

CREATE TABLE agents (
    id                  TEXT PRIMARY KEY,
    ed25519_pubkey      BYTEA,
    eth_address         TEXT,
    verification_tier   INTEGER NOT NULL DEFAULT 0,
    last_nonce          BIGINT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT agents_has_a_verification_method
        CHECK (ed25519_pubkey IS NOT NULL OR eth_address IS NOT NULL)
);

-- Cache of an agent's on-chain PrimitiveSet (§6.1), resolved live from
-- XibalbaAgentRegistry and refreshed on demand (see chain.rs / handlers.rs). Kept
-- separate from `agents` (see header note) and always safe to drop/rebuild by
-- re-resolving from chain, since XibalbaAgentRegistry remains the source of truth.
CREATE TABLE agent_primitives (
    agent_id                    TEXT PRIMARY KEY,
    sovereign_agent_address     TEXT NOT NULL,
    state_anchor_address        TEXT NOT NULL,
    reputation_registry_address TEXT NOT NULL,
    slasher_address              TEXT NOT NULL,
    verifier_registry_address   TEXT NOT NULL,
    compliance_gate_address     TEXT NOT NULL,
    agent_profile_address       TEXT NOT NULL,
    controller_address          TEXT NOT NULL,
    domain_id                   TEXT NOT NULL,
    resolved_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Must exist before telemetry_events, which FKs into it via merkle_root_id.
CREATE TABLE merkle_roots (
    id          UUID PRIMARY KEY,
    root_hash   BYTEA NOT NULL CHECK (octet_length(root_hash) = 32),
    leaf_count  INTEGER NOT NULL CHECK (leaf_count > 0),
    tx_hash     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE telemetry_events (
    id                    UUID PRIMARY KEY,
    agent_id              TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    nonce                 BIGINT NOT NULL,
    performance_variance  DOUBLE PRECISION NOT NULL,
    hgi_raw               DOUBLE PRECISION NOT NULL,
    gpu_hours_verified    DOUBLE PRECISION NOT NULL,
    flagged               BOOLEAN NOT NULL DEFAULT false,
    zk_verified           BOOLEAN NOT NULL DEFAULT false,
    leaf_hash             BYTEA NOT NULL CHECK (octet_length(leaf_hash) = 32),
    payload               JSONB NOT NULL,
    merkle_root_id        UUID REFERENCES merkle_roots(id),
    leaf_index             INTEGER,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Storage-level backstop for replay protection; the authoritative check is the
    -- transactional SELECT...FOR UPDATE in db::insert_telemetry_event.
    CONSTRAINT telemetry_events_agent_nonce_unique UNIQUE (agent_id, nonce),
    -- leaf_index is only meaningful once a root is assigned, and must be assigned
    -- together with merkle_root_id (see db::create_merkle_root_and_assign).
    CONSTRAINT telemetry_events_leaf_index_requires_root
        CHECK ((merkle_root_id IS NULL) = (leaf_index IS NULL))
);

-- db::aggregate_for_ais filters by (agent_id, created_at >= $2).
CREATE INDEX idx_telemetry_events_agent_created ON telemetry_events (agent_id, created_at);

-- db::fetch_pending_leaves scans WHERE merkle_root_id IS NULL ORDER BY created_at, id.
-- A partial index keeps this cheap even after many roots have been anchored, since the
-- "pending" set is normally a small tail of the table, not a fixed fraction of it.
CREATE INDEX idx_telemetry_events_pending ON telemetry_events (created_at, id) WHERE merkle_root_id IS NULL;

-- db::fetch_leaves_for_root scans WHERE merkle_root_id = $1 ORDER BY leaf_index.
CREATE INDEX idx_telemetry_events_root_leaf_index ON telemetry_events (merkle_root_id, leaf_index) WHERE merkle_root_id IS NOT NULL;
