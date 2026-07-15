# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The dashboard frontend for Integrity Protocol — the primary product surface for interacting with
autonomous agents, analyzing their behavior (Chain of Thought traces), allocating capital
(Finance/Exchange), and monitoring the Oracle network's trust scores (AIS) and compliance state
(Identity, Shield/HIPAA). Part of the `INTEGRITY-LATEST` monorepo; see that repo's root
`CLAUDE.md` for the other packages (`integrity-oracle`, `integrity-sdk`, `contracts`, etc.) this
app talks to.

## Commands

```bash
npm install
npm run dev              # vite dev server, http://localhost:5173
npm run build             # tsc -b && vite build
npm run preview -- --port 4173
npm run lint              # oxlint (not ESLint — no .eslintrc exists; rules live in .oxlintrc.json)
npm run test               # vitest run (unit tests, jsdom)
npm run test:e2e           # playwright test — requires a REAL backend stack, see below
```

Single-test invocation:
```bash
npx vitest run src/services/oracle.test.ts   # unit test, by path
npx vitest run -t "test name"                 # unit test, by name
npx playwright test e2e/smoke.spec.ts         # single e2e file
npx playwright test -g "test name"            # e2e, by name
```

### Running against a real backend

`npm run dev` expects `integrity-oracle` at `http://localhost:8080` (configurable via
`VITE_ORACLE_URL` in `.env`, see `.env.example`) and `integrity-userapi` at
`http://localhost:8090` (`VITE_USERAPI_URL`). If the oracle is unreachable, pages degrade to
fallback data marked with a "Seeded Data" badge rather than failing — this is a deliberate UX
fallback, not silent mocking of the API layer itself.

`npm run test:e2e` (Playwright) is **not** mock-driven — per the monorepo's "no silent mocks"
rule, `e2e/smoke.spec.ts` runs against a real stack (anvil + a registered test agent +
`integrity-oracle`), started the way `docs/TESTING.md` at the monorepo root describes. It builds
and serves the production bundle (`npm run preview -- --port 4173`) rather than the dev server —
see `playwright.config.ts`'s `webServer` block.

`VITE_CHAIN_ID` (`.env`) selects which `src/deployments/deployments.<network>.json` file is read
for on-chain addresses — `84532` (Base Sepolia) or `31337` (local anvil). `VITE_MOCK_MODE` is
display-only: it filters `mock-agent-*` seeded IDs out of `oracle.listAgents()` and flags the
Settings page's "Developer" panel; it does not fabricate any data itself. Real on-chain seed
agents for local dev come from `scripts/seed_mock_data.py`, which runs through `integrity-sdk`'s
own venv (not this package's toolchain) and requires `FUNDER_PRIVATE_KEY`.

## Architecture

### Provider nesting (`src/App.tsx`)

```
WagmiProvider > QueryClientProvider > ThemeProvider > LoggerProvider > AgentProvider
  > ToastProvider > Router (BrowserRouter)
```

`AgentContext` is the global "active agent" store — on mount it calls `oracle.listAgents()` and
derives a display name from each agent's DID (there is no name field from the oracle), rather
than falling back to fabricated names. It exposes `isLoading`/`loadError` for oracle-unreachable
states. Routing is flat (`react-router-dom`, no nested layouts) — one page component per route in
`src/pages/`; `/landing` is the only route that suppresses the `Sidebar` shell.

### Services layer — mock vs. real, per file (`src/services/`)

This split is the most important thing to get right before touching data-fetching code, and it's
narrower than it might look from file count:

- **`oracle.ts`** — real `fetch` client against `integrity-oracle`. Typed DTOs are meant to mirror
  the Rust backend's handlers (`spec/ais-api/v1/openapi.yaml` at the monorepo root is the contract
  to keep in sync with). Exposes `streamUrl()` for `EventSource`-based SSE (see
  `src/hooks/useOracleStream.ts`).
- **`userapi.ts`** — real `fetch` client against `integrity-userapi` (auth/JWT, API keys, owned
  agents). JWT is kept in `sessionStorage`, deliberately not `localStorage`.
- **`api.ts`** — **fully mock**, no `fetch` calls at all. Every export
  (`getMarketTasks`/`getBenchmarks`/`fundTaskWithLoan`/`createMarketTask`/`bidOnTask`/
  `requestAudit`) returns fabricated data. Its only consumer is `src/components/ActuarialHub.tsx`.
  This is the one surface the monorepo CLAUDE.md's "still mock data" note actually applies to
  today — everything else it lists there should be treated as stale until reconciled.

For everything else that's still static rather than fetched (network-wide throughput/latency,
threat/security events, USD transaction valuation, some SSE-fed widgets), `README.md`'s
"Architectural Gaps & Next Steps" section is the authoritative, current list — it documents which
backend endpoints don't exist yet in `integrity-oracle` and what shape they'd need, rather than
this file re-describing gaps that live on the backend side.

### On-chain wiring

`src/chain/wagmi.ts` configures `wagmi` for `base`/`baseSepolia`/`foundry`; `src/chain/abis.ts` +
`src/abis/*.json` hold contract ABIs; `src/chain/deployments.ts` and
`src/deployments/deployments.*.json` resolve per-network contract addresses keyed by
`VITE_CHAIN_ID`. No path aliases are configured anywhere (no `@/*`) — all imports are relative.

### Dashboard widget grid

`src/components/widgets/` implements a registry pattern (`WidgetRegistry`) around
`react-grid-layout`, with `WidgetWrapper` as the common chrome and `TriMetricWidget` as an example
concrete widget — extend by registering a new widget rather than special-casing `DashboardPage`.

## Known quirks / stale references to verify before trusting

- `e2e/smoke.spec.ts` iterates a route list that includes `/cognition`, which is not a route
  `App.tsx` defines (only `/intelligence` exists) — likely a stale rename; check before assuming
  that test path is meaningful.
- Root-level `audit.cjs`, `audit_script.cjs`, `audit.js`, `test_puppeteer.cjs`,
  `test-screenshot.js`, `test-katex.js` are ad-hoc, previously-committed debugging scripts (screen-
  shot/console-error checks, one KaTeX rendering smoke test) — not part of the real suite. Use
  `npm run test` / `npm run test:e2e` instead. Some hardcode absolute paths from another tool's
  session directory (`~/.gemini/antigravity/...`); don't treat them as portable.
- `index.html` loads KaTeX CSS from a CDN in addition to the local import in `main.tsx` —
  redundant, not a functional issue.
