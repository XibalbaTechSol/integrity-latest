---
title: integrity-userapi
created: 2026-07-09
updated: 2026-07-09
type: entity
tags: [infrastructure, identity]
confidence: high
source_files:
  - integrity-userapi/app/main.py
  - integrity-userapi/app/db.py
  - integrity-userapi/app/deps.py
  - integrity-userapi/app/security.py
  - integrity-userapi/app/oracle_client.py
  - integrity-userapi/app/schemas.py
  - integrity-userapi/app/config.py
  - integrity-userapi/migrations/0001_init.sql
  - integrity-userapi/tests/conftest.py
  - docker-compose.yml
---

FastAPI + Postgres service owning **user-facing account data only** —
accounts, developer API keys, which agent DIDs a human user has claimed as
theirs, and demo-run request history. It is the strictly non-chain half of
the backend split (see [Interface Contract](../../INTERFACE_CONTRACT.md)
§6.10, §13): it never imports `web3`/`alloy`-equivalent tooling and never
reads a `deployments.*.json` file. `app/oracle_client.py` is the *only*
place this package talks to another service — a plain `httpx` HTTP client
fanning out to [integrity-oracle](integrity-oracle.md), never a direct
chain RPC.

## Endpoints

`POST /auth/register`, `POST /auth/login`, `GET /me` — JWT bearer auth
(`app/security.py`: argon2 password hashing via `passlib` — deliberately
`argon2`, not `bcrypt`, since `passlib[bcrypt]` 1.7.4 breaks against
`bcrypt>=4.1`'s removed `__about__.__version__`). `POST /api-keys` /
`GET /api-keys` / `DELETE /api-keys/{id}` — developer API keys are random
high-entropy tokens (`uak_<43 b64url chars>`), returned once, persisted only
as a sha256 hash (fast deterministic hash is correct here since the input is
already 256 bits of entropy, unlike a human password). `GET /me/agents` /
`POST /me/agents` — `user_agents` stores an ownership **pointer** only
(`user_id`, `agent_did`); every `GET` fans out live to
`integrity-oracle`'s `GET /v1/agent/{id}` per owned DID rather than caching
agent state locally. `POST /demo/run` / `GET /demo/runs` — records that a
run was *requested*, starting at `status='pending'`; this service never
orchestrates a demo or fabricates a `'completed'` result (that's
[integrity-mvp](integrity-mvp.md)'s `demo/` engine, a separate process).

## The oracle tri-state

`oracle_client.fetch_agent` never raises and never fabricates data. It
returns `AgentLookupResult(live_data, error)` in exactly one of three
states: live data (`error=None`), not found (`live_data=None,
error="agent not found on oracle"` on a 404), or oracle unreachable
(`live_data=None, error="oracle unreachable: ..."` on any `httpx.HTTPError`
— connection refused, timeout, DNS failure). A single bad lookup in
`GET /me/agents`'s per-agent loop never crashes the whole response; the
caller always gets an honest state, never a silently-empty
`live_data: null` standing in for "couldn't check."

## Open gap, honestly scoped (not a bug)

No endpoint currently *authenticates* a request using a raw developer API
key — `app/deps.py::get_current_user_id` only ever decodes a JWT bearer
token. `api_keys.key_hash` is written and read back for
management/listing/revocation, but nothing looks it up to gate a request
yet. So "a revoked key can't be reused" isn't a testable regression today —
there is no code path that uses a raw key at all. What *is* real and
tested: create/list/revoke round-trip, a revoked or unknown key 404s on a
second revoke, and one user can't revoke another's key.

## Tests and Postgres wiring

**33 pytest tests, all against a real Postgres — never sqlite, never a
mocked DB.** `docker-compose.yml` has a dedicated `userapi-postgres`
service (`postgres:16-alpine`, `integrity`/`integrity_dev_only`, db
`integrity_userapi`, host port **5435** — its own instance, deliberately
never sharing integrity-oracle's `postgres` service on 5432 or its ad hoc
5434 e2e-test convention, since two separate Postgres instances per trust
domain is the point of the §6.10 split) and a `userapi` app service
(`integrity-userapi/Dockerfile`, uv-based like `bcc_middleware`'s, port
8090). `tests/conftest.py` auto-creates a dedicated
`integrity_userapi_test` database on the same server, forces `DATABASE_URL`
and `ORACLE_URL` before `app.config` is ever imported (so a dev/CI shell's
ambient `ORACLE_URL` — a documented shared env var — can never leak into
the "oracle unreachable" test and make it flaky-green), truncates all
tables between tests, and drives the real FastAPI startup/shutdown lifespan
via `asgi-lifespan`'s `LifespanManager` so `app/db.py`'s real
`run_migrations` runs on every test's setup — not a hand-rolled schema
substitute. The `GET /me/agents` tri-state is tested against a real local
`ThreadingHTTPServer` standing in for the oracle (real socket, real HTTP,
real JSON parsing through `fetch_agent`), never a mock of
`oracle_client`'s internals. Unlike `integrity-oracle`'s opt-in/env-gated
e2e test, this suite has **no skip path** — it fails hard at collection if
`userapi-postgres` isn't reachable, matching the package's stated
completion gate.

Verified manually (not just via pytest): `docker compose build userapi`
succeeds; `docker compose up -d --no-deps userapi` boots against
`userapi-postgres` over the compose network, `GET /health` returns
`{"status":"online","service":"integrity-userapi"}`, and
`schema_migrations` shows `0001_init.sql` applied.

## CORS (added 2026-07-09, real gap)

`app/main.py` had no CORS policy before this pass — a real, hard-blocking
gap for the one browser caller this service exists to serve
([integrity-mvp](integrity-mvp.md)'s dashboard, a different origin by
construction). Fixed with `CORSMiddleware` (`allow_origins=["*"]`,
`allow_credentials=False` — every authenticated call carries a bearer JWT,
never a cookie, so this is safe). Verified: all 33 pytest tests unaffected
(CORS is a browser-enforced concern, invisible server-side); a real
cross-origin call from `integrity-mvp` now succeeds
(`integrity-mvp/e2e/auth.spec.ts`, against a real `uvicorn` instance
`integrity-mvp/e2e/global-setup.ts` now boots on its own ephemeral
Postgres database, port 8093 for E2E — see
[Interface Contract](../../INTERFACE_CONTRACT.md) §14).

Related: [integrity-oracle](integrity-oracle.md) (the only service this
one talks to), [DID](../concepts/did.md), [Interface Contract](../../INTERFACE_CONTRACT.md) §13-§14,
[integrity-mvp](integrity-mvp.md) (the one real caller of this service's
auth endpoints).
