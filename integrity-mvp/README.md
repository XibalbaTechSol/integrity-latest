# integrity-mvp

The dashboard/landing app for [Integrity Protocol](../README.md) — React 19 + Vite + TypeScript,
16 routed pages covering agent identity, prediction markets, HIPAA/Shield compliance, and
developer telemetry. Wallet-interactive: users connect a real wallet and sign real transactions
on-chain (see "Wallet-interactive model" below), not just view seeded data.

## Setup

```bash
npm install --legacy-peer-deps   # some landing-page deps declare a React <=18 peer range; app runs on React 19
cp .env.example .env             # see below for what each var does
npm run dev
```

`.env` (see `.env.example`) controls which backend/chain this build targets:

| Var | Default | What it does |
|---|---|---|
| `VITE_ORACLE_URL` | `http://localhost:8080` | `integrity-oracle` base URL — every real read on this app goes through here |
| `VITE_USERAPI_URL` | `http://localhost:8090` | `integrity-userapi` base URL — account/API-key auth (Settings page) |
| `VITE_CHAIN_ID` | `84532` (Base Sepolia) | Which `deployments.<network>.json` this app reads contract addresses from; use `31337` for a local `make chain` anvil stack |
| `VITE_MOCK_MODE` | `false` | Read-only status flag (Settings → Developer panel) reporting whether the current chain+oracle were seeded with test data via `scripts/seed_mock_data.py` — not a live toggle, see that script |

For a full local stack: `make chain` (root Makefile — real anvil + `Deploy.s.sol`) and a real
`cargo run` oracle-backend (see `integrity-oracle/README.md`) pointed at the same anvil RPC and a
Postgres/Redis pair, then set `VITE_CHAIN_ID=31337` and `VITE_ORACLE_URL` to that oracle.

## Wallet-interactive model

Every agent-attributable on-chain write (entering a market position, signing a Smart BAA) is
routed through the agent's own `SovereignAgent.execute(target, value, calldata)` — a connected
EOA can never call `IntegrityMarket`/`SmartBAA` etc. directly; only a registered agent's
`SovereignAgent` contract can (see `contracts/src/markets/IntegrityMarket.sol`'s
`AgentNotRegistered` revert). `src/hooks/useSovereignAgentWrite.ts` is the one place this pattern
is implemented — every write page reuses it rather than re-deriving it. The connected wallet must
be the selected agent's registered `controller` (checked live against `XibalbaAgentRegistry`
before any write is attempted); some actions (e.g. `SmartBAA.raiseDispute`/`arbitrate`, the
covered-entity/arbitrator side) belong to a different persona this dashboard doesn't represent —
those stay read-only here.

## What's real vs. seeded

Pages/panels reading real data from `integrity-oracle`, `integrity-userapi`, or directly from
chain: Agents, Identity (DID/ITK balance/BAA verification), Intelligence's leaderboard, Exchange's
market list and order placement, Finance's token balance, Dashboard's AIS distribution, Shield's
Smart BAA registry (read live from `SmartBAAFactory`'s event log) and sign/revoke actions,
Settings' account/API-key management, Contracts' connected-agent inspector.

Panels with no real backend to wire to yet are marked with a "Seeded demo data" badge
(`src/shared/SeededDataBadge.tsx`) rather than silently mixed with real content — this includes
node/network telemetry (no WSS streaming or OTLP ingestion built, see the root `PRODUCTION_GAPS.md`),
`ExchangePage`'s order-book/candlestick UI (`IntegrityMarket` is a pari-mutuel pool, there's no
on-chain order book this could ever honestly show), and a few `Settings` panels not wired to real
settings yet.

## Test-data seeding

`scripts/seed_mock_data.py` registers real test agents (and deploys one real market) against
whatever chain+oracle your `.env` points at — via `integrity_sdk`, the same
fund→deploy→registerPrimitives→oracle-verify sequence any real agent goes through. Not a
fake-database-rows script. Must run outside the browser (needs the protocol funder's private key,
which must never reach client JS):

```bash
cd integrity-sdk
MOCK=true FUNDER_PRIVATE_KEY=... INTEGRITY_WALLET_PASSWORD=... uv run python ../integrity-mvp/scripts/seed_mock_data.py
```

## Commands

```bash
npm run dev        # vite dev server
npm run build       # tsc -b && vite build
npm run lint        # oxlint
npm run preview     # serve the production build locally
npm test            # vitest — unit tests (services/hooks/contexts), mocked network
npm run test:e2e    # playwright — real browser against a real running backend+chain (see Setup)
```

`npm test` runs isolated unit tests (mocked `fetch`/wagmi) and needs nothing running. `npm run
test:e2e` is a real integration check — it needs `integrity-oracle` (and ideally a registered
agent) actually reachable at `VITE_ORACLE_URL`, matching this repo's "no silent mocks" testing
philosophy; see the root `docs/TESTING.md`.

---

Scaffolded from the default Vite + React + TypeScript + Oxlint template — see
[the Vite docs](https://vite.dev/guide/) for template-level tooling (HMR, the React Compiler,
Oxlint rule configuration) not covered above.
