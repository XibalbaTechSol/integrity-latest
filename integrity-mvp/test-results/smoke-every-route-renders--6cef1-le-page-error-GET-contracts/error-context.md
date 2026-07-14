# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> every route renders without a console/page error >> GET /contracts
- Location: e2e/smoke.spec.ts:11:9

# Error details

```
Error: console/page errors on /contracts: Failed to load resource: net::ERR_CONNECTION_REFUSED; Failed to load resource: net::ERR_CONNECTION_REFUSED

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
        - heading "Smart Contracts & Architecture" [level=1] [ref=e150]
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
        - generic [ref=e175]:
          - generic [ref=e176]:
            - img [ref=e177]
            - generic [ref=e180]: Integrity IDE Workstation
          - generic [ref=e181]:
            - button "Save" [ref=e182] [cursor=pointer]:
              - img [ref=e183]
              - text: Save
            - button "Build" [ref=e187] [cursor=pointer]:
              - img [ref=e188]
              - text: Build
            - button "Deploy" [ref=e191] [cursor=pointer]:
              - img [ref=e192]
              - text: Deploy
        - generic [ref=e195]:
          - generic [ref=e196]:
            - generic [ref=e197]:
              - img [ref=e198]
              - text: Workspace
            - generic [ref=e200]:
              - generic [ref=e201] [cursor=pointer]:
                - generic [ref=e202]:
                  - img [ref=e203]
                  - img [ref=e205]
                  - text: src/contracts
                - img [ref=e207]
              - generic [ref=e208] [cursor=pointer]:
                - generic [ref=e209]:
                  - img [ref=e210]
                  - generic [ref=e213]: VerifierRegistry.sol
                - img [ref=e214]
              - generic [ref=e217] [cursor=pointer]:
                - generic [ref=e218]:
                  - img [ref=e219]
                  - generic [ref=e222]: Slasher.sol
                - img [ref=e223]
              - generic [ref=e226] [cursor=pointer]:
                - generic [ref=e227]:
                  - img [ref=e228]
                  - generic [ref=e231]: CCIPReputationBridge.sol
                - img [ref=e232]
              - generic [ref=e235] [cursor=pointer]:
                - generic [ref=e236]:
                  - img [ref=e237]
                  - generic [ref=e240]: IntegrityToken.sol
                - img [ref=e241]
              - generic [ref=e244] [cursor=pointer]:
                - generic [ref=e245]:
                  - img [ref=e246]
                  - generic [ref=e249]: UltraPlonkVerifier.sol
                - img [ref=e250]
              - generic [ref=e253] [cursor=pointer]:
                - generic [ref=e254]:
                  - img [ref=e255]
                  - generic [ref=e258]: IZkVerifier.sol
                - img [ref=e259]
              - generic [ref=e262] [cursor=pointer]:
                - generic [ref=e263]:
                  - img [ref=e264]
                  - generic [ref=e267]: StateAnchor.sol
                - img [ref=e268]
              - generic [ref=e271] [cursor=pointer]:
                - generic [ref=e272]:
                  - img [ref=e273]
                  - generic [ref=e276]: ReputationRegistry.sol
                - img [ref=e277]
              - generic [ref=e280] [cursor=pointer]:
                - generic [ref=e281]:
                  - img [ref=e282]
                  - generic [ref=e285]: IAccount.sol
                - img [ref=e286]
              - generic [ref=e289] [cursor=pointer]:
                - generic [ref=e290]:
                  - img [ref=e291]
                  - generic [ref=e294]: SovereignAgent.sol
                - img [ref=e295]
              - generic [ref=e298] [cursor=pointer]:
                - generic [ref=e299]:
                  - img [ref=e300]
                  - generic [ref=e303]: DomainRegistry.sol
                - img [ref=e304]
              - generic [ref=e307] [cursor=pointer]:
                - generic [ref=e308]:
                  - img [ref=e309]
                  - generic [ref=e312]: AgentPrimitivesFactory.sol
                - img [ref=e313]
              - generic [ref=e316] [cursor=pointer]:
                - generic [ref=e317]:
                  - img [ref=e318]
                  - generic [ref=e321]: XibalbaAgentRegistry.sol
                - img [ref=e322]
              - generic [ref=e325] [cursor=pointer]:
                - generic [ref=e326]:
                  - img [ref=e327]
                  - generic [ref=e330]: XibalbaNameService.sol
                - img [ref=e331]
              - generic [ref=e334] [cursor=pointer]:
                - generic [ref=e335]:
                  - img [ref=e336]
                  - generic [ref=e339]: AgentProfile.sol
                - img [ref=e340]
              - generic [ref=e343] [cursor=pointer]:
                - generic [ref=e344]:
                  - img [ref=e345]
                  - generic [ref=e348]: CoveredEntityRegistry.sol
                - img [ref=e349]
              - generic [ref=e352] [cursor=pointer]:
                - generic [ref=e353]:
                  - img [ref=e354]
                  - generic [ref=e357]: ComplianceGate.sol
                - img [ref=e358]
              - generic [ref=e361] [cursor=pointer]:
                - generic [ref=e362]:
                  - img [ref=e363]
                  - generic [ref=e366]: EHRGate.sol
                - img [ref=e367]
              - generic [ref=e370] [cursor=pointer]:
                - generic [ref=e371]:
                  - img [ref=e372]
                  - generic [ref=e375]: HIPAAGuardrailRegistry.sol
                - img [ref=e376]
              - generic [ref=e379] [cursor=pointer]:
                - generic [ref=e380]:
                  - img [ref=e381]
                  - generic [ref=e384]: SmartBAAFactory.sol
                - img [ref=e385]
              - generic [ref=e388] [cursor=pointer]:
                - generic [ref=e389]:
                  - img [ref=e390]
                  - generic [ref=e393]: SmartBAA.sol
                - img [ref=e394]
              - generic [ref=e397] [cursor=pointer]:
                - generic [ref=e398]:
                  - img [ref=e399]
                  - generic [ref=e402]: IntegrityMarket.sol
                - img [ref=e403]
              - generic [ref=e406] [cursor=pointer]:
                - generic [ref=e407]:
                  - img [ref=e408]
                  - generic [ref=e411]: A2ACapitalPool.sol
                - img [ref=e412]
              - generic [ref=e415] [cursor=pointer]:
                - generic [ref=e416]:
                  - img [ref=e417]
                  - generic [ref=e420]: MarketFactory.sol
                - img [ref=e421]
              - generic [ref=e424] [cursor=pointer]:
                - img [ref=e425]
                - img [ref=e427]
                - text: connected_agents
          - generic [ref=e429]:
            - generic [ref=e431]:
              - img [ref=e432]
              - text: VerifierRegistry.sol
            - code [ref=e438]:
              - generic [ref=e439]:
                - textbox "Editor content"
                - textbox [ref=e440]
                - generic [ref=e442]:
                  - generic [ref=e445]: "1"
                  - generic [ref=e447]: "2"
                  - generic [ref=e449]: "3"
                  - generic [ref=e451]: "4"
                  - generic [ref=e453]: "5"
                  - generic [ref=e455]: "6"
                  - generic [ref=e457]: "7"
                  - generic [ref=e459]: "8"
                  - generic [ref=e461]: "9"
                  - generic [ref=e463]: "10"
                  - generic [ref=e465]: "11"
                  - generic [ref=e467]: "12"
                  - generic [ref=e469]: "13"
                  - generic [ref=e471]: "14"
                  - generic [ref=e473]: "15"
                  - generic [ref=e475]: "16"
                  - generic [ref=e476]:
                    - generic [ref=e477] [cursor=pointer]: 
                    - generic [ref=e478]: "17"
                  - generic [ref=e480]: "18"
                  - generic [ref=e482]: "19"
                - generic [ref=e506]:
                  - generic [ref=e508]: "// SPDX-License-Identifier: MIT"
                  - generic [ref=e510]: pragma solidity ^0.8.28;
                  - generic [ref=e513]: "import {Initializable} from \"@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol\";"
                  - generic [ref=e515]: "import {AccessControlUpgradeable} from \"@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol\";"
                  - generic [ref=e517]: "import {IZkVerifier} from \"./IZkVerifier.sol\";"
                  - generic [ref=e520]: /// @title VerifierRegistry
                  - generic [ref=e522]: /// @notice Per-agent EIP-1167 clone holding a versioned, agent-controlled pointer to
                  - generic [ref=e524]: "/// whichever global `IZkVerifier` implementation (UltraPlonkVerifier, or a future"
                  - generic [ref=e526]: /// circuit version) this agent currently trusts.
                  - generic [ref=e528]: /// @dev Exists so a single global circuit upgrade doesn't force every agent onto the new
                  - generic [ref=e530]: /// version simultaneously — an agent can pin an older, still-verifying version while it
                  - generic [ref=e532]: /// validates the new one, implementing the "Versioned Circuit Registry" ingestion
                  - generic [ref=e534]: "/// hardening item (docs/INTERFACE_CONTRACT.md). `verify` forwards to whichever impl is"
                  - generic [ref=e536]: /// current; this contract does no verification logic of its own.
                  - generic [ref=e538]: "contract VerifierRegistry is Initializable, AccessControlUpgradeable, IZkVerifier {"
                  - generic [ref=e540]: mapping(uint256 => address) public verifierImpl;
                  - generic [ref=e542]: uint256 public currentVersion;
          - generic [ref=e548]:
            - generic [ref=e550]:
              - img [ref=e551]
              - text: Inspector
            - generic [ref=e555]: Select an agent from the workspace to inspect its on-chain primitives and telemetry profile.
        - generic [ref=e556]:
          - generic [ref=e557]:
            - img [ref=e558]
            - text: System Console (tty1)
          - generic [ref=e560]:
            - generic [ref=e561]: "[system] Legacy IDE Interface loaded."
            - generic [ref=e562]: "[system] Connected to Xibalba Agent Registry."
            - generic [ref=e563]: "[1:27:12 AM] [error] Failed to fetch agents: Failed to fetch"
  - generic [ref=e564]:
    - alert
    - alert
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
     |                                                                                     ^ Error: console/page errors on /contracts: Failed to load resource: net::ERR_CONNECTION_REFUSED; Failed to load resource: net::ERR_CONNECTION_REFUSED
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