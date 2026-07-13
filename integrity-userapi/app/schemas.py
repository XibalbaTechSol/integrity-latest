"""Wire schemas (pydantic request/response models) for integrity-userapi."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# --- Auth ---------------------------------------------------------------


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=256)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    created_at: datetime


# --- API keys -------------------------------------------------------------


class ApiKeyCreateResponse(BaseModel):
    id: UUID
    raw_key: str  # returned exactly once, never persisted or shown again
    ais_trust_ceiling: int
    created_at: datetime


class ApiKeyResponse(BaseModel):
    id: UUID
    ais_trust_ceiling: int
    revoked_at: datetime | None
    created_at: datetime


# --- Agent ownership --------------------------------------------------------


class AddAgentRequest(BaseModel):
    agent_did: str = Field(..., min_length=1)


class OwnedAgentResponse(BaseModel):
    agent_did: str
    added_at: datetime
    # Live data fanned out from integrity-oracle's GET /v1/agent/{id}. `None`
    # (with `error` set) if the oracle was unreachable or the lookup failed
    # -- this endpoint never crashes the whole response over one bad lookup,
    # and never fabricates agent data when the oracle can't be reached.
    live_data: dict[str, Any] | None = None
    error: str | None = None


# --- Demo runs -------------------------------------------------------------


class DemoRunResponse(BaseModel):
    id: UUID
    status: str
    started_at: datetime
    finished_at: datetime | None
    result_summary: dict[str, Any] | None
