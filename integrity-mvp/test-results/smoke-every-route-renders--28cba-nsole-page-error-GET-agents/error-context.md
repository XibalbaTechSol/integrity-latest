# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> every route renders without a console/page error >> GET /agents
- Location: e2e/smoke.spec.ts:11:9

# Error details

```
Error: console/page errors on /agents: Failed to load resource: net::ERR_CONNECTION_REFUSED; Failed to load resource: net::ERR_CONNECTION_REFUSED

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
      - generic:
        - heading "Agent Fleet Management" [level=1]
      - generic [ref=e149]:
        - generic [ref=e151] [cursor=pointer]:
          - generic [ref=e152]:
            - generic [ref=e153]: Active Agent
            - generic [ref=e154]: Select Agent
          - img [ref=e155]
        - generic [ref=e157]:
          - generic [ref=e158]:
            - img [ref=e159]
            - generic [ref=e161]:
              - strong [ref=e162]: "Sync Failed:"
              - text: Failed to fetch
          - button "Claim Agent" [ref=e163] [cursor=pointer]:
            - img [ref=e164]
            - text: Claim Agent
          - button "Register Agent" [ref=e167] [cursor=pointer]:
            - img [ref=e168]
            - text: Register Agent
        - generic [ref=e173]:
          - img [ref=e174]
          - textbox "Search" [ref=e177]
        - generic [ref=e179] [cursor=pointer]:
          - img [ref=e180]
          - generic [ref=e183]: "2"
        - button "Connect Wallet" [ref=e184] [cursor=pointer]:
          - img [ref=e185]
          - text: Connect Wallet
    - generic [ref=e188]:
      - generic [ref=e189]:
        - generic [ref=e190]:
          - generic [ref=e192]:
            - heading "Registered Agents" [level=3] [ref=e193]
            - img [ref=e194]
          - generic [ref=e198]: "0"
          - generic [ref=e199]:
            - text: Live from
            - code [ref=e200]: GET /v1/agents
        - generic [ref=e201]:
          - generic [ref=e203]:
            - heading "Verified Agents" [level=3] [ref=e204]
            - img [ref=e205]
          - generic [ref=e207]:
            - text: "0"
            - generic [ref=e208]: / 0
          - generic [ref=e209]: Tier ≥ 1 (Sovereign+)
        - generic [ref=e210]:
          - generic [ref=e212]:
            - heading "Avg Network AIS" [level=3] [ref=e213]
            - img [ref=e214]
          - generic [ref=e217]: —
          - generic [ref=e218]: Across scored agents
      - generic [ref=e220]:
        - generic [ref=e221]:
          - generic [ref=e222]:
            - heading "Deployed Agents Database" [level=2] [ref=e223]
            - generic [ref=e224]:
              - button "Table" [ref=e225] [cursor=pointer]:
                - img [ref=e226]
                - text: Table
              - button "Gallery" [ref=e228] [cursor=pointer]:
                - img [ref=e229]
                - text: Gallery
          - generic [ref=e235]:
            - img [ref=e236]
            - textbox "Filter..." [ref=e239]
        - table [ref=e241]:
          - rowgroup [ref=e242]:
            - row "Identifier (DID) Verification Tier AIS Score Registered" [ref=e243]:
              - columnheader "Identifier (DID)" [ref=e244] [cursor=pointer]:
                - generic [ref=e245]:
                  - text: Identifier (DID)
                  - img [ref=e246]
              - columnheader "Verification Tier" [ref=e250] [cursor=pointer]:
                - generic [ref=e251]:
                  - text: Verification Tier
                  - img [ref=e252]
              - columnheader "AIS Score" [ref=e256] [cursor=pointer]:
                - generic [ref=e257]:
                  - text: AIS Score
                  - img [ref=e258]
              - columnheader "Registered" [ref=e262] [cursor=pointer]:
                - generic [ref=e263]:
                  - text: Registered
                  - img [ref=e264]
          - rowgroup
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
     |                                                                                     ^ Error: console/page errors on /agents: Failed to load resource: net::ERR_CONNECTION_REFUSED; Failed to load resource: net::ERR_CONNECTION_REFUSED
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