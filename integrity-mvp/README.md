# Integrity MVP (Dashboard)

The unified React/Vite/TS dashboard for the Integrity Protocol. It serves as the primary product surface for interacting with autonomous agents, analyzing their behavior, allocating capital, and monitoring the Oracle network.

## Architecture

This application is built with:
- **React + Vite** for fast development and building.
- **TypeScript** for strict type safety.
- **Lucide React** for iconography.
- **Recharts** for data visualization.
- **React-Grid-Layout** for a customizable, widget-based dashboard.

It interfaces directly with the `integrity-oracle` backend to stream real-time agent telemetry, market data, and trust scores (AIS - Agentic Integrity Score).

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Development Server**
   ```bash
   npm run dev
   ```
   *Note: Ensure the `integrity-oracle` backend is running (typically at `http://localhost:8080`) to provide real data. If the backend is unavailable, the UI gracefully degrades to display fallback mock data, clearly marked with a "Seeded Data" badge.*

3. **Build for Production**
   ```bash
   npm run build
   ```

4. **Preview Production Build**
   ```bash
   npm run preview -- --port 4173
   ```

## Testing

End-to-End tests are powered by Playwright. As per the repository's "No Silent Mocks" rule, these tests execute against a real backend stack.

```bash
npm run test:e2e
```

*Note: E2E tests require the backend infrastructure (Anvil, Postgres, Oracle) to be running. Review `docs/TESTING.md` for the overarching test philosophy.*

## Architectural Gaps & Next Steps

Following the core directive to build a truthful system without "aspirational" mock data, several architectural gaps have been identified that require backend extensions to achieve a fully working system:

1. **OpenTelemetry (OTel) Aggregation for Network Metrics**
   - **Current State**: The Dashboard's Hero Metrics (Node Throughput, Average Latency, Blocks Analyzed) are currently static.
   - **Gap**: The `integrity-oracle` does not yet aggregate distributed tracing or metric data from agent OTel pipelines to compute network-wide throughput or latency. 
   - **Solution**: Implement an OTel metrics sink in `integrity-oracle` (or integrate with Prometheus) to expose a `/v1/network/metrics` endpoint that streams real-time `rate(events)` and `avg(duration)`.

2. **Threat Alerts / Security Events**
   - **Current State**: Security alerts (e.g., "Anomalous contract interaction blocked") are simulated.
   - **Gap**: While `bcc_middleware` performs OPA policy evaluation, these gating events are not persistently logged and exposed to the MVP.
   - **Solution**: The Oracle needs an event-sourcing layer to capture blocked transactions and policy violations, making them queryable via a `/v1/network/events` endpoint.

3. **Transaction USD Valuation**
   - **Current State**: `TransactionDto` permits `usd: string | null`, as the Oracle currently lacks a price-feed mechanism to evaluate historical transactions in USD.
   - **Gap**: To provide accurate portfolio valuation, the Oracle must integrate with an external price feed (e.g., Chainlink) to retroactively price tokens during transaction ingestion.
