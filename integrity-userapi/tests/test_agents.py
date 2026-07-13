"""
POST /me/agents -> GET /me/agents round trip, including the tri-state
AgentLookupResult from app/oracle_client.py: live data, not-found, and
unreachable. These hit a REAL local HTTP server (conftest.py's
`fake_oracle` fixture) standing in for integrity-oracle -- not a mock of
oracle_client's internals -- so the actual httpx call, real socket, and
real JSON parsing in `fetch_agent` are exercised.
"""

from __future__ import annotations

import json

import httpx

EMAIL = "agents@example.com"
PASSWORD = "correct-horse-battery-staple"
AGENT_DID = "did:integrity:deadbeef"


async def _auth_headers(client: httpx.AsyncClient) -> dict[str, str]:
    resp = await client.post("/auth/register", json={"email": EMAIL, "password": PASSWORD})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_add_agent_with_live_oracle_data(client: httpx.AsyncClient, fake_oracle) -> None:
    fake_oracle.set_response(
        f"/v1/agent/{AGENT_DID}",
        200,
        json.dumps({"id": AGENT_DID, "ais": 742}).encode(),
    )
    headers = await _auth_headers(client)

    resp = await client.post("/me/agents", json={"agent_did": AGENT_DID}, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["agent_did"] == AGENT_DID
    assert body["live_data"] == {"id": AGENT_DID, "ais": 742}
    assert body["error"] is None


async def test_list_agents_round_trip_with_live_data(client: httpx.AsyncClient, fake_oracle) -> None:
    fake_oracle.set_response(
        f"/v1/agent/{AGENT_DID}",
        200,
        json.dumps({"id": AGENT_DID, "ais": 500}).encode(),
    )
    headers = await _auth_headers(client)
    await client.post("/me/agents", json={"agent_did": AGENT_DID}, headers=headers)

    resp = await client.get("/me/agents", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["agent_did"] == AGENT_DID
    assert body[0]["live_data"] == {"id": AGENT_DID, "ais": 500}
    assert body[0]["error"] is None


async def test_add_agent_oracle_404s_not_found(client: httpx.AsyncClient, fake_oracle) -> None:
    # fake_oracle's default response for any unregistered path is a 404,
    # matching what a real oracle returns for an unknown DID.
    headers = await _auth_headers(client)
    resp = await client.post("/me/agents", json={"agent_did": AGENT_DID}, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    # The ownership pointer is still recorded even though the oracle has no
    # data for it yet -- ownership and on-chain existence are separate facts.
    assert body["agent_did"] == AGENT_DID
    assert body["live_data"] is None
    assert body["error"] == "agent not found on oracle"


async def test_list_agents_oracle_unreachable(client: httpx.AsyncClient) -> None:
    # No fake_oracle fixture here -- conftest.py's default ORACLE_URL points
    # at a closed port (127.0.0.1:1), so this exercises the real
    # httpx.HTTPError branch in fetch_agent, not a fabricated failure.
    headers = await _auth_headers(client)
    resp = await client.post("/me/agents", json={"agent_did": AGENT_DID}, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["live_data"] is None
    assert body["error"] is not None
    assert "unreachable" in body["error"]

    listed = await client.get("/me/agents", headers=headers)
    assert listed.status_code == 200
    entry = listed.json()[0]
    assert entry["live_data"] is None
    assert "unreachable" in entry["error"]


async def test_add_agent_requires_auth(client: httpx.AsyncClient) -> None:
    resp = await client.post("/me/agents", json={"agent_did": AGENT_DID})
    assert resp.status_code == 401


async def test_add_same_agent_twice_upserts_not_duplicates(client: httpx.AsyncClient, fake_oracle) -> None:
    fake_oracle.set_response(f"/v1/agent/{AGENT_DID}", 200, json.dumps({"id": AGENT_DID}).encode())
    headers = await _auth_headers(client)

    await client.post("/me/agents", json={"agent_did": AGENT_DID}, headers=headers)
    await client.post("/me/agents", json={"agent_did": AGENT_DID}, headers=headers)

    listed = await client.get("/me/agents", headers=headers)
    assert len(listed.json()) == 1


async def test_agents_scoped_to_owner(client: httpx.AsyncClient, fake_oracle) -> None:
    fake_oracle.set_response(f"/v1/agent/{AGENT_DID}", 200, json.dumps({"id": AGENT_DID}).encode())
    headers_a = await _auth_headers(client)
    await client.post("/me/agents", json={"agent_did": AGENT_DID}, headers=headers_a)

    resp_b = await client.post("/auth/register", json={"email": "other@example.com", "password": PASSWORD})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    listed_b = await client.get("/me/agents", headers=headers_b)
    assert listed_b.json() == []
