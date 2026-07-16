# ── BUILD STAGE ─────────────────────────────────────────────────────────────
FROM rustlang/rust:nightly-bookworm AS builder

# Install system dependencies needed for compiling OpenSSL and other crates
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/integrity

# Copy the Cargo workspace files and source code
COPY Cargo.toml Cargo.lock ./
COPY scoring-core/ scoring-core/
COPY backend/ backend/

# Build release binary
RUN cargo build --release --bin oracle-backend

# ── RUNTIME STAGE ───────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary from builder
COPY --from=builder /usr/src/integrity/target/release/oracle-backend /app/oracle-backend

EXPOSE 8080 4317

ENTRYPOINT ["/app/oracle-backend"]
