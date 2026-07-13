FROM python:3.12-slim

WORKDIR /app

# uv gives us reproducible, lockfile-pinned installs -- matches the rest of
# the monorepo's Python packages (integrity-sdk, integrity-cli, bcc_middleware).
RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY app ./app
COPY migrations ./migrations

# docker-compose.yml's userapi service sets DATABASE_URL / ORACLE_URL and
# maps port 8090 -- see docs/INTERFACE_CONTRACT.md §2 and §13. This service
# never gets an RPC_URL/CHAIN_ID -- it never talks to a chain directly.
ENV DATABASE_URL=postgres://integrity:integrity_dev_only@userapi-postgres:5432/integrity_userapi \
    ORACLE_URL=http://oracle-backend:8080

EXPOSE 8090

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
