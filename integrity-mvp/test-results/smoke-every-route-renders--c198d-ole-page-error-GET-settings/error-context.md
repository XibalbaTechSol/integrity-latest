# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> every route renders without a console/page error >> GET /settings
- Location: e2e/smoke.spec.ts:11:9

# Error details

```
Error: console/page errors on /settings: Failed to load resource: net::ERR_CONNECTION_REFUSED

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
      - heading "System Configuration" [level=1] [ref=e150]
      - generic [ref=e151]:
        - generic [ref=e153] [cursor=pointer]:
          - generic [ref=e154]:
            - generic [ref=e155]: Active Agent
            - generic [ref=e156]: Select Agent
          - img [ref=e157]
        - button "Save Changes" [ref=e160] [cursor=pointer]
        - generic [ref=e161]:
          - img [ref=e162]
          - textbox "Search" [ref=e165]
        - generic [ref=e167] [cursor=pointer]:
          - img [ref=e168]
          - generic [ref=e171]: "2"
        - button "Connect Wallet" [ref=e172] [cursor=pointer]:
          - img [ref=e173]
          - text: Connect Wallet
    - generic [ref=e177]:
      - generic [ref=e178]:
        - generic [ref=e179]:
          - heading "Appearance & Theming" [level=3] [ref=e180]
          - img [ref=e181]
        - generic [ref=e187]:
          - generic [ref=e188] [cursor=pointer]:
            - generic [ref=e189]: Default Dark
            - generic [ref=e191]: Inter typography, deep dark panels, high contrast accents.
          - generic [ref=e192] [cursor=pointer]:
            - generic [ref=e193]: Navy & Gold
            - generic [ref=e195]: Elegant navy backgrounds with gold accents and Outfit typography.
          - generic [ref=e196] [cursor=pointer]:
            - generic [ref=e197]: Clinical Light
            - generic [ref=e199]: High legibility light theme with Roboto typography for clinical environments.
      - generic [ref=e200]:
        - heading "Typography" [level=3] [ref=e202]
        - generic [ref=e203]:
          - generic [ref=e204] [cursor=pointer]:
            - generic [ref=e205]: Inter (Default)
            - generic [ref=e206]: Clean, modern sans-serif optimized for legibility.
          - generic [ref=e207] [cursor=pointer]:
            - generic [ref=e208]: Raleway
            - generic [ref=e209]: Elegant, geometric sans-serif with distinct character.
          - generic [ref=e210] [cursor=pointer]:
            - generic [ref=e211]: Montserrat
            - generic [ref=e212]: Geometric sans-serif inspired by urban typography.
      - generic [ref=e213]:
        - generic [ref=e214]:
          - heading "Developer" [level=3] [ref=e215]
          - img [ref=e216]
        - generic [ref=e218]:
          - generic [ref=e219]:
            - generic [ref=e220]: Mock Mode
            - generic [ref=e221]:
              - text: Whether this build is pointed at a chain+oracle seeded with real test agents/markets for UI testing. Set via
              - code [ref=e222]: VITE_MOCK_MODE
              - text: in
              - code [ref=e223]: .env
              - text: (build-time — this can't be a live toggle, since seeding requires the protocol funder's private key, which must never reach the browser).
          - generic [ref=e224]: "ON"
        - generic [ref=e225]:
          - generic [ref=e226]: Seed real test data (run outside the browser)
          - generic [ref=e227]:
            - code [ref=e228]: cd integrity-sdk && MOCK=true FUNDER_PRIVATE_KEY=... INTEGRITY_WALLET_PASSWORD=... uv run python ../integrity-mvp/scripts/seed_mock_data.py
            - button [ref=e229] [cursor=pointer]:
              - img [ref=e230]
      - generic [ref=e233]:
        - generic [ref=e234]:
          - heading "Privacy Modes Not wired to a real setting" [level=3] [ref=e235]:
            - text: Privacy Modes
            - generic "This panel shows simulated content, not live oracle/chain data." [ref=e236]:
              - img [ref=e237]
              - text: Not wired to a real setting
          - img [ref=e239]
        - generic [ref=e242]:
          - generic [ref=e243]:
            - generic [ref=e244]:
              - generic [ref=e245]:
                - img [ref=e246]
                - text: Public Transparent
              - generic [ref=e249]: All agent reasoning traces and network calls are published to IPFS.
            - checkbox [ref=e251] [cursor=pointer]
          - generic [ref=e252]:
            - generic [ref=e253]:
              - generic [ref=e254]:
                - img [ref=e255]
                - text: HIPAA Compliant Enclave
              - generic [ref=e257]: Data egress is strictly gated. Internal memory is wiped after execution.
            - checkbox [checked] [ref=e259] [cursor=pointer]
          - generic [ref=e260]:
            - generic [ref=e261]:
              - generic [ref=e262]:
                - img [ref=e263]
                - text: Local Knowledge Isolation
              - generic [ref=e267]: Vectors and embeddings are stored purely locally. No cloud sync.
            - checkbox [ref=e269] [cursor=pointer]
      - generic [ref=e270]:
        - generic [ref=e271]:
          - heading "Developer API Keys" [level=3] [ref=e272]
          - img [ref=e273]
        - generic [ref=e277]:
          - paragraph [ref=e278]: Authenticate with the User API to manage your developer keys and agent resources.
          - textbox "Email" [ref=e279]
          - textbox "Password" [ref=e280]
          - generic [ref=e281]:
            - button "Log In" [ref=e282] [cursor=pointer]
            - button "Need to Register?" [ref=e283] [cursor=pointer]
      - generic [ref=e284]:
        - 'heading "Network & RPC Configuration Actual config: VITE_ORACLE_URL / VITE_CHAIN_ID in .env" [level=3] [ref=e286]':
          - text: Network & RPC Configuration
          - generic "This panel shows simulated content, not live oracle/chain data." [ref=e287]:
            - img [ref=e288]
            - text: "Actual config: VITE_ORACLE_URL / VITE_CHAIN_ID in .env"
        - generic [ref=e290]:
          - generic [ref=e291]:
            - generic [ref=e292]: Base L2 RPC URL
            - textbox [ref=e293]: https://mainnet.base.org
          - generic [ref=e294]:
            - generic [ref=e295]: Xibalba Oracle WSS Endpoint
            - textbox [ref=e296]: wss://oracle.xibalba.com/v1/stream
        - button "Save Network Settings" [ref=e298] [cursor=pointer]
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
     |                                                                                     ^ Error: console/page errors on /settings: Failed to load resource: net::ERR_CONNECTION_REFUSED
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