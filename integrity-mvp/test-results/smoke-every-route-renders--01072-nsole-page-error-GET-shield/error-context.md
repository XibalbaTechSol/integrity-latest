# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> every route renders without a console/page error >> GET /shield
- Location: e2e/smoke.spec.ts:11:9

# Error details

```
Error: console/page errors on /shield: Failed to load resource: net::ERR_CONNECTION_REFUSED

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
      - heading "Xibalba Shield Command Center" [level=1] [ref=e150]
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
            - img [ref=e179]
            - heading "Xibalba Shield" [level=1] [ref=e182]
          - paragraph [ref=e183]: Decentralized HIPAA Compliance, Automated Smart BAAs & Patient-Controlled PHI Access Gating
        - generic [ref=e184]:
          - generic [ref=e185]:
            - generic [ref=e186]: "0"
            - generic [ref=e187]: Active BAAs (this agent)
          - generic "No TEE enclave attestation is built — see IdentityPage" [ref=e188]:
            - generic [ref=e189]: —
            - generic [ref=e190]: Enclave Integrity
      - generic [ref=e191]:
        - button "Stability Certification" [ref=e192] [cursor=pointer]:
          - img [ref=e193]
          - text: Stability Certification
        - button "Smart BAAs" [ref=e196] [cursor=pointer]:
          - img [ref=e197]
          - text: Smart BAAs
        - button "PHI Access Gates" [ref=e200] [cursor=pointer]:
          - img [ref=e201]
          - text: PHI Access Gates
        - button "Audit & Compliance" [ref=e204] [cursor=pointer]:
          - img [ref=e205]
          - text: Audit & Compliance
        - button "Quarantine Zone" [ref=e207] [cursor=pointer]:
          - img [ref=e208]
          - text: Quarantine Zone
      - generic [ref=e212]:
        - heading "Agent Stability Profile Seeded demo data" [level=2] [ref=e213]:
          - img [ref=e214]
          - text: Agent Stability Profile
          - generic "This panel shows simulated content, not live oracle/chain data." [ref=e217]:
            - img [ref=e218]
            - text: Seeded demo data
        - generic [ref=e220]:
          - generic [ref=e221]:
            - generic [ref=e222]: Current Stability Tier
            - generic [ref=e224]: AAA
            - generic [ref=e225]: Low Risk • Reduced Collateral Requirements
          - generic [ref=e226]:
            - generic [ref=e228]:
              - generic [ref=e229]: BAA Compliance Ratio
              - generic [ref=e230]: 99.9%
            - generic [ref=e234]:
              - generic [ref=e235]: Prediction Accuracy (Markets)
              - generic [ref=e236]: 82.4%
            - generic [ref=e240]:
              - generic [ref=e241]: Collateral Health Factor
              - generic [ref=e242]: 1.8x
            - paragraph [ref=e246]:
              - strong [ref=e247]: "Note:"
              - text: Agents maintaining AAA tier receive a 50% reduction in required ITK collateral for new Smart BAAs and Escrow pools. A single slashing event will downgrade the agent to B Tier.
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
     |                                                                                     ^ Error: console/page errors on /shield: Failed to load resource: net::ERR_CONNECTION_REFUSED
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