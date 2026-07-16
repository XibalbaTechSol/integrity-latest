---
title: integrity-mvp
created: 2026-07-07
updated: 2026-07-15
type: entity
tags: [infrastructure, sdk]
confidence: high
source_files:
  - integrity-mvp/src/App.tsx
  - integrity-mvp/src/config.ts
  - integrity-mvp/src/chain/wagmi.ts
  - integrity-mvp/src/chain/deployments.ts
  - integrity-mvp/src/chain/abis.ts
  - integrity-mvp/src/hooks/useSovereignAgentWrite.ts
  - integrity-mvp/src/services/oracle.ts
  - integrity-mvp/src/services/userapi.ts
  - integrity-mvp/src/services/api.ts
  - integrity-mvp/src/contexts/AgentContext.tsx
  - integrity-mvp/src/components/ConnectWalletButton.tsx
  - integrity-mvp/src/shared/SeededDataBadge.tsx
  - integrity-mvp/src/pages/*.tsx
  - integrity-mvp/src/components/widgets/TriMetricWidget.tsx
  - integrity-mvp/src/components/widgets/WidgetRegistry.tsx
  - integrity-mvp/demo/src/integrity_demo/main.py
  - integrity-mvp/demo/src/integrity_demo/userapi_bridge.py
  - integrity-mvp/scripts/seed_mock_data.py
  - integrity-mvp/.env.example
  - scripts/sync_abis.py
---

**This page was rewritten from scratch on 2026-07-12.** The version of
`integrity-mvp` it previously described (a mature app with `AgentListPage`/
`AgentDetailPage`/`MarketsPage`/`LeaderboardPage`/`WalletPage`/
`CapitalAllocationPage`, real JWT auth, a Demo/Live data-mode toggle backed
by MSW fixtures, `demo/` as a real Python scenario engine, 129 vitest +
16 Playwright specs) **no longer exists on disk.** `integrity-mvp/src/`
was independently rewritten into a new 16-page shell (all file mtimes
~2026-07-12 00:00-00:20, well after this page's prior "2026-07-11" content)
by a process outside this wiki's tracking, confirmed by the user as
intentional ("the new mvp ui") rather than accidental data loss. None of
the file paths this page previously cited under `source_files` exist
anymore. Per this wiki's own "no aspirational content" rule, the old
content has been replaced rather than patched — it described a build that
is simply gone. If you need it for historical reference, it's recoverable
from this file's prior version in your editor's/tool's history, not from
anything in the current tree.

## What actually exists now (as of 2026-07-12, this session's work)

React 19 + Vite + TypeScript, 16 routed pages (`src/App.tsx`). The
rewritten shell shipped cosmetically complete but has now been fully resolved
with real backend/chain wiring and a Notion-style drag-and-drop widget layout engine.

1. **Notion-Style Block & Widget Dashboard** — Fully implemented dynamic grid-based
   dashboard on `DashboardPage.tsx` using `react-grid-layout`. Users can toggle
   "Edit Layout" to drag blocks via grab handles (`⋮⋮`) and resize them. Includes:
   - `WidgetRegistry.tsx`: Maps widget types (`gauge`, `throughput`, `latency`, `nodes`, `events`, `radar`, `notes`) to high-fidelity components (Recharts diagrams, responsive grids, interactive text notes, nominal status lists).
   - `WidgetWrapper.tsx`: Restructures panel UI with a glassmorphism theme, drag handles, and block control dropdown menus (e.g., delete/duplicate).
   - **Local Storage Persistence**: Layout configurations and widget lists are saved to and loaded from `localStorage` (`integrity_dashboard_widgets`, `integrity_dashboard_layouts`), with a "Reset" utility to restore default structures.
   - Fixed all linter rules-of-hooks violations in the widget components.
2. **Fixed the build** — the missing `return`, the two broken imports
   (rewired to real `fetch` calls / removed dead ones), a batch of
   `noUnusedLocals`/`noUnusedParameters` cleanup, two new shared components
   (`src/shared/{Panel,StatusBadge}.tsx`) that were imported but never
   created. `npm run build` and `npm run lint` are clean; verified via a
   real Playwright pass that all 16 routes render with zero console errors.
3. **Wallet/data infrastructure** (`src/chain/`, `src/services/`,
   `src/hooks/useSovereignAgentWrite.ts`): `wagmi`+`viem`+
   `@tanstack/react-query` added; `scripts/sync_abis.py` extended to also
   emit trimmed frontend-only ABIs into `src/abis/` and copy
   `deployments.{baseSepolia,local}.json` into `src/deployments/`, the
   same one-way sync convention `integrity-sdk`/`integrity-cli` already
   use; `ConnectWalletButton` in `TopBar` (injected-connector only, no
   RainbowKit); `src/services/oracle.ts`/`userapi.ts` are typed `fetch`
   clients whose interfaces were verified field-for-field against
   `spec/ais-api/v1/openapi.yaml` (snake_case throughout, confirmed);
   `useSovereignAgentWrite` implements the one shared
   `SovereignAgent.execute(target, 0, calldata)` pattern every
   agent-attributable write needs (mirrors `integrity_sdk/markets.py`'s
   `_execute_via_agent`).
4. **Real reads wired, verified against a live local stack** (real anvil +
   real `cargo run` oracle-backend + real registered test agents via
   `integrity-cli`/the new seed script — not assumed from response shape
   alone): `AgentContext` (was 3 hardcoded fake agents, now
   `oracle.listAgents()`), `AgentsPage` (real DID/tier/AIS/created_at),
   `IntelligencePage` (new real   leaderboard panel via `oracle.getLeaderboard()`), `IdentityPage`
   (real DID + real ITK balance/open-positions via
   `oracle.getWallet()`), `ExchangePage` (real `oracle.listMarkets()` for
   the Active Markets list), `FinancePage` (real ITK balance, real historical
   transactions, and real agent allowances from `oracle.getWallet()`),
   `DashboardPage` (real AIS distribution + high-integrity % computed from real
   agent scores, live updated via `useOracleStream` SSE events). Confirmed
   end-to-end via Playwright against the real running stack: a real agent DID registered through `integrity-cli` appears verbatim in
   the browser-rendered page, sourced from a captured real network
   response — not just "the build compiles."
5. **Honest labeling for what's still simulated** — a new
   `src/shared/SeededDataBadge.tsx`, applied everywhere content has no
   real backing yet and isn't wired this pass: `ChainOfThoughtPage`,
   `SdkTelemetryPage`, `CognitionPage`, `CompareTracesPage`,
   `DocumentsPage`, `ShieldPage`, most of `ContractsPage` (the Monaco
   compile/deploy flow is a labeled sandbox, not a real compiler), parts
   of `ExchangePage` (the order-book/candlestick UI — `IntegrityMarket` is
   a pari-mutuel pool, there is no on-chain order book or price feed this
   could ever honestly show), `FinancePage`'s network-wide treasury stats
   and `ActuarialHub` (A2ACapitalPool/benchmark data — no oracle read
   endpoint exists for either), `DashboardPage`'s throughput/latency/node-
   fleet/security-event widgets (no such telemetry exists in the oracle;
   see `PRODUCTION_GAPS.md`'s WSS/OTLP/TSDB gaps), and several
   `SettingsPage` panels (Privacy Modes, Dev API Keys, Network Settings —
   none wired to a real setting yet).
6. **Mock-data seeding, done right** — `integrity-mvp/scripts/
   seed_mock_data.py` registers real test agents (and deploys one real
   market) via `integrity_sdk` the same way any real agent would register,
   gated by `MOCK=true` as an explicit safety rail. Deliberately NOT a
   "write fake rows into Postgres" script — everything it creates is a
   genuine on-chain registration, consistent with this repo's "no silent
   mocks" rule. Must run outside the browser (`cd integrity-sdk && uv run
   python ../integrity-mvp/scripts/seed_mock_data.py`) since it needs the
   protocol funder's private key, which must never reach client JS.
   `VITE_MOCK_MODE` (`.env`, build-time, read-only in the UI) just reports
   whether the current build is pointed at a seeded stack — it is not, and
   architecturally cannot be, a live browser toggle that itself seeds
   anything. `SettingsPage`'s new "Developer" panel shows this status plus
   a copyable seed command.
8. **Wallet-interactive writes, for real (Phase 3, 2026-07-12)**: `ExchangePage`'s "Place Order" panel now performs a real two-transaction `IntegrityToken.approve` + `IntegrityMarket.enterPosition` flow (both routed through `SovereignAgent.execute` via `useSovereignAgentWrite`), gated on the connected wallet matching the selected agent's on-chain `controller`. `ShieldPage`'s Smart BAA registry now reads real `SmartBAAFactory.BAACreated` event logs (no oracle endpoint needed — a direct `getLogs` call) and wires real `sign()`/`revoke()` writes for the business-associate side. **`ClaimAgentModal` was fundamentally rewritten**, not just fixed: the previous "claim an agent via signature challenge" premise has no on-chain support at all — `SovereignAgent.rotateController()` is `onlyController`-gated, there is no mechanism for a third party to take over an agent, and the old code submitted a transaction using ERC-20 `approve`'s selector as if it were a claim call, silently swallowing the inevitable failure. The rewritten modal ("Verify Agent Control") does something real instead: resolves the on-chain controller from `XibalbaAgentRegistry`, compares it to the connected wallet, and has the user `personal_sign` a message as a "prove you hold this key now" confirmation — no fake API calls, no transaction that was never going to succeed. All three write paths verified against a real local anvil + oracle stack: a real `enterPosition` transaction moved a market's `outcome_staked` from 0 to a real non-zero value, confirmed via Playwright reading the post-transaction UI state from a real oracle HTTP response.
9. **userapi auth, tests, and docs (Phases 4-6, 2026-07-12)**: `SettingsPage`'s login/register/API-key management (built by work concurrent with this session, not itemized separately above) verified end-to-end via Playwright against a real running `integrity-userapi` + isolated Postgres — register, then a real `POST /api-keys` call, confirmed by the key appearing in a subsequent real `GET /api-keys` re-fetch. Added real test infrastructure: `vitest` (9 unit tests — `oracle.ts` client request-shape assertions, `useSovereignAgentWrite`'s `execute()`-wrapping logic, `AgentContext`'s real-vs-old-hardcoded-fixture behavior, all with mocked network) and `@playwright/test` (`e2e/smoke.spec.ts`, 18 tests — all 16 routes zero-console-error, a real-network-response assertion on `AgentsPage`, wallet-connect-button presence — run against a real live backend+chain per this repo's testing philosophy, not mocked). Rewrote `integrity-mvp/README.md` from the default Vite scaffold into real project docs (setup, env vars, the wallet-interactive model, what's real vs. seeded, test commands).
10. **UI Validation and Agent Selection (2026-07-14)**: Resolved strict TypeScript compilation errors across `DashboardPage.tsx` and `FinancePage.tsx` that were preventing `npm run build` from succeeding. Fixed the agent selection logic by propagating `selectedAgentId` filtering from `AgentContext` to `DashboardPage` and `ChainOfThoughtPage`, ensuring the SSE streaming hooks correctly filter live OTLP and AIS data based on the active agent. Updated the `README.md` to comprehensively detail the MVP's structure and testing requirements, explicitly noting architectural gaps such as the lack of OTel telemetry aggregation and security event persistence in the Oracle backend.
11. **UI Layout and Legacy Aesthetic Integration (2026-07-15)**: 
    - `AgentsPage`: Extracted the `ClaimAgentModal` and `AgentOnboarding` workflows from isolated modals into prominent inline dashboard cards above the agents grid, significantly improving discoverability of the onboarding pipeline.
    - `IdentityPage`: Fundamentally refactored to replicate the core layout and aesthetics of the legacy `integrity-dashboard` codebase. Replaced giant glassmorphism panels with a compact Agent Status Strip (DID, AIS, Tier, TEE), a dedicated Hero Bar, and a sub-navigation tab interface sorting components into `Identity & DID`, `Enclave & Security`, `Economic Capacity`, and `Credentials`. 
    - `XNS`: Fully wired the `XNSSearchService` into the Identity page's UI layout.
    - `ContractsPage`: Expanded the IDE workstation with full features: multi-tab editor for files, interactive build/deploy panel, and a dynamic "Deployed Contracts" inspector that generates interactive ABI buttons via source code regex analysis.

## `TriMetricWidget` fixed 2026-07-15 — was the most severe fake-data surface in the dashboard

The dashboard's "Tri-Metric Risk Analysis" panel badged itself "LIVE MODEL"
while every number was fake: `avgAis` picked from 3 hardcoded magic
constants, `blockedRate`/`riskExposure` literal strings with no
computation, all 3 sparklines fabricated trend arrays — unlike every
sibling in `WidgetRegistry.tsx`, which either fetched real data or
disclosed via `SeededDataBadge`. Two of the three metrics are now real:
**AIS Deficit** and **BCC Intent Violation Rate** fan out `oracle.getAis()`
across every agent in the global `AgentContext` (same pattern the `gauge`
widget already used) and average real `ais`/`components.compliance`. The
third ("Smart BAA Value at Risk") stays honestly marked unavailable — no
probability-of-leak model or network-wide staked-collateral index exists
anywhere in this protocol (same conclusion independently reached for
`ActuarialHub`, below). Two real runtime bugs were only caught by actually
loading the dashboard against the live stack, not by `tsc`/`lint`/`build`:
a KaTeX-remount render-storm that froze the browser tab (the 3 formula
sub-components were redefined as new component types on every render —
fixed by hoisting them to module scope) and a grid-height clipping bug
once real content replaced the old sparkline decoration (`DEFAULT_LAYOUTS`
bumped `h: 2` → `h: 3`). Re-verified via live screenshots against a real
registered agent, not just a passing test suite.

## What is NOT done yet

- `integrity-mvp/demo/` (the Python scenario-engine directory `make demo`
  references) **now exists on disk** (as of 2026-07-15) — the prior version
  of this bullet was stale. It's a real scenario engine (`integrity_demo`
  package) that registers 4 persona agents and exercises a capital-
  allocation tool-call loop against a live chain; as of 2026-07-15 it also
  has an opt-in completion-callback bridge into `integrity-userapi`'s
  `demo_runs` table (`userapi_bridge.py` — see
  [integrity-userapi](integrity-userapi.md)). Still genuinely missing: no
  UI trigger anywhere in this dashboard creates a `demo_runs` row or
  launches this CLI process — it remains an operator-run script against
  live Base Sepolia using a funder private key.
- `ExchangePage`'s order-book/candlestick UI and `DashboardPage`'s
  latency/node-fleet/security-event widgets remain honestly seeded
  (`SeededDataBadge`) — no on-chain order book exists for a pari-mutuel
  market, and no WSS/OTLP telemetry-streaming infra exists yet (see root
  `PRODUCTION_GAPS.md`). **`throughput` is no longer in this list** — it
  was wired to real `oracle.getTelemetryVolume`/`getOtelVolume` data
  earlier this session; the claim that it was still seeded was stale.
- `ShieldPage`'s "Propose BAA Contract" (creating a new BAA) is a disabled
  stub — it requires acting as the covered-entity persona, which this
  dashboard's single-connected-wallet model doesn't represent.
- Bundle size: a single ~1.9MB JS chunk (KaTeX, Monaco, and the full wagmi/
  viem/@wagmi/core surface all ship in the main bundle) — noted by Vite's
  own build warning, not yet addressed with code-splitting.
- **Architectural Gaps for Complete Data**: The Dashboard's Hero Metrics (throughput/latency) require an OTel metrics sink in `integrity-oracle` to aggregate tracing data. Security event alerts (blocked interactions) need event-sourcing in the Oracle to capture `bcc_middleware` policy evaluations. Transaction history requires retroactive USD pricing via an external price feed integration in the Oracle.

Related: [integrity-oracle](integrity-oracle.md),
[integrity-userapi](integrity-userapi.md) (the `demo/` scenario engine's
completion-callback bridge target),
[AIS API spec](../concepts/ais-api-spec.md) (the field-shape source of
truth `oracle.ts` was verified against), [Agent Primitives](../concepts/agent-primitives.md)
(the `SovereignAgent.execute` write convention).
