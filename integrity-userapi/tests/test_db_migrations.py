"""app/db.py's run_migrations against a real Postgres: applies once, is
idempotent on a second call, and actually creates the real tables from
migrations/0001_init.sql -- not a faked/hand-written schema."""

from __future__ import annotations

import asyncpg

from app import db


async def test_run_migrations_creates_real_tables(db_pool: asyncpg.Pool) -> None:
    applied = await db.run_migrations(db_pool)
    # Empty if some earlier test in this session already applied it (schema
    # persists across tests -- only row DATA is truncated between tests, see
    # conftest.py's `client` fixture); ["0001_init.sql"] on a truly fresh DB.
    assert applied in ([], ["0001_init.sql"])

    tables = {
        row["table_name"]
        for row in await db_pool.fetch(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        )
    }
    assert {"users", "api_keys", "user_agents", "demo_runs", "schema_migrations"} <= tables


async def test_run_migrations_is_idempotent(db_pool: asyncpg.Pool) -> None:
    await db.run_migrations(db_pool)
    second_pass = await db.run_migrations(db_pool)
    assert second_pass == []
