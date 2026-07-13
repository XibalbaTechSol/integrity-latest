"""Smoke test: the app boots (real startup lifespan, real migrations) and
/health responds -- the cheapest possible signal that the wiring in
conftest.py's `client` fixture (real pool, real db.run_migrations) works."""

from __future__ import annotations

import httpx


async def test_health(client: httpx.AsyncClient) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "online", "service": "integrity-userapi"}
