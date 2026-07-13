"""
Developer API key create -> list -> revoke round trip.

Note on "a revoked key can't be reused": reading app/deps.py and app/main.py
end to end, NOTHING in this package currently authenticates a request using
a raw API key (`get_current_user_id` only ever decodes a JWT bearer token;
`api_keys.key_hash` is written and read back for listing/revocation, but
never looked up to gate a request). So there is no "revoked key still works"
regression to test yet -- that would be testing a code path that doesn't
exist. What IS tested here: revoking sets `revoked_at`, a second revoke of
the same key 404s (can't double-revoke / revoke someone else's key), and the
raw key is never persisted (only its hash, verified by reading straight from
the DB).
"""

from __future__ import annotations

import hashlib

import httpx

from app.security import hash_api_key

EMAIL = "keys@example.com"
PASSWORD = "correct-horse-battery-staple"


async def _auth_headers(client: httpx.AsyncClient) -> dict[str, str]:
    resp = await client.post("/auth/register", json={"email": EMAIL, "password": PASSWORD})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_create_api_key_returns_raw_key_once(client: httpx.AsyncClient) -> None:
    headers = await _auth_headers(client)
    resp = await client.post("/api-keys", headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["raw_key"].startswith("uak_")
    assert body["ais_trust_ceiling"] == 300
    # ApiKeyCreateResponse deliberately has no `revoked_at` field -- a
    # freshly created key can't be revoked yet, so the schema doesn't offer
    # a place to lie about it.
    assert "revoked_at" not in body


async def test_created_key_only_hash_is_persisted(client: httpx.AsyncClient, db_pool) -> None:
    headers = await _auth_headers(client)
    resp = await client.post("/api-keys", headers=headers)
    raw_key = resp.json()["raw_key"]
    key_id = resp.json()["id"]

    row = await db_pool.fetchrow("SELECT key_hash FROM api_keys WHERE id = $1", key_id)
    assert row["key_hash"] == hash_api_key(raw_key)
    assert row["key_hash"] == hashlib.sha256(raw_key.encode()).hexdigest()
    # The raw key itself must not appear anywhere in the persisted row's hash column.
    assert raw_key != row["key_hash"]


async def test_list_api_keys_round_trip(client: httpx.AsyncClient) -> None:
    headers = await _auth_headers(client)
    created = await client.post("/api-keys", headers=headers)
    created_id = created.json()["id"]

    listed = await client.get("/api-keys", headers=headers)
    assert listed.status_code == 200
    ids = [item["id"] for item in listed.json()]
    assert created_id in ids
    # The raw key must never be re-returned by the list endpoint.
    assert all("raw_key" not in item for item in listed.json())


async def test_list_api_keys_scoped_to_owner(client: httpx.AsyncClient) -> None:
    headers_a = await _auth_headers(client)
    await client.post("/api-keys", headers=headers_a)

    resp_b = await client.post("/auth/register", json={"email": "other@example.com", "password": PASSWORD})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    listed_b = await client.get("/api-keys", headers=headers_b)
    assert listed_b.json() == []


async def test_revoke_api_key(client: httpx.AsyncClient) -> None:
    headers = await _auth_headers(client)
    created = await client.post("/api-keys", headers=headers)
    key_id = created.json()["id"]

    revoke_resp = await client.delete(f"/api-keys/{key_id}", headers=headers)
    assert revoke_resp.status_code == 204

    listed = await client.get("/api-keys", headers=headers)
    revoked_entry = next(item for item in listed.json() if item["id"] == key_id)
    assert revoked_entry["revoked_at"] is not None


async def test_revoke_already_revoked_key_404s(client: httpx.AsyncClient) -> None:
    headers = await _auth_headers(client)
    created = await client.post("/api-keys", headers=headers)
    key_id = created.json()["id"]

    first = await client.delete(f"/api-keys/{key_id}", headers=headers)
    assert first.status_code == 204

    second = await client.delete(f"/api-keys/{key_id}", headers=headers)
    assert second.status_code == 404


async def test_revoke_unknown_key_404s(client: httpx.AsyncClient) -> None:
    headers = await _auth_headers(client)
    resp = await client.delete("/api-keys/00000000-0000-0000-0000-000000000000", headers=headers)
    assert resp.status_code == 404


async def test_cannot_revoke_another_users_key(client: httpx.AsyncClient) -> None:
    headers_a = await _auth_headers(client)
    created = await client.post("/api-keys", headers=headers_a)
    key_id = created.json()["id"]

    resp_b = await client.post("/auth/register", json={"email": "other2@example.com", "password": PASSWORD})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    resp = await client.delete(f"/api-keys/{key_id}", headers=headers_b)
    assert resp.status_code == 404

    # Confirm it's genuinely untouched, not silently revoked under the hood.
    listed_a = await client.get("/api-keys", headers=headers_a)
    entry = next(item for item in listed_a.json() if item["id"] == key_id)
    assert entry["revoked_at"] is None
