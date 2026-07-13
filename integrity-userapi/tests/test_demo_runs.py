"""POST /demo/run creates a row with status='pending'; GET /demo/runs lists it.
This service only records that a run was requested -- it never orchestrates
or fabricates a 'completed' state (see app/main.py's docstring on
start_demo_run), so the pending status itself is the behavior under test.
"""

from __future__ import annotations

import httpx

EMAIL = "demo@example.com"
PASSWORD = "correct-horse-battery-staple"


async def _auth_headers(client: httpx.AsyncClient) -> dict[str, str]:
    resp = await client.post("/auth/register", json={"email": EMAIL, "password": PASSWORD})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_start_demo_run_creates_pending_row(client: httpx.AsyncClient) -> None:
    headers = await _auth_headers(client)
    resp = await client.post("/demo/run", headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"
    assert body["finished_at"] is None
    assert body["result_summary"] is None


async def test_list_demo_runs_round_trip(client: httpx.AsyncClient) -> None:
    headers = await _auth_headers(client)
    created = await client.post("/demo/run", headers=headers)
    created_id = created.json()["id"]

    listed = await client.get("/demo/runs", headers=headers)
    assert listed.status_code == 200
    ids = [item["id"] for item in listed.json()]
    assert created_id in ids
    assert all(item["status"] == "pending" for item in listed.json())


async def test_demo_runs_ordered_most_recent_first(client: httpx.AsyncClient) -> None:
    headers = await _auth_headers(client)
    first = await client.post("/demo/run", headers=headers)
    second = await client.post("/demo/run", headers=headers)

    listed = await client.get("/demo/runs", headers=headers)
    ids = [item["id"] for item in listed.json()]
    assert ids.index(second.json()["id"]) < ids.index(first.json()["id"])


async def test_demo_runs_scoped_to_owner(client: httpx.AsyncClient) -> None:
    headers_a = await _auth_headers(client)
    await client.post("/demo/run", headers=headers_a)

    resp_b = await client.post("/auth/register", json={"email": "other@example.com", "password": PASSWORD})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    listed_b = await client.get("/demo/runs", headers=headers_b)
    assert listed_b.json() == []


async def test_start_demo_run_requires_auth(client: httpx.AsyncClient) -> None:
    resp = await client.post("/demo/run")
    assert resp.status_code == 401
