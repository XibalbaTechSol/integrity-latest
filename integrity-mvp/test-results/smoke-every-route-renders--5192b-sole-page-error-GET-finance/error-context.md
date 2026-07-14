# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> every route renders without a console/page error >> GET /finance
- Location: e2e/smoke.spec.ts:11:9

# Error details

```
Error: console/page errors on /finance: Failed to load resource: net::ERR_CONNECTION_REFUSED

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
      - heading "Shared Agent Crypto Wallet" [level=1] [ref=e150]
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
      - generic [ref=e175] [cursor=pointer]: Wallet & Portfolio
      - generic [ref=e176] [cursor=pointer]: A2A Markets & Escrow
      - generic [ref=e177] [cursor=pointer]: Stability & Certification
    - generic [ref=e179]:
      - generic [ref=e180]:
        - generic [ref=e182]:
          - text: Base L2 Network
          - generic [ref=e185]: 0x7F...3B92
        - generic [ref=e186]: TOTAL PORTFOLIO VALUE
        - generic [ref=e187]:
          - generic [ref=e188]: $
          - text: 38,583.09
        - generic [ref=e189]:
          - text: + $1,240.50 (4.2%)
          - generic [ref=e190]: Today
        - application [ref=e194]
        - generic [ref=e203]:
          - generic [ref=e204] [cursor=pointer]:
            - img [ref=e206]
            - generic [ref=e208]: Receive
          - generic [ref=e209] [cursor=pointer]:
            - img [ref=e211]
            - generic [ref=e214]: Send
          - generic [ref=e215] [cursor=pointer]:
            - img [ref=e217]
            - generic [ref=e222]: Swap
          - generic [ref=e223] [cursor=pointer]:
            - img [ref=e225]
            - generic [ref=e226]: Buy
      - generic [ref=e227]:
        - generic [ref=e228]:
          - generic [ref=e229]:
            - heading "Tokens & Assets" [level=2] [ref=e230]:
              - img [ref=e231]
              - text: Tokens & Assets
            - generic [ref=e234]:
              - generic [ref=e235] [cursor=pointer]:
                - generic [ref=e236]:
                  - generic [ref=e237]: ETH
                  - generic [ref=e238]:
                    - generic [ref=e239]: Ethereum
                    - generic [ref=e240]: 4.205 ETH
                - generic [ref=e241]:
                  - generic [ref=e242]: $14,508.09
                  - generic [ref=e243]: +2.4%
              - generic [ref=e244] [cursor=pointer]:
                - generic [ref=e245]:
                  - generic [ref=e246]: ITK
                  - generic [ref=e247]:
                    - generic [ref=e248]: Integrity
                    - generic [ref=e249]: 12500 ITK
                - generic [ref=e250]:
                  - generic [ref=e251]: $15,625.00
                  - generic [ref=e252]: +12.5%
              - generic [ref=e253] [cursor=pointer]:
                - generic [ref=e254]:
                  - generic [ref=e255]: USD
                  - generic [ref=e256]:
                    - generic [ref=e257]: USD Coin
                    - generic [ref=e258]: 8450.00 USDC
                - generic [ref=e259]:
                  - generic [ref=e260]: $8,450.00
                  - generic [ref=e261]: +0.01%
          - generic [ref=e262]:
            - heading "Recent Activity" [level=2] [ref=e263]:
              - img [ref=e264]
              - text: Recent Activity
            - generic [ref=e268]:
              - generic [ref=e269]:
                - generic [ref=e270]:
                  - img [ref=e272]
                  - generic [ref=e274]:
                    - generic [ref=e275]: Send ITK
                    - generic [ref=e276]:
                      - img [ref=e277]
                      - text: mock-agent-alpha • 2m ago
                - generic [ref=e280]:
                  - generic [ref=e281]: "-500"
                  - generic [ref=e282]: "-$625.00"
              - generic [ref=e283]:
                - generic [ref=e284]:
                  - img [ref=e286]
                  - generic [ref=e288]:
                    - generic [ref=e289]: Receive ETH
                    - generic [ref=e290]:
                      - img [ref=e291]
                      - text: Human (You) • 1h ago
                - generic [ref=e294]:
                  - generic [ref=e295]: "+1.5"
                  - generic [ref=e296]: +$5,175.30
              - generic [ref=e297]:
                - generic [ref=e298]:
                  - img [ref=e300]
                  - generic [ref=e305]:
                    - generic [ref=e306]: Swap USDC → ITK
                    - generic [ref=e307]:
                      - img [ref=e308]
                      - text: mock-agent-beta • 5h ago
                - generic [ref=e312]: 1000 USDC
              - generic [ref=e313]:
                - generic [ref=e314]:
                  - img [ref=e316]
                  - generic [ref=e318]:
                    - generic [ref=e319]: Contract Deploy ETH
                    - generic [ref=e320]:
                      - img [ref=e321]
                      - text: mock-agent-alpha • 1d ago
                - generic [ref=e324]:
                  - generic [ref=e325]: "-0.02"
                  - generic [ref=e326]: "-$69.00"
              - generic [ref=e327]:
                - generic [ref=e328]:
                  - img [ref=e330]
                  - generic [ref=e332]:
                    - generic [ref=e333]:
                      - text: Send ITK
                      - img [ref=e334]
                    - generic [ref=e336]:
                      - img [ref=e337]
                      - text: mock-agent-gamma • 2d ago
                - generic [ref=e340]:
                  - generic [ref=e341]: "-10000"
                  - generic [ref=e342]: Blocked (Limit)
            - button "View Explorer" [ref=e343] [cursor=pointer]
        - generic [ref=e345]:
          - generic [ref=e346]:
            - heading "Agent Allowances" [level=2] [ref=e347]:
              - img [ref=e348]
              - text: Agent Allowances
            - generic "This panel shows simulated content, not live oracle/chain data." [ref=e350]:
              - img [ref=e351]
              - text: Seeded demo data
          - paragraph [ref=e353]: Manage spend limits for autonomous agents operating from this shared treasury.
          - generic [ref=e354]:
            - generic [ref=e355]:
              - generic [ref=e356]:
                - generic [ref=e357]:
                  - img [ref=e358]
                  - text: mock-agent-alpha
                - img [ref=e361] [cursor=pointer]
              - generic [ref=e365]:
                - generic [ref=e366]: "Limit: 1000 ITK / week"
                - generic [ref=e367]: 500 spent
            - generic [ref=e370]:
              - generic [ref=e371]:
                - generic [ref=e372]:
                  - img [ref=e373]
                  - text: mock-agent-beta
                - img [ref=e376] [cursor=pointer]
              - generic [ref=e380]:
                - generic [ref=e381]: "Limit: 0.5 ETH / month"
                - generic [ref=e382]: 0.1 spent
            - generic [ref=e385]:
              - generic [ref=e386]:
                - generic [ref=e387]:
                  - img [ref=e388]
                  - text: mock-agent-gamma
                - img [ref=e391] [cursor=pointer]
              - generic [ref=e395]:
                - generic [ref=e396]: "Limit: 500 USDC / day"
                - generic [ref=e397]: 500 spent
              - generic [ref=e400]:
                - img [ref=e401]
                - text: Limit Reached. Transactions Blocked.
          - button "New Allowance Rule" [ref=e405] [cursor=pointer]:
            - img [ref=e406]
            - text: New Allowance Rule
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
     |                                                                                     ^ Error: console/page errors on /finance: Failed to load resource: net::ERR_CONNECTION_REFUSED
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