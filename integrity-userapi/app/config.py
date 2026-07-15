"""
Runtime configuration for integrity-userapi, via pydantic-settings.

Every knob is read from the environment (with `.env` support for local dev).
This package's one architectural rule shows up here too: there is no
`RPC_URL` / `CHAIN_ID` / `DEPLOYMENTS_FILE` setting anywhere in this file --
this service never talks to a chain directly. The only cross-service knob
is `oracle_url`, used exclusively to proxy read-only HTTP calls to
integrity-oracle (e.g. GET /v1/agent/{id}) for `GET /me/agents`.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Postgres (user data only -- accounts, api keys, ownership pointers, demo runs) ---
    database_url: str = (
        "postgresql://integrity:integrity_dev_only@localhost:5432/integrity_userapi"
    )

    # --- integrity-oracle, called over HTTP only -- never a direct chain RPC/web3 dep here ---
    oracle_url: str = "http://localhost:8080"
    oracle_timeout_seconds: float = 5.0

    # --- JWT auth ---
    jwt_secret: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60 * 24  # 24h

    # --- API keys ---
    # Default AIS trust ceiling stamped onto every newly-issued developer API key.
    # 300 per integrity-dashboard's old "API Key Generation" convention (that
    # section no longer exists in integrity-dashboard/README.md as of this
    # writing -- grepped the whole repo, nothing defines it today -- so this
    # value is carried forward from the task spec as an honestly-documented
    # assumption, not something re-derived from a live source in this repo).
    default_api_key_trust_ceiling: int = 300

    # --- App ---
    app_name: str = "integrity-userapi"

    # --- CORS ---
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5190"]


settings = Settings()
