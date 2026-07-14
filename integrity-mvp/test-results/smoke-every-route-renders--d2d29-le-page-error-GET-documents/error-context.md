# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> every route renders without a console/page error >> GET /documents
- Location: e2e/smoke.spec.ts:11:9

# Error details

```
Error: console/page errors on /documents: Failed to load resource: net::ERR_CONNECTION_REFUSED

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
- generic [active] [ref=e1]:
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
        - heading "Encrypted Document Vault" [level=1] [ref=e150]
        - generic [ref=e151]:
          - generic [ref=e153] [cursor=pointer]:
            - generic [ref=e154]:
              - generic [ref=e155]: Active Agent
              - generic [ref=e156]: Select Agent
            - img [ref=e157]
          - button "Upload Document" [ref=e160] [cursor=pointer]:
            - img [ref=e161]
            - text: Upload Document
          - generic [ref=e164]:
            - img [ref=e165]
            - textbox "Search" [ref=e168]
          - generic [ref=e170] [cursor=pointer]:
            - img [ref=e171]
            - generic [ref=e174]: "2"
          - button "Connect Wallet" [ref=e175] [cursor=pointer]:
            - img [ref=e176]
            - text: Connect Wallet
      - generic [ref=e179]:
        - generic [ref=e180]:
          - generic [ref=e181]:
            - generic [ref=e182]:
              - heading "Vector DB Size" [level=3] [ref=e183]
              - img [ref=e184]
            - generic [ref=e188]: 142,850 Chunks
            - generic [ref=e189]: Synchronized with Arweave Permanent Storage
          - generic [ref=e190]:
            - generic [ref=e191]:
              - heading "Knowledge Graph Nodes" [level=3] [ref=e192]
              - img [ref=e193]
            - generic [ref=e198]: 84,210
            - generic [ref=e199]: Zero-Knowledge Proof Attested
          - generic [ref=e200]:
            - generic [ref=e201]:
              - heading "Sync Status" [level=3] [ref=e202]
              - img [ref=e203]
            - generic [ref=e208]: Healthy
            - generic [ref=e209]: "Last sync: 2 mins ago"
        - generic [ref=e210]:
          - generic [ref=e212]:
            - heading "Vector Ingestion Throughput" [level=3] [ref=e213]
            - paragraph [ref=e214]: Document chunks embedded and cryptographically signed over 7 days
          - application [ref=e218]:
            - generic [ref=e230]:
              - generic [ref=e231]:
                - generic [ref=e233]: Mon
                - generic [ref=e235]: Tue
                - generic [ref=e237]: Wed
                - generic [ref=e239]: Thu
                - generic [ref=e241]: Fri
                - generic [ref=e243]: Sat
                - generic [ref=e245]: Sun
              - generic [ref=e246]:
                - generic [ref=e248]: "0"
                - generic [ref=e250]: "1500"
                - generic [ref=e252]: "3000"
                - generic [ref=e254]: "4500"
                - generic [ref=e256]: "6000"
        - generic [ref=e258]:
          - generic [ref=e259]:
            - generic [ref=e260]:
              - heading "Recent Ingestions" [level=2] [ref=e261]
              - generic [ref=e262]:
                - button "Table" [ref=e263] [cursor=pointer]:
                  - img [ref=e264]
                  - text: Table
                - button "Gallery" [ref=e266] [cursor=pointer]:
                  - img [ref=e267]
                  - text: Gallery
            - generic [ref=e273]:
              - img [ref=e274]
              - textbox "Filter..." [ref=e277]
          - table [ref=e279]:
            - rowgroup [ref=e280]:
              - row "Filename IPFS CID Vector Chunks Status Time" [ref=e281]:
                - columnheader "Filename" [ref=e282] [cursor=pointer]:
                  - generic [ref=e283]:
                    - text: Filename
                    - img [ref=e284]
                - columnheader "IPFS CID" [ref=e288] [cursor=pointer]:
                  - generic [ref=e289]:
                    - text: IPFS CID
                    - img [ref=e290]
                - columnheader "Vector Chunks" [ref=e294] [cursor=pointer]:
                  - generic [ref=e295]:
                    - text: Vector Chunks
                    - img [ref=e296]
                - columnheader "Status" [ref=e300] [cursor=pointer]:
                  - generic [ref=e301]:
                    - text: Status
                    - img [ref=e302]
                - columnheader "Time" [ref=e306] [cursor=pointer]:
                  - generic [ref=e307]:
                    - text: Time
                    - img [ref=e308]
            - rowgroup [ref=e312]:
              - row "HIPAA_Compliance_Guidelines_2026.pdf QmYwAPJzv5CZsnA625s3Xf2b... 420 Indexed 2 hours ago" [ref=e313]:
                - cell "HIPAA_Compliance_Guidelines_2026.pdf" [ref=e314]:
                  - generic [ref=e315]:
                    - img [ref=e317]
                    - text: HIPAA_Compliance_Guidelines_2026.pdf
                - cell "QmYwAPJzv5CZsnA625s3Xf2b..." [ref=e320]
                - cell "420" [ref=e321]:
                  - generic [ref=e322]:
                    - img [ref=e323]
                    - text: "420"
                - cell "Indexed" [ref=e327]:
                  - generic [ref=e328]: Indexed
                - cell "2 hours ago" [ref=e329]
              - row "Patient_Onboarding_Protocol.docx QmZp1HhXw2Rvs9F82jN... 156 Indexed 5 hours ago" [ref=e330]:
                - cell "Patient_Onboarding_Protocol.docx" [ref=e331]:
                  - generic [ref=e332]:
                    - img [ref=e334]
                    - text: Patient_Onboarding_Protocol.docx
                - cell "QmZp1HhXw2Rvs9F82jN..." [ref=e337]
                - cell "156" [ref=e338]:
                  - generic [ref=e339]:
                    - img [ref=e340]
                    - text: "156"
                - cell "Indexed" [ref=e344]:
                  - generic [ref=e345]: Indexed
                - cell "5 hours ago" [ref=e346]
              - row "Clinical_Trial_Results_Q3.pdf QmT7Kk3wLp8Rt4G2N... - Indexing Just now" [ref=e347]:
                - cell "Clinical_Trial_Results_Q3.pdf" [ref=e348]:
                  - generic [ref=e349]:
                    - img [ref=e351]
                    - text: Clinical_Trial_Results_Q3.pdf
                - cell "QmT7Kk3wLp8Rt4G2N..." [ref=e354]
                - cell "-" [ref=e355]:
                  - generic [ref=e356]:
                    - img [ref=e357]
                    - text: "-"
                - cell "Indexing" [ref=e361]:
                  - generic [ref=e362]: Indexing
                - cell "Just now" [ref=e363]
              - row "SmartBAA_Terms_of_Service.txt QmXv5VbMw9Lp8Rt4G... 42 Indexed 1 day ago" [ref=e364]:
                - cell "SmartBAA_Terms_of_Service.txt" [ref=e365]:
                  - generic [ref=e366]:
                    - img [ref=e368]
                    - text: SmartBAA_Terms_of_Service.txt
                - cell "QmXv5VbMw9Lp8Rt4G..." [ref=e371]
                - cell "42" [ref=e372]:
                  - generic [ref=e373]:
                    - img [ref=e374]
                    - text: "42"
                - cell "Indexed" [ref=e378]:
                  - generic [ref=e379]: Indexed
                - cell "1 day ago" [ref=e380]
  - generic [ref=e381]: "0"
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
     |                                                                                     ^ Error: console/page errors on /documents: Failed to load resource: net::ERR_CONNECTION_REFUSED
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