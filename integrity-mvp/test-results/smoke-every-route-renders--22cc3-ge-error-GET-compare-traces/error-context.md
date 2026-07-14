# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> every route renders without a console/page error >> GET /compare-traces
- Location: e2e/smoke.spec.ts:11:9

# Error details

```
Error: console/page errors on /compare-traces: Failed to load resource: net::ERR_CONNECTION_REFUSED

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
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
      - generic [ref=e149]:
        - heading "Compare Traces & Spans" [level=1] [ref=e150]
        - generic [ref=e151]:
          - generic [ref=e152] [cursor=pointer]: Gantt Timeline
          - generic [ref=e153] [cursor=pointer]: JSON Payload Diff
          - generic [ref=e154] [cursor=pointer]: Flame Graph
      - generic [ref=e155]:
        - generic [ref=e157] [cursor=pointer]:
          - generic [ref=e158]:
            - generic [ref=e159]: Active Agent
            - generic [ref=e160]: Select Agent
          - img [ref=e161]
        - generic "This panel shows simulated content, not live oracle/chain data." [ref=e164]:
          - img [ref=e165]
          - text: Seeded demo data
        - generic [ref=e167]:
          - img [ref=e168]
          - textbox "Search" [ref=e171]
        - generic [ref=e173] [cursor=pointer]:
          - img [ref=e174]
          - generic [ref=e177]: "2"
        - button "Connect Wallet" [ref=e178] [cursor=pointer]:
          - img [ref=e179]
          - text: Connect Wallet
    - generic [ref=e182]:
      - generic [ref=e184] [cursor=pointer]:
        - generic [ref=e185]:
          - generic [ref=e186]: Trace A
          - generic [ref=e187]:
            - text: Identity Resolution (Stable)
            - generic [ref=e188]: "[7c2a-9e8d]"
        - img [ref=e189]
      - generic [ref=e192] [cursor=pointer]:
        - generic [ref=e193]:
          - generic [ref=e194]: Trace B
          - generic [ref=e195]:
            - text: Identity Resolution (Timeout)
            - generic [ref=e196]: "[b3f1-4a7c]"
        - img [ref=e197]
    - generic [ref=e200]:
      - generic [ref=e201]:
        - generic [ref=e202]:
          - generic [ref=e203]:
            - img [ref=e204]
            - text: "Duration: 45.35ms"
          - generic [ref=e207]:
            - img [ref=e208]
            - text: "Errors: 0"
        - generic [ref=e211]:
          - generic [ref=e212]:
            - generic [ref=e214] [cursor=pointer]:
              - img [ref=e216]
              - text: Authentication Service
              - generic [ref=e218]: 45.35ms
            - generic [ref=e219]:
              - generic [ref=e222] [cursor=pointer]:
                - text: Token Validation
                - generic [ref=e223]: 40.10ms
              - generic [ref=e226] [cursor=pointer]:
                - text: User DB Lookup
                - generic [ref=e227]: 12.40ms
          - generic [ref=e230] [cursor=pointer]:
            - text: Policy Check (OPA)
            - generic [ref=e231]: 18.05ms
          - generic [ref=e234] [cursor=pointer]:
            - text: Response Serialization
            - generic [ref=e235]: 4.20ms
      - generic [ref=e236]:
        - generic [ref=e237]:
          - generic [ref=e238]:
            - img [ref=e239]
            - text: "Duration: 130.48ms"
          - generic [ref=e242]:
            - img [ref=e243]
            - text: "Errors: 1"
        - generic [ref=e246]:
          - generic [ref=e247]:
            - generic [ref=e249] [cursor=pointer]:
              - img [ref=e251]
              - text: Authentication Service
              - generic [ref=e253]: 130.48ms
            - generic [ref=e254]:
              - generic [ref=e257] [cursor=pointer]:
                - text: Token Validation
                - generic [ref=e258]: 122.10ms
              - generic [ref=e259]:
                - generic [ref=e261] [cursor=pointer]:
                  - img [ref=e263]
                  - img [ref=e265]
                  - text: User DB Lookup
                  - generic [ref=e267]: 85.40ms
                - generic [ref=e271] [cursor=pointer]:
                  - text: DB Timeout Retry 1
                  - generic [ref=e272]: 45.00ms
          - generic [ref=e275] [cursor=pointer]:
            - text: Policy Check (OPA)
            - generic [ref=e276]: 18.15ms
          - generic [ref=e279] [cursor=pointer]:
            - text: Response Serialization
            - generic [ref=e280]: 4.50ms
      - generic [ref=e281]:
        - heading "Deviations" [level=2] [ref=e282]:
          - img [ref=e283]
          - text: Deviations
        - generic [ref=e288]:
          - generic [ref=e289]:
            - heading "Critical Error" [level=4] [ref=e290]
            - paragraph [ref=e291]: Database Timeout observed in Trace B during User DB Lookup.
          - generic [ref=e292]:
            - heading "Latency Spike" [level=4] [ref=e293]
            - paragraph [ref=e294]: User DB Lookup is 73ms slower in Trace B (85.40ms vs 12.40ms).
          - generic [ref=e295]:
            - heading "Payload Drift" [level=4] [ref=e296]
            - paragraph [ref=e297]: Different IP Address and Enclave Type detected in inputs.
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
     |                                                                                     ^ Error: console/page errors on /compare-traces: Failed to load resource: net::ERR_CONNECTION_REFUSED
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