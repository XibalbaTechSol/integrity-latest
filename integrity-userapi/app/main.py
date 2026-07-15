"""
integrity-userapi -- user accounts, developer API keys, agent ownership
pointers, and per-user demo run history for the Integrity Protocol.

Hard boundary (see README.md): this service NEVER calls a smart contract or
a chain RPC directly. The only outbound integration is `app/oracle_client.py`,
a plain HTTP client that fans out to integrity-oracle for anything
protocol/agent-related. Nothing here imports web3/alloy, and `user_agents`
stores only a DID pointer, never a cache of full agent state.
"""

from __future__ import annotations

import asyncio
import asyncpg
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from uuid import UUID

from app import db, oracle_client
from app.config import Settings, settings as default_settings
from app.deps import get_current_user_id, get_pool, get_settings
from app.schemas import (
    AddAgentRequest,
    ApiKeyCreateResponse,
    ApiKeyResponse,
    DemoRunResponse,
    LoginRequest,
    OwnedAgentResponse,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.security import (
    create_access_token,
    generate_api_key,
    hash_password,
    verify_password,
)

app = FastAPI(title="integrity-userapi", version="0.1.0")

# integrity-mvp (the browser dashboard, task #21) is a cross-origin caller by
# construction -- it's served by Vite on its own port (5173 dev / 5190 e2e),
# never the same origin as this API. To ensure security, CORS origins are explicitly
# restricted to trusted frontend domains instead of using a wildcard '*'.
app.add_middleware(
    CORSMiddleware,
    allow_origins=default_settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    # Skipped when a test harness has already attached a pool to app.state
    # (httpx's ASGITransport does not run lifespan events by default, so
    # tests set app.state.pool themselves before constructing the client --
    # see tests/conftest.py). Real deployments (uvicorn) always hit this.
    if getattr(app.state, "pool", None) is not None:
        return
    app.state.pool = await db.create_pool(default_settings.database_url)
    await db.run_migrations(app.state.pool)


@app.on_event("shutdown")
async def _shutdown() -> None:
    pool = getattr(app.state, "pool", None)
    if pool is not None:
        await pool.close()


@app.get("/health")
async def health() -> dict:
    return {"status": "online", "service": "integrity-userapi"}


# --- Auth -------------------------------------------------------------------


@app.post(
    "/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    body: RegisterRequest,
    pool: asyncpg.Pool = Depends(get_pool),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    existing = await pool.fetchrow("SELECT id FROM users WHERE email = $1", body.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="email already registered"
        )

    hashed = hash_password(body.password)
    row = await pool.fetchrow(
        "INSERT INTO users (email, hashed_password) VALUES ($1, $2) RETURNING id",
        body.email,
        hashed,
    )
    token = create_access_token(user_id=str(row["id"]), settings=settings)
    return TokenResponse(access_token=token)


@app.post("/auth/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    pool: asyncpg.Pool = Depends(get_pool),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    row = await pool.fetchrow(
        "SELECT id, hashed_password FROM users WHERE email = $1", body.email
    )
    if row is None or not verify_password(body.password, row["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid email or password"
        )

    token = create_access_token(user_id=str(row["id"]), settings=settings)
    return TokenResponse(access_token=token)


@app.get("/me", response_model=UserResponse)
async def me(
    user_id: str = Depends(get_current_user_id),
    pool: asyncpg.Pool = Depends(get_pool),
) -> UserResponse:
    row = await pool.fetchrow(
        "SELECT id, email, created_at FROM users WHERE id = $1", UUID(user_id)
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="user not found"
        )
    return UserResponse(**dict(row))


# --- API keys -----------------------------------------------------------------


@app.post(
    "/api-keys",
    response_model=ApiKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_key(
    user_id: str = Depends(get_current_user_id),
    pool: asyncpg.Pool = Depends(get_pool),
    settings: Settings = Depends(get_settings),
) -> ApiKeyCreateResponse:
    raw_key, key_hash = generate_api_key()
    row = await pool.fetchrow(
        """
        INSERT INTO api_keys (user_id, key_hash, ais_trust_ceiling)
        VALUES ($1, $2, $3)
        RETURNING id, created_at
        """,
        UUID(user_id),
        key_hash,
        settings.default_api_key_trust_ceiling,
    )
    return ApiKeyCreateResponse(
        id=row["id"],
        raw_key=raw_key,
        ais_trust_ceiling=settings.default_api_key_trust_ceiling,
        created_at=row["created_at"],
    )


@app.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    user_id: str = Depends(get_current_user_id),
    pool: asyncpg.Pool = Depends(get_pool),
) -> list[ApiKeyResponse]:
    rows = await pool.fetch(
        """
        SELECT id, ais_trust_ceiling, revoked_at, created_at
        FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC
        """,
        UUID(user_id),
    )
    return [ApiKeyResponse(**dict(row)) for row in rows]


@app.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: UUID,
    user_id: str = Depends(get_current_user_id),
    pool: asyncpg.Pool = Depends(get_pool),
) -> None:
    result = await pool.execute(
        """
        UPDATE api_keys SET revoked_at = now()
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        """,
        key_id,
        UUID(user_id),
    )
    # asyncpg's execute() returns a tag string like "UPDATE 0" / "UPDATE 1".
    if result == "UPDATE 0":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="api key not found"
        )


# --- Agent ownership ----------------------------------------------------------


@app.get("/me/agents", response_model=list[OwnedAgentResponse])
async def list_my_agents(
    user_id: str = Depends(get_current_user_id),
    pool: asyncpg.Pool = Depends(get_pool),
    settings: Settings = Depends(get_settings),
) -> list[OwnedAgentResponse]:
    rows = await pool.fetch(
        "SELECT agent_did, added_at FROM user_agents WHERE user_id = $1 ORDER BY added_at DESC",
        UUID(user_id),
    )
    lookups = await asyncio.gather(
        *(oracle_client.fetch_agent(row["agent_did"], settings) for row in rows)
    )

    results: list[OwnedAgentResponse] = []
    for row, lookup in zip(rows, lookups):
        results.append(
            OwnedAgentResponse(
                agent_did=row["agent_did"],
                added_at=row["added_at"],
                live_data=lookup.live_data,
                error=lookup.error,
            )
        )
    return results


@app.post(
    "/me/agents", response_model=OwnedAgentResponse, status_code=status.HTTP_201_CREATED
)
async def add_my_agent(
    body: AddAgentRequest,
    user_id: str = Depends(get_current_user_id),
    pool: asyncpg.Pool = Depends(get_pool),
    settings: Settings = Depends(get_settings),
) -> OwnedAgentResponse:
    row = await pool.fetchrow(
        """
        INSERT INTO user_agents (user_id, agent_did) VALUES ($1, $2)
        ON CONFLICT (user_id, agent_did) DO UPDATE SET agent_did = EXCLUDED.agent_did
        RETURNING agent_did, added_at
        """,
        UUID(user_id),
        body.agent_did,
    )
    lookup = await oracle_client.fetch_agent(row["agent_did"], settings)
    return OwnedAgentResponse(
        agent_did=row["agent_did"],
        added_at=row["added_at"],
        live_data=lookup.live_data,
        error=lookup.error,
    )


# --- Demo runs ------------------------------------------------------------------


@app.post(
    "/demo/run", response_model=DemoRunResponse, status_code=status.HTTP_201_CREATED
)
async def start_demo_run(
    user_id: str = Depends(get_current_user_id),
    pool: asyncpg.Pool = Depends(get_pool),
) -> DemoRunResponse:
    # This endpoint ONLY records that a run was requested, for history/audit.
    # It does not orchestrate anything and never fabricates a "completed"
    # result -- actual execution is integrity-demo's job (a separate
    # package/process, not touched here).
    row = await pool.fetchrow(
        """
        INSERT INTO demo_runs (user_id, status) VALUES ($1, 'pending')
        RETURNING id, status, started_at, finished_at, result_summary
        """,
        UUID(user_id),
    )
    return DemoRunResponse(**dict(row))


@app.get("/demo/runs", response_model=list[DemoRunResponse])
async def list_demo_runs(
    user_id: str = Depends(get_current_user_id),
    pool: asyncpg.Pool = Depends(get_pool),
) -> list[DemoRunResponse]:
    rows = await pool.fetch(
        """
        SELECT id, status, started_at, finished_at, result_summary
        FROM demo_runs WHERE user_id = $1 ORDER BY started_at DESC
        """,
        UUID(user_id),
    )
    return [DemoRunResponse(**dict(row)) for row in rows]
