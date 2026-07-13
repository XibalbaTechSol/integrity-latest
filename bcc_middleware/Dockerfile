FROM python:3.12-slim

WORKDIR /app

# uv gives us reproducible, lockfile-pinned installs -- matches the rest of
# the monorepo's Python packages (integrity-sdk, integrity-cli).
RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY app ./app
COPY policies ./policies

# docker-compose.yml's bcc-middleware service sets OPA_URL / ORACLE_URL and
# maps port 8000 -- see docs/INTERFACE_CONTRACT.md §2.
ENV OPA_URL=http://opa:8181 \
    ORACLE_URL=http://oracle-backend:8080 \
    RPC_URL=http://host.docker.internal:8545

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
