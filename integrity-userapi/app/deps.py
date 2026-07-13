"""FastAPI dependency wiring: DB pool access and JWT bearer auth."""

from __future__ import annotations

import asyncpg
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, settings as default_settings
from app.security import TokenError, decode_access_token

_bearer_scheme = HTTPBearer(auto_error=False)


def get_settings() -> Settings:
    return default_settings


async def get_pool(request: Request) -> asyncpg.Pool:
    return request.app.state.pool


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
    pool: asyncpg.Pool = Depends(get_pool),
) -> str:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")
    try:
        user_id = decode_access_token(credentials.credentials, settings)
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"invalid token: {exc}") from exc

    row = await pool.fetchrow("SELECT id FROM users WHERE id = $1", user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user no longer exists")
    return user_id
