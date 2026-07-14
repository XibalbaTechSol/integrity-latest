.PHONY: setup chain up down test test-e2e sync-abis

setup:
	cd contracts && npm install
	cd integrity-oracle && cargo build
	cd integrity-sdk && uv sync
	cd integrity-cli && uv sync
	cd bcc_middleware && uv sync
	cd integrity-mvp && npm install
	cd integrity-userapi && uv sync

chain:
	touch deployments.local.json
	cd contracts && anvil &
	sleep 2
	cd contracts && FUNDER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# Extracts {abi, bytecode} for the 3 contracts integrity-sdk's chain.py needs to deploy
# directly (SovereignAgent, StateAnchor) or call (AgentPrimitivesFactory) out of forge's
# build artifacts in contracts/out/, trimmed to just what a Python caller needs — not a
# runtime cross-package filesystem dependency, a deliberate one-way sync step run after
# any contract interface change.
sync-abis:
	cd contracts && forge build
	python3 scripts/sync_abis.py

up:
	docker-compose up --build

down:
	docker-compose down

test:
	cd contracts && forge test
	cd integrity-zkp && nargo test
	cd integrity-oracle && cargo test
	cd integrity-sdk && uv run pytest
	cd integrity-cli && uv run pytest
	cd bcc_middleware && uv run pytest
	cd integrity-userapi && uv run pytest
	cd integrity-mvp && npm test

# Real browser (Playwright) end-to-end tests — a separate, slower layer from
# `test` above, deliberately not folded into it. Boots its own real anvil +
# genesis deploy + ephemeral Postgres/Redis + integrity-oracle + one real
# seeded agent (see integrity-mvp/e2e/global-setup.ts), then drives a real
# Chromium browser against the real running integrity-mvp app. See
# docs/TESTING.md for the full test-pyramid rationale and what's covered.
test-e2e:
	cd integrity-mvp && npx playwright test

