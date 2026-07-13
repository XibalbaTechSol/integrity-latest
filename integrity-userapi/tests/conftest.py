"""
Shared pytest fixtures for integrity-userapi.

Everything here runs against a REAL Postgres (never sqlite, never an
in-memory substitute) -- matching this monorepo's existing convention
(see integrity-oracle/README.md's e2e test, integrity-sdk/tests/conftest.py:
real infra, not mocked internals). The instance used here is the
`userapi-postgres` service wired into the root docker-compose.yml
(postgres:16-alpine, user/pass `integrity`/`integrity_dev_only`, host port
5435 -- deliberately NOT integrity-oracle's own 5432/5434 convention, since
the whole point of this split is two separate Postgres instances/trust
domains, see docs/INTERFACE_CONTRACT.md §6.10 and §13).

`TEST_DATABASE_URL` can override the target for CI/local flexibility; it
must point at a real reachable Postgres or the whole suite fails loudly at
collection time (no silent skip -- this package's stated gate is "pytest
green against a real Postgres").
"""

from __future__ import annotations

import os
import socket
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import asyncpg
import httpx
import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager

# Point this test session's app instance at a dedicated *test* database on
# the same userapi-postgres server, distinct from the "dev" database a human
# might be poking at with psql -- set BEFORE `app.config` (and therefore its
# module-level `settings` singleton) is ever imported, so pydantic-settings
# picks it up from the environment.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql://integrity:integrity_dev_only@127.0.0.1:5435/integrity_userapi_test",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
# Force (not setdefault) a closed port so any test that forgets to override
# oracle_url exercises the real "oracle unreachable" path honestly. This
# repo's own oracle-backend is commonly live on :8080 in dev, and
# ORACLE_URL is a documented shared env var (docs/INTERFACE_CONTRACT.md
# §3) -- if a dev/CI shell happens to export it, `setdefault` would
# silently no-op and this suite would flake against whatever real oracle
# is reachable instead of deterministically testing the unreachable path.
os.environ["ORACLE_URL"] = "http://127.0.0.1:1"

from app import db  # noqa: E402
from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402

ADMIN_DATABASE_URL = "postgresql://integrity:integrity_dev_only@127.0.0.1:5435/integrity_userapi"
TEST_DB_NAME = "integrity_userapi_test"


def _ensure_test_database() -> None:
    """Creates the dedicated test database if it doesn't exist yet. Uses a
    plain synchronous connection via asyncpg's sync-friendly one-shot API is
    not available, so this runs a tiny asyncio loop directly -- this must
    happen before any pool connects to a database that may not exist."""
    import asyncio

    async def _create() -> None:
        conn = await asyncpg.connect(dsn=ADMIN_DATABASE_URL)
        try:
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = $1", TEST_DB_NAME
            )
            if not exists:
                await conn.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')
        finally:
            await conn.close()

    asyncio.run(_create())


_ensure_test_database()


@pytest_asyncio.fixture
async def client() -> Iterator[httpx.AsyncClient]:
    """
    A real ASGI client wired through the app's REAL startup/shutdown
    lifespan (via asgi-lifespan's LifespanManager) -- this exercises the
    actual `app.main._startup` code path (real pool creation, real
    `db.run_migrations` against the real test database), not a hand-rolled
    substitute. Tables are truncated before each test for isolation, since
    migrations only run once (idempotent, tracked in schema_migrations) and
    the schema itself must persist across tests.
    """
    # Reset so `_startup`'s "a test harness already attached a pool" guard
    # doesn't skip real pool creation on the 2nd+ test using this fixture.
    app.state.pool = None
    async with LifespanManager(app):
        pool: asyncpg.Pool = app.state.pool
        await pool.execute(
            "TRUNCATE TABLE demo_runs, user_agents, api_keys, users RESTART IDENTITY CASCADE"
        )
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


@pytest_asyncio.fixture
async def db_pool() -> Iterator[asyncpg.Pool]:
    """A standalone pool for tests that need to assert on raw DB state."""
    pool = await db.create_pool(TEST_DATABASE_URL)
    try:
        yield pool
    finally:
        await pool.close()


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class _FakeOracleServer:
    """
    A REAL local HTTP server standing in for integrity-oracle, used to
    exercise `app/oracle_client.py`'s actual HTTP boundary (real socket, real
    httpx client, real response parsing) rather than mocking
    `oracle_client.fetch_agent`'s internals -- per this package's own
    docstring, the point of the tri-state AgentLookupResult is that the real
    HTTP call can genuinely fail, so the test needs a real HTTP call.
    """

    def __init__(self) -> None:
        self.port = _free_port()
        self.responses: dict[str, tuple[int, bytes]] = {}
        handler = self._make_handler()
        self.server = ThreadingHTTPServer(("127.0.0.1", self.port), handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def set_response(self, path: str, status: int, body: bytes) -> None:
        self.responses[path] = (status, body)

    def _make_handler(self):
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                status, body = outer.responses.get(self.path, (404, b'{"error":"not found"}'))
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, format: str, *args) -> None:  # noqa: A002
                return  # silence default request logging

        return Handler

    def stop(self) -> None:
        self.server.shutdown()
        self.server.server_close()


@pytest.fixture
def fake_oracle() -> Iterator[_FakeOracleServer]:
    server = _FakeOracleServer()
    original_url = settings.oracle_url
    settings.oracle_url = server.url
    try:
        yield server
    finally:
        settings.oracle_url = original_url
        server.stop()
