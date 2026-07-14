# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> every route renders without a console/page error >> GET /intelligence
- Location: e2e/smoke.spec.ts:11:9

# Error details

```
Error: console/page errors on /intelligence: Failed to load resource: net::ERR_CONNECTION_REFUSED; Failed to load resource: net::ERR_CONNECTION_REFUSED

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "Failed to load resource: net::ERR_CONNECTION_REFUSED",
+   "Failed to load resource: net::ERR_CONNECTION_REFUSED",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - link "Xibalba Solutions Logo" [ref=e7] [cursor=pointer]:
        - /url: /landing
        - img "Xibalba Solutions Logo" [ref=e8]
      - button [ref=e9] [cursor=pointer]:
        - img [ref=e10]
    - navigation [ref=e13]:
      - generic [ref=e14]: Core
      - link "Dashboard" [ref=e15] [cursor=pointer]:
        - /url: /
        - generic [ref=e17]:
          - img [ref=e19]
          - generic [ref=e24]: Dashboard
      - link "Agents" [ref=e25] [cursor=pointer]:
        - /url: /agents
        - generic [ref=e27]:
          - img [ref=e29]
          - generic [ref=e34]: Agents
      - link "Identity" [ref=e35] [cursor=pointer]:
        - /url: /identity
        - generic [ref=e37]:
          - img [ref=e39]
          - generic [ref=e48]: Identity
      - generic [ref=e49]: Integrity Protocol
      - link "Markets Escrow" [ref=e50] [cursor=pointer]:
        - /url: /exchange
        - generic [ref=e52]:
          - img [ref=e54]
          - generic [ref=e57]: Markets Escrow
      - link "Chain of Thought" [ref=e58] [cursor=pointer]:
        - /url: /chain-of-thought
        - generic [ref=e60]:
          - img [ref=e62]
          - generic [ref=e67]: Chain of Thought
      - link "Compare Traces" [ref=e68] [cursor=pointer]:
        - /url: /compare-traces
        - generic [ref=e70]:
          - img [ref=e72]
          - generic [ref=e77]: Compare Traces
      - link "SDK Telemetry" [ref=e78] [cursor=pointer]:
        - /url: /telemetry
        - generic [ref=e80]:
          - img [ref=e82]
          - generic [ref=e84]: SDK Telemetry
      - link "Finance" [ref=e85] [cursor=pointer]:
        - /url: /finance
        - generic [ref=e87]:
          - img [ref=e89]
          - generic [ref=e91]: Finance
      - link "Intelligence" [ref=e92] [cursor=pointer]:
        - /url: /intelligence
        - generic [ref=e94]:
          - img [ref=e96]
          - generic [ref=e104]: Intelligence
      - link "Shield Compliance" [ref=e105] [cursor=pointer]:
        - /url: /shield
        - generic [ref=e107]:
          - img [ref=e109]
          - generic [ref=e112]: Shield Compliance
      - generic [ref=e113]: System
      - link "Contracts" [ref=e114] [cursor=pointer]:
        - /url: /contracts
        - generic [ref=e116]:
          - img [ref=e118]
          - generic [ref=e121]: Contracts
      - link "Documents" [ref=e122] [cursor=pointer]:
        - /url: /documents
        - generic [ref=e124]:
          - img [ref=e126]
          - generic [ref=e129]: Documents
      - link "Audit Logs" [ref=e130] [cursor=pointer]:
        - /url: /audit
        - generic [ref=e132]:
          - img [ref=e134]
          - generic [ref=e137]: Audit Logs
    - generic [ref=e139] [cursor=pointer]:
      - img [ref=e141]
      - generic [ref=e144]:
        - generic [ref=e145]: Admin User
        - generic [ref=e146]: Manager
  - generic [ref=e147]:
    - generic [ref=e148]:
      - heading "Intelligence Command | TELEMETRY" [level=1] [ref=e150]
      - generic [ref=e151]:
        - generic [ref=e153] [cursor=pointer]:
          - generic [ref=e154]:
            - generic [ref=e155]: Active Agent
            - generic [ref=e156]: Select Agent
          - img [ref=e157]
        - generic [ref=e159]:
          - img [ref=e160]
          - textbox "Search" [ref=e163]
        - generic [ref=e165] [cursor=pointer]:
          - img [ref=e166]
          - generic [ref=e169]: "2"
        - button "Connect Wallet" [ref=e170] [cursor=pointer]:
          - img [ref=e171]
          - text: Connect Wallet
    - generic [ref=e174]:
      - generic [ref=e176]:
        - generic [ref=e177]:
          - generic [ref=e178]:
            - img [ref=e180]
            - heading "Intelligence Command" [level=1] [ref=e182]
            - generic [ref=e183]: LIVE
          - paragraph [ref=e185]: Real-time telemetry, reasoning traces & trajectory analysis
        - generic [ref=e186]:
          - img [ref=e187]
          - text: Oracle Engine v9.0.2 — Nominal
      - generic [ref=e190]:
        - generic [ref=e191]:
          - generic [ref=e192]:
            - img [ref=e193]
            - generic [ref=e195]: Filters
          - generic [ref=e196]:
            - button "✓ Telemetry Stream" [ref=e197] [cursor=pointer]
            - button "✓ Radar Graphs" [ref=e198] [cursor=pointer]
            - button "+ Cognition & Reasoning" [ref=e199] [cursor=pointer]
            - button "✓ Semantic Drift" [ref=e200] [cursor=pointer]
            - button "✓ Enclave Memory" [ref=e201] [cursor=pointer]
        - button "+ Add Custom Telemetry" [ref=e202] [cursor=pointer]
      - generic [ref=e203]:
        - heading "REPUTATION LEADERBOARD LIVE" [level=2] [ref=e204]:
          - img [ref=e205]
          - text: REPUTATION LEADERBOARD
          - generic [ref=e211]: LIVE
        - generic [ref=e213]: Could not reach the Integrity Oracle (Failed to fetch).
      - generic [ref=e214]:
        - generic [ref=e215]: Node Telemetry
        - generic "This panel shows simulated content, not live oracle/chain data." [ref=e216]:
          - img [ref=e217]
          - text: Seeded demo data
      - generic [ref=e219]:
        - generic [ref=e220]:
          - img [ref=e222]
          - generic [ref=e224]:
            - generic [ref=e225]: "142"
            - generic [ref=e226]: Active Nodes
        - generic [ref=e227]:
          - img [ref=e229]
          - generic [ref=e237]:
            - generic [ref=e238]: 12,402
            - generic [ref=e239]: Aggregate AIS
        - generic [ref=e240]:
          - img [ref=e242]
          - generic [ref=e246]:
            - generic [ref=e247]: "0"
            - generic [ref=e248]: Active Disputes
        - generic [ref=e249]:
          - img [ref=e251]
          - generic [ref=e253]:
            - generic [ref=e254]: 0.8%
            - generic [ref=e255]: Semantic Drift
        - generic [ref=e256]:
          - img [ref=e258]
          - generic [ref=e260]:
            - generic [ref=e261]: 412 MB
            - generic [ref=e262]: Enclave Memory
      - generic [ref=e263]:
        - generic [ref=e264]:
          - heading "MULTI-DIMENSIONAL INTEGRITY RADAR Seeded demo data" [level=2] [ref=e265]:
            - img [ref=e266]
            - text: MULTI-DIMENSIONAL INTEGRITY RADAR
            - generic "This panel shows simulated content, not live oracle/chain data." [ref=e274]:
              - img [ref=e275]
              - text: Seeded demo data
          - generic [ref=e279]:
            - list [ref=e281]:
              - listitem [ref=e282]:
                - img "Agent Alpha legend icon" [ref=e283]
                - text: Agent Alpha
              - listitem [ref=e285]:
                - img "Agent Beta legend icon" [ref=e286]
                - text: Agent Beta
            - application [ref=e288]:
              - generic [ref=e311]:
                - generic [ref=e313]: ZK Proving Speed
                - generic [ref=e316]: BCC Compliance
                - generic [ref=e318]: On-Chain Settlement
                - generic [ref=e321]: Intent Drift
                - generic [ref=e323]: Enclave Uptime
                - generic [ref=e326]: Policy Latency
                - generic [ref=e328]: Gas Efficiency
                - generic [ref=e331]: Agent Integrity Score
        - generic [ref=e332]:
          - generic [ref=e333]:
            - heading "TELEMETRY STREAM AGENT-ALPHA Seeded demo data" [level=2] [ref=e334]:
              - img [ref=e335]
              - text: TELEMETRY STREAM AGENT-ALPHA
              - generic "This panel shows simulated content, not live oracle/chain data." [ref=e337]:
                - img [ref=e338]
                - text: Seeded demo data
            - generic [ref=e340]:
              - generic [ref=e341]: "[BCC-TX: 0x9fa1...] | Intent: SWAP 500 USDC | Policy: OPA_PASS | Gas: 12 gwei"
              - generic [ref=e342]: "[ZK-PROOF: UltraHonk] | Generated in 420ms | Verified by Base L2"
              - generic [ref=e343]: "[BCC-TX: 0x8b3c...] | Intent: TRANSFER 10 ITK | Policy: OPA_PASS | Gas: 14 gwei"
              - generic [ref=e344]: "[ENCLAVE_ATTEST] | PCR0: e3b0c442 | PCR1: 8d743a12 | Status: VALID"
              - generic [ref=e345]: "[BCC-TX: 0x7c22...] | Intent: DELEGATE STAKE | Policy: OPA_PASS | Gas: 11 gwei"
          - generic [ref=e346]:
            - heading "TELEMETRY STREAM AGENT-BETA Seeded demo data" [level=2] [ref=e347]:
              - img [ref=e348]
              - text: TELEMETRY STREAM AGENT-BETA
              - generic "This panel shows simulated content, not live oracle/chain data." [ref=e350]:
                - img [ref=e351]
                - text: Seeded demo data
            - generic [ref=e353]:
              - generic [ref=e354]: "[BCC-TX: 0x9fa1...] | Intent: SWAP 500 USDC | Policy: OPA_PASS | Gas: 12 gwei"
              - generic [ref=e355]: "[ZK-PROOF: UltraHonk] | Generated in 420ms | Verified by Base L2"
              - generic [ref=e356]: "[BCC-TX: 0x8b3c...] | Intent: TRANSFER 10 ITK | Policy: OPA_PASS | Gas: 14 gwei"
              - generic [ref=e357]: "[ENCLAVE_ATTEST] | PCR0: e3b0c442 | PCR1: 8d743a12 | Status: VALID"
              - generic [ref=e358]: "[BCC-TX: 0x7c22...] | Intent: DELEGATE STAKE | Policy: OPA_PASS | Gas: 11 gwei"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const ROUTES = [
  4  |     '/', '/landing', '/identity', '/contracts', '/cognition', '/settings',
  5  |     '/telemetry', '/exchange', '/chain-of-thought', '/compare-traces',
  6  |     '/finance', '/intelligence', '/shield', '/agents', '/documents', '/audit',
  7  | ];
  8  | 
  9  | test.describe('every route renders without a console/page error', () => {
  10 |     for (const route of ROUTES) {
  11 |         test(`GET ${route}`, async ({ page }) => {
  12 |             const errors: string[] = [];
  13 |             page.on('pageerror', (err) => errors.push(err.message));
  14 |             page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  15 | 
  16 |             await page.goto(route, { waitUntil: 'networkidle' });
> 17 |             expect(errors, `console/page errors on ${route}: ${errors.join('; ')}`).toEqual([]);
     |                                                                                     ^ Error: console/page errors on /intelligence: Failed to load resource: net::ERR_CONNECTION_REFUSED; Failed to load resource: net::ERR_CONNECTION_REFUSED
  18 |         });
  19 |     }
  20 | });
  21 | 
  22 | test('AgentsPage shows real oracle data, not the old hardcoded fixture', async ({ page }) => {
  23 |     const responses: string[] = [];
  24 |     page.on('response', async (res) => {
  25 |         if (res.url().includes('/v1/agents')) responses.push(await res.text());
  26 |     });
  27 | 
  28 |     await page.goto('/agents', { waitUntil: 'networkidle' });
  29 | 
  30 |     // The page must have actually called the real oracle endpoint — this
  31 |     // is the check that catches "builds fine but never fetches" regressions
  32 |     // that a pure DOM assertion alone would miss.
  33 |     expect(responses.length).toBeGreaterThan(0);
  34 | 
  35 |     const bodyText = await page.locator('body').innerText();
  36 |     // Old hardcoded fixture DIDs this page must never show again.
  37 |     expect(bodyText).not.toContain('did:intg:0x7a2...f89c');
  38 | });
  39 | 
  40 | test('wallet connect button is present in the shell', async ({ page }) => {
  41 |     await page.goto('/agents', { waitUntil: 'networkidle' });
  42 |     await expect(page.getByRole('button', { name: /connect wallet|no wallet found/i })).toBeVisible();
  43 | });
  44 | 
```