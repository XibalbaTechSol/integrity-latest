"""
Auth flow: register -> token issued, login rejects wrong password, /me
requires a valid token and returns the right user. All against the real
FastAPI app + real Postgres via the `client` fixture (conftest.py).
"""

from __future__ import annotations

import httpx

EMAIL = "alice@example.com"
PASSWORD = "correct-horse-battery-staple"


async def _register(client: httpx.AsyncClient, email: str = EMAIL, password: str = PASSWORD) -> httpx.Response:
    return await client.post("/auth/register", json={"email": email, "password": password})


async def test_register_issues_token(client: httpx.AsyncClient) -> None:
    resp = await _register(client)
    assert resp.status_code == 201
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str) and body["access_token"]


async def test_register_duplicate_email_conflicts(client: httpx.AsyncClient) -> None:
    first = await _register(client)
    assert first.status_code == 201

    second = await _register(client)
    assert second.status_code == 409


async def test_register_rejects_short_password(client: httpx.AsyncClient) -> None:
    resp = await client.post("/auth/register", json={"email": "short@example.com", "password": "short"})
    assert resp.status_code == 422


async def test_login_succeeds_with_correct_password(client: httpx.AsyncClient) -> None:
    await _register(client)
    resp = await client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


async def test_login_rejects_wrong_password(client: httpx.AsyncClient) -> None:
    await _register(client)
    resp = await client.post("/auth/login", json={"email": EMAIL, "password": "totally-wrong-password"})
    assert resp.status_code == 401


async def test_login_rejects_unknown_email(client: httpx.AsyncClient) -> None:
    resp = await client.post("/auth/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert resp.status_code == 401


async def test_me_requires_bearer_token(client: httpx.AsyncClient) -> None:
    resp = await client.get("/me")
    assert resp.status_code == 401


async def test_me_rejects_garbage_token(client: httpx.AsyncClient) -> None:
    resp = await client.get("/me", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


async def test_me_returns_the_right_user(client: httpx.AsyncClient) -> None:
    register_resp = await _register(client)
    token = register_resp.json()["access_token"]

    resp = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == EMAIL
    assert "id" in body and "created_at" in body


async def test_me_rejects_token_for_deleted_user(client: httpx.AsyncClient, db_pool) -> None:
    register_resp = await _register(client)
    token = register_resp.json()["access_token"]

    me_resp = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    user_id = me_resp.json()["id"]

    await db_pool.execute("DELETE FROM users WHERE id = $1", user_id)

    resp = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
