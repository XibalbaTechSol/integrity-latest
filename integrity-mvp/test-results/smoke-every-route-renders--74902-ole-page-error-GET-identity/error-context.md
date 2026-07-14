# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> every route renders without a console/page error >> GET /identity
- Location: e2e/smoke.spec.ts:11:9

# Error details

```
Error: console/page errors on /identity: Failed to load resource: net::ERR_CONNECTION_REFUSED

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
      - generic:
        - heading "Agent Identity & Enclave Attestation" [level=1]
      - generic [ref=e149]:
        - generic [ref=e151] [cursor=pointer]:
          - generic [ref=e152]:
            - generic [ref=e153]: Active Agent
            - generic [ref=e154]: Select Agent
          - img [ref=e155]
        - generic [ref=e157]:
          - button "Claim Agent" [ref=e158] [cursor=pointer]:
            - img [ref=e159]
            - text: Claim Agent
          - button "Rotate Keys" [ref=e161] [cursor=pointer]:
            - img [ref=e162]
            - text: Rotate Keys
          - button "Request Credential" [ref=e166] [cursor=pointer]:
            - img [ref=e167]
            - text: Request Credential
        - generic [ref=e171]:
          - img [ref=e172]
          - textbox "Search" [ref=e175]
        - generic [ref=e177] [cursor=pointer]:
          - img [ref=e178]
          - generic [ref=e181]: "2"
        - button "Connect Wallet" [ref=e182] [cursor=pointer]:
          - img [ref=e183]
          - text: Connect Wallet
    - generic [ref=e186]:
      - generic [ref=e187]:
        - generic [ref=e188]:
          - generic [ref=e189]:
            - img [ref=e191]
            - generic [ref=e200]:
              - heading "Sovereign Identity" [level=2] [ref=e201]
              - generic [ref=e202]: Decentralized Identifier (DID)
          - generic [ref=e203]: No agent selected
        - generic [ref=e204]:
          - generic [ref=e205]:
            - generic [ref=e206]: Verification Status
            - generic [ref=e207]: Unverified
          - button "Claim New Agent" [ref=e208] [cursor=pointer]
      - generic [ref=e209]:
        - generic [ref=e210]:
          - generic [ref=e211]:
            - heading "TEE Measurements" [level=3] [ref=e212]:
              - img [ref=e213]
              - text: TEE Measurements
            - generic "This panel shows simulated content, not live oracle/chain data." [ref=e215]:
              - img [ref=e216]
              - text: Tier 3 attestation not built
          - generic [ref=e218]:
            - generic [ref=e219]:
              - generic [ref=e220]: Execution Enclave
              - generic [ref=e221]: AWS Nitro Enclaves
            - generic [ref=e222]:
              - generic [ref=e223]: PCR0 (Image Hash)
              - generic [ref=e224]: e3b0c44298fc1c149afbf4c8996fb924...
            - generic [ref=e225]:
              - generic [ref=e226]: PCR1 (Kernel Hash)
              - generic [ref=e227]: 8d743a129d20c5411df83e5c92842b10...
          - button "Regenerate Attestation Document" [ref=e228] [cursor=pointer]
        - generic [ref=e229]:
          - heading "Economic Capacity" [level=3] [ref=e231]:
            - img [ref=e232]
            - text: Economic Capacity
          - generic [ref=e236]:
            - generic [ref=e237]:
              - generic [ref=e238]:
                - generic [ref=e239]: ITK Token Balance
                - generic [ref=e240]: —
              - img [ref=e242]
            - generic [ref=e246]:
              - generic [ref=e247]: Open Market Positions
              - generic [ref=e248]: —
          - generic [ref=e249]:
            - button "Stake ITK" [ref=e250] [cursor=pointer]
            - button "Withdraw" [ref=e251] [cursor=pointer]
      - generic [ref=e252]:
        - generic [ref=e253]:
          - generic [ref=e254]:
            - heading "XNS (Xibalba Name Service)" [level=3] [ref=e255]:
              - img [ref=e256]
              - text: XNS (Xibalba Name Service)
            - generic [ref=e259]: Global agent discovery and resolution protocol.
          - generic "This panel shows simulated content, not live oracle/chain data." [ref=e260]:
            - img [ref=e261]
            - text: On-chain read not wired
        - generic [ref=e263]:
          - generic [ref=e264]:
            - generic [ref=e265]: Your Registered Handle
            - generic [ref=e266]: alpha.agent.xibalba
            - generic [ref=e267]:
              - img [ref=e268]
              - text: Resolving to Active DID
          - generic [ref=e271]:
            - button "→ Launch XNS Explorer Search the global registry for other agents" [ref=e272] [cursor=pointer]:
              - generic [ref=e273]:
                - img [ref=e274]
                - generic [ref=e277]: →
              - generic [ref=e278]:
                - heading "Launch XNS Explorer" [level=4] [ref=e279]
                - generic [ref=e280]: Search the global registry for other agents
            - button "Register Additional Handle" [ref=e281] [cursor=pointer]
      - generic [ref=e282]:
        - heading "Verifiable Credentials Wallet No credentials system built" [level=3] [ref=e283]:
          - img [ref=e284]
          - text: Verifiable Credentials Wallet
          - generic "This panel shows simulated content, not live oracle/chain data." [ref=e288]:
            - img [ref=e289]
            - text: No credentials system built
        - generic [ref=e292]:
          - generic [ref=e293]:
            - generic [ref=e294]:
              - heading "Credentials" [level=2] [ref=e295]
              - generic [ref=e296]:
                - button "Table" [ref=e297] [cursor=pointer]:
                  - img [ref=e298]
                  - text: Table
                - button "Gallery" [ref=e300] [cursor=pointer]:
                  - img [ref=e301]
                  - text: Gallery
            - generic [ref=e307]:
              - img [ref=e308]
              - textbox "Filter..." [ref=e311]
          - table [ref=e313]:
            - rowgroup [ref=e314]:
              - row "Credential Type Issuer Status Valid Until" [ref=e315]:
                - columnheader "Credential Type" [ref=e316] [cursor=pointer]:
                  - generic [ref=e317]:
                    - text: Credential Type
                    - img [ref=e318]
                - columnheader "Issuer" [ref=e322] [cursor=pointer]:
                  - generic [ref=e323]:
                    - text: Issuer
                    - img [ref=e324]
                - columnheader "Status" [ref=e328] [cursor=pointer]:
                  - generic [ref=e329]:
                    - text: Status
                    - img [ref=e330]
                - columnheader "Valid Until" [ref=e334] [cursor=pointer]:
                  - generic [ref=e335]:
                    - text: Valid Until
                    - img [ref=e336]
            - rowgroup [ref=e340]:
              - row "HIPAA Compliance Badge Xibalba Trust Registry Valid 2028-01-01" [ref=e341]:
                - cell "HIPAA Compliance Badge" [ref=e342]:
                  - generic [ref=e343]:
                    - img [ref=e344]
                    - text: HIPAA Compliance Badge
                - cell "Xibalba Trust Registry" [ref=e347]
                - cell "Valid" [ref=e348]:
                  - generic [ref=e349]: Valid
                - cell "2028-01-01" [ref=e350]
              - row "KYC Provider Clearance Chainalysis Oracles Valid 2027-05-15" [ref=e351]:
                - cell "KYC Provider Clearance" [ref=e352]:
                  - generic [ref=e353]:
                    - img [ref=e354]
                    - text: KYC Provider Clearance
                - cell "Chainalysis Oracles" [ref=e358]
                - cell "Valid" [ref=e359]:
                  - generic [ref=e360]: Valid
                - cell "2027-05-15" [ref=e361]
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
     |                                                                                     ^ Error: console/page errors on /identity: Failed to load resource: net::ERR_CONNECTION_REFUSED
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