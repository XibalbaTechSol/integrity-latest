# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> every route renders without a console/page error >> GET /landing
- Location: e2e/smoke.spec.ts:11:9

# Error details

```
Error: console/page errors on /landing: Failed to load resource: net::ERR_CONNECTION_REFUSED

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
- generic [ref=e4]:
  - banner [ref=e5]:
    - generic [ref=e6]:
      - img "Xibalba" [ref=e8]
      - generic [ref=e9]:
        - button "Sign In" [ref=e10] [cursor=pointer]
        - button "Launch Dashboard" [ref=e11] [cursor=pointer]
  - generic [ref=e14]:
    - img "Xibalba Logo" [ref=e15]
    - generic [ref=e16]: The Engine of Trust for the Agentic Economy
    - heading "Keep your autonomous agents honest, reliable, and accountable." [level=1] [ref=e17]:
      - text: Keep your autonomous agents
      - text: honest, reliable, and accountable.
    - paragraph [ref=e18]:
      - text: The Integrity Protocol gives developers a rock-solid foundation for building
      - strong [ref=e19]: AI agents they can actually trust
      - text: .
    - paragraph [ref=e20]: We continuously monitor your agents in real-time, giving them a reliability score based on how strictly they follow your rules. We cryptographically prove they did the right thing without exposing your data, anchoring every action to the blockchain for an unchangeable public record of truth.
    - generic [ref=e22]:
      - button "Launch Dashboard" [ref=e23] [cursor=pointer]
      - button "Developer Integration" [ref=e24] [cursor=pointer]:
        - img [ref=e25]
        - text: Developer Integration
  - generic [ref=e28]:
    - generic [ref=e29]:
      - generic [ref=e30]:
        - generic [ref=e31]:
          - generic [ref=e32]: The Problem
          - heading "Why AI Agents Can't Participate in the Economy — Yet" [level=2] [ref=e33]
        - generic [ref=e34]:
          - heading "Agent XNS Lookup" [level=3] [ref=e35]
          - generic [ref=e36]:
            - textbox "agent.xns" [ref=e37]
            - button "Lookup" [ref=e38] [cursor=pointer]
      - paragraph [ref=e40]:
        - text: Agents can reason, plan, and execute — but they can't
        - strong [ref=e41]: transact
        - text: . They can't sign contracts, prove they did what they committed to, or be held accountable when they drift. Without cryptographic execution guarantees and on-chain verification, no counterparty — human or machine — will trust an agent with real economic value.
    - generic [ref=e42]:
      - generic [ref=e43]: Our Solution
      - heading "The Trust Layer" [level=2] [ref=e44]
      - generic [ref=e45]:
        - generic [ref=e46]:
          - heading "Integrity Protocol" [level=3] [ref=e47]
          - paragraph [ref=e48]: Open Source Engine
          - paragraph [ref=e49]: A trustless, machine-verifiable protocol for autonomous agent transactions. Pre-execution intent gating, cryptographic commitment chains, ZK-proof verification, and on-chain settlement on Base L2 — enabling any AI agent to transact with mathematical certainty.
        - generic [ref=e50]:
          - heading "Xibalba Shield" [level=3] [ref=e51]
          - paragraph [ref=e52]: Agent Economy Control Plane
          - paragraph [ref=e53]: The SaaS layer for the agent economy. Centralized policy management, on-chain settlement orchestration, agent reputation dashboards, and compliance automation across verticals — starting with healthcare (HIPAA) and DeFi.
    - generic [ref=e54]:
      - generic [ref=e55]: Cornerstone Feature
      - heading "Closed-Loop Tri-Metric Risk Assessment" [level=2] [ref=e56]
      - paragraph [ref=e57]: Our architecture evaluates trust via three immutable mathematical pillars, establishing a continuous closed-loop feedback cycle between execution and observation.
      - generic [ref=e58]:
        - generic [ref=e59]:
          - generic [ref=e60]:
            - img [ref=e61]
            - heading "Agent Integrity Deficit" [level=3] [ref=e64]
          - generic [ref=e68]:
            - math [ref=e70]:
              - generic [ref=e72]:
                - generic [ref=e74]: \D
                - generic [ref=e75]: e
                - generic [ref=e76]: l
                - generic [ref=e77]: t
                - generic [ref=e78]:
                  - generic [ref=e79]: a
                  - generic [ref=e80]:
                    - generic [ref=e82]: \t
                    - generic [ref=e83]: e
                    - generic [ref=e84]: x
                    - generic [ref=e85]: t
                    - generic [ref=e86]:
                      - generic [ref=e87]: A
                      - generic [ref=e88]: I
                      - generic [ref=e89]: S
                - generic [ref=e90]: =
                - generic [ref=e91]: "1"
                - generic [ref=e92]: −
                - generic [ref=e94]: \l
                - generic [ref=e95]: e
                - generic [ref=e96]: f
                - generic [ref=e97]: t
                - generic [ref=e98]: (
                - generic [ref=e100]: \s
                - generic [ref=e101]: u
                - generic [ref=e102]:
                  - generic [ref=e103]: m
                  - generic [ref=e104]:
                    - generic [ref=e105]: i
                    - generic [ref=e106]: =
                    - generic [ref=e107]: "1"
                  - generic [ref=e108]: "4"
                - generic [ref=e109]:
                  - generic [ref=e110]: w
                  - generic [ref=e111]: i
                - generic [ref=e112]:
                  - generic [ref=e113]: S
                  - generic [ref=e114]: i
                - generic [ref=e115]:
                  - generic [ref=e116]: i
                  - generic [ref=e117]: ˚
                - generic [ref=e118]: g
                - generic [ref=e119]: h
                - generic [ref=e120]: t
                - generic [ref=e121]: )
                - generic [ref=e123]: \t
                - generic [ref=e124]: i
                - generic [ref=e125]: m
                - generic [ref=e126]: e
                - generic [ref=e127]: s
                - generic [ref=e129]: \t
                - generic [ref=e130]: e
                - generic [ref=e131]: x
                - generic [ref=e132]: t
                - generic [ref=e133]:
                  - generic [ref=e134]:
                    - generic [ref=e135]: Z
                    - generic [ref=e136]: K
                  - generic [ref=e137]:
                    - generic [ref=e139]: \t
                    - generic [ref=e140]: e
                    - generic [ref=e141]: x
                    - generic [ref=e142]: t
                    - generic [ref=e143]:
                      - generic [ref=e144]: b
                      - generic [ref=e145]: o
                      - generic [ref=e146]: o
                      - generic [ref=e147]: s
                      - generic [ref=e148]: t
            - generic [ref=e149]:
              - generic [ref=e150]:
                - generic [ref=e151]: \D
                - text: elt
                - generic [ref=e152]:
                  - text: a
                  - generic [ref=e158]:
                    - generic [ref=e159]: \t
                    - text: ext
                    - generic [ref=e160]: AIS
                - text: =
              - generic [ref=e164]: 1 −
              - generic [ref=e165]:
                - generic [ref=e166]: \l
                - text: eft(
                - generic [ref=e167]: \s
                - text: u
                - generic [ref=e168]:
                  - text: m
                  - generic [ref=e172]:
                    - generic [ref=e174]: i=1
                    - generic [ref=e176]: "4"
                - generic [ref=e180]:
                  - text: w
                  - generic [ref=e185]: i
                - generic [ref=e189]:
                  - text: S
                  - generic [ref=e194]: i
                - generic [ref=e201]:
                  - generic [ref=e202]: i
                  - text: ˚
                - text: ght)
                - generic [ref=e203]: \t
                - text: imes
                - generic [ref=e204]: \t
                - text: ext
                - generic [ref=e205]:
                  - generic [ref=e206]: ZK
                  - generic [ref=e212]:
                    - generic [ref=e213]: \t
                    - text: ext
                    - generic [ref=e214]: boost
        - generic [ref=e218]:
          - generic [ref=e219]:
            - img [ref=e220]
            - heading "Intent Violation Rate" [level=3] [ref=e223]
          - generic [ref=e227]:
            - math [ref=e229]:
              - generic [ref=e231]:
                - generic [ref=e232]:
                  - generic [ref=e233]: h
                  - generic [ref=e234]: ˚
                - generic [ref=e235]:
                  - generic [ref=e236]: o
                  - generic [ref=e237]:
                    - generic [ref=e239]: \t
                    - generic [ref=e240]: e
                    - generic [ref=e241]: x
                    - generic [ref=e242]: t
                    - generic [ref=e243]:
                      - generic [ref=e244]: B
                      - generic [ref=e245]: C
                      - generic [ref=e246]: C
                - generic [ref=e247]: =
                - generic [ref=e249]: \f
                - generic [ref=e250]: r
                - generic [ref=e251]: a
                - generic [ref=e252]: c
                - generic [ref=e253]:
                  - generic [ref=e254]: "N"
                  - generic [ref=e255]:
                    - generic [ref=e257]: \t
                    - generic [ref=e258]: e
                    - generic [ref=e259]: x
                    - generic [ref=e260]: t
                    - generic [ref=e261]:
                      - generic [ref=e262]: b
                      - generic [ref=e263]: l
                      - generic [ref=e264]: o
                      - generic [ref=e265]: c
                      - generic [ref=e266]: k
                      - generic [ref=e267]: e
                      - generic [ref=e268]: d
                - generic [ref=e269]:
                  - generic [ref=e270]: "N"
                  - generic [ref=e271]:
                    - generic [ref=e273]: \t
                    - generic [ref=e274]: e
                    - generic [ref=e275]: x
                    - generic [ref=e276]: t
                    - generic [ref=e277]:
                      - generic [ref=e278]: t
                      - generic [ref=e279]: o
                      - generic [ref=e280]: t
                      - generic [ref=e281]: a
                      - generic [ref=e282]: l
                - generic [ref=e284]: \t
                - generic [ref=e285]: i
                - generic [ref=e286]: m
                - generic [ref=e287]: e
                - generic [ref=e288]: s
                - generic [ref=e289]: "100"
            - generic [ref=e290]:
              - generic [ref=e291]:
                - generic [ref=e295]:
                  - generic [ref=e296]: h
                  - text: ˚
                - generic [ref=e297]:
                  - text: o
                  - generic [ref=e303]:
                    - generic [ref=e304]: \t
                    - text: ext
                    - generic [ref=e305]: BCC
                - text: =
              - generic [ref=e309]:
                - generic [ref=e310]: \f
                - text: rac
                - generic [ref=e312]:
                  - text: "N"
                  - generic [ref=e318]:
                    - generic [ref=e319]: \t
                    - text: ext
                    - generic [ref=e320]: blocked
                - generic [ref=e325]:
                  - text: "N"
                  - generic [ref=e331]:
                    - generic [ref=e332]: \t
                    - text: ext
                    - generic [ref=e333]: total
                - generic [ref=e337]: \t
                - text: imes100
        - generic [ref=e338]:
          - generic [ref=e339]:
            - img [ref=e340]
            - heading "Collateral Exposure" [level=3] [ref=e342]
          - generic [ref=e346]:
            - math [ref=e348]:
              - generic [ref=e350]:
                - generic [ref=e351]:
                  - generic [ref=e352]: E
                  - generic [ref=e353]:
                    - generic [ref=e355]: \t
                    - generic [ref=e356]: e
                    - generic [ref=e357]: x
                    - generic [ref=e358]: t
                    - generic [ref=e359]:
                      - generic [ref=e360]: r
                      - generic [ref=e361]: i
                      - generic [ref=e362]: s
                      - generic [ref=e363]: k
                - generic [ref=e364]: =
                - generic [ref=e366]: \i
                - generic [ref=e367]: "n"
                - generic [ref=e368]:
                  - generic [ref=e369]: t
                  - generic [ref=e370]: "0"
                  - generic [ref=e371]: t
                - generic [ref=e372]: P
                - generic [ref=e373]: (
                - generic [ref=e375]: \t
                - generic [ref=e376]: e
                - generic [ref=e377]: x
                - generic [ref=e378]: t
                - generic [ref=e379]:
                  - generic [ref=e380]: l
                  - generic [ref=e381]: e
                  - generic [ref=e382]: a
                  - generic [ref=e383]: k
                - generic [ref=e384]: )
                - generic [ref=e385]:
                  - generic [ref=e386]: d
                  - generic [ref=e387]: ¸
                - generic [ref=e388]: o
                - generic [ref=e389]: t
                - generic [ref=e390]:
                  - generic [ref=e391]: C
                  - generic [ref=e392]:
                    - generic [ref=e394]: \t
                    - generic [ref=e395]: e
                    - generic [ref=e396]: x
                    - generic [ref=e397]: t
                    - generic [ref=e398]:
                      - generic [ref=e399]: s
                      - generic [ref=e400]: t
                      - generic [ref=e401]: a
                      - generic [ref=e402]: k
                      - generic [ref=e403]: e
                      - generic [ref=e404]: d
                - generic [ref=e406]: \t
                - generic [ref=e407]: m
                - generic [ref=e408]: s
                - generic [ref=e409]: p
                - generic [ref=e410]: a
                - generic [ref=e411]: c
                - generic [ref=e412]: e
                - generic [ref=e413]: +
                - generic [ref=e414]:
                  - generic [ref=e415]: "3"
                  - generic [ref=e416]: m
                  - generic [ref=e417]: u
                - generic [ref=e418]:
                  - generic [ref=e419]: ".1667"
                  - generic [ref=e420]: e
                  - generic [ref=e421]: m
                - generic [ref=e422]: d
                - generic [ref=e423]: t
            - generic [ref=e424]:
              - generic [ref=e425]:
                - generic [ref=e426]:
                  - text: E
                  - generic [ref=e432]:
                    - generic [ref=e433]: \t
                    - text: ext
                    - generic [ref=e434]: risk
                - text: =
              - generic [ref=e438]:
                - generic [ref=e439]: \i
                - text: "n"
                - generic [ref=e440]:
                  - text: t
                  - generic [ref=e444]:
                    - generic [ref=e446]: "0"
                    - generic [ref=e448]: t
                - text: P(
                - generic [ref=e452]: \t
                - text: ext
                - generic [ref=e453]: leak
                - text: )
                - generic [ref=e457]:
                  - generic [ref=e458]: d
                  - text: ¸
                - text: ot
                - generic [ref=e462]:
                  - text: C
                  - generic [ref=e468]:
                    - generic [ref=e469]: \t
                    - text: ext
                    - generic [ref=e470]: staked
                - generic [ref=e474]: \t
                - text: mspace +
              - generic [ref=e475]:
                - generic [ref=e476]: 3mu
                - generic [ref=e477]: .1667em
                - text: dt
    - generic [ref=e479]:
      - generic [ref=e480]: The Validation Lifecycle
      - heading "How The Integrity Protocol Works" [level=2] [ref=e481]
      - paragraph [ref=e482]:
        - text: Autonomous agents are transacting on-chain — calling smart contracts, moving funds, approving tokens. The Integrity Protocol intercepts every agent action in a local pre-execution loop, ensuring
        - strong [ref=e483]: unauthorized or non-compliant transactions are blocked instantly before any on-chain state change occurs.
      - generic [ref=e484]:
        - generic [ref=e485]:
          - generic [ref=e486]: "1"
          - generic [ref=e487]:
            - heading "Agent Proposes a Transaction" [level=3] [ref=e488]
            - paragraph [ref=e489]: An autonomous AI agent generates a reasoning trace and proposes an on-chain action — a smart contract call, a token transfer, a DEX swap, or a cross-protocol API request. The Integrity SDK serializes the intended state, hashes it with SHA-256, and signs it with the agent's hardware-bound DID private key. This signed commitment is locked to a 60-second TTL. No commitment, no execution.
        - generic [ref=e490]:
          - generic [ref=e491]: "2"
          - generic [ref=e492]:
            - heading "BCC Validates Against Policy + Smart Contract Pre-Conditions" [level=3] [ref=e493]
            - paragraph [ref=e494]: "The Behavioral Commitment Chain (BCC) middleware intercepts the request. It runs a validation sequence in order: TTL Check, AIS Threshold Check, Intent Hash Match, and OPA Policy Evaluation. If any gate fails, the transaction is killed and the failure is logged. No exceptions."
      - document [ref=e497]:
        - generic [ref=e500]: On-chain
        - generic [ref=e503]: BCC Middleware
        - generic [ref=e506]: Integrity SDK
        - generic [ref=e509]: Autonomous Agent
        - generic [ref=e513]: On-chain
        - generic [ref=e517]: BCC Middleware
        - generic [ref=e521]: Integrity SDK
        - generic [ref=e525]: Autonomous Agent
        - generic [ref=e526]:
          - generic [ref=e528]: alt
          - generic [ref=e529]: "[any gate fails]"
          - generic [ref=e530]: "[all gates pass]"
        - generic [ref=e531]: Propose transaction
        - generic [ref=e532]: Hash intent (SHA-256)
        - generic [ref=e533]: Sign with DID key
        - generic [ref=e534]: 60s TTL commitment
        - generic [ref=e536]: Signed commitment
        - generic [ref=e537]: TTL check
        - generic [ref=e539]: AIS threshold check
        - generic [ref=e541]: Intent hash match
        - generic [ref=e543]: OPA policy evaluation
        - generic [ref=e545]: Blocked (logged, no exceptions)
        - generic [ref=e546]: Execute
        - generic [ref=e547]: State change confirmed
    - generic [ref=e548]:
      - generic [ref=e549]:
        - generic [ref=e550]: Documentation
        - heading "Frequently Asked Questions" [level=2] [ref=e551]
      - generic [ref=e552]:
        - button "How do agents sign and execute smart contracts through the Integrity Protocol?" [ref=e554] [cursor=pointer]:
          - generic [ref=e555]: How do agents sign and execute smart contracts through the Integrity Protocol?
          - img [ref=e556]
        - button "Does the pre-execution gating add latency to agent transactions?" [ref=e559] [cursor=pointer]:
          - generic [ref=e560]: Does the pre-execution gating add latency to agent transactions?
          - img [ref=e561]
        - button "What blockchains and L2s does Xibalba support?" [ref=e564] [cursor=pointer]:
          - generic [ref=e565]: What blockchains and L2s does Xibalba support?
          - img [ref=e566]
        - button "How does on-chain verification work without exposing proprietary agent logic?" [ref=e569] [cursor=pointer]:
          - generic [ref=e570]: How does on-chain verification work without exposing proprietary agent logic?
          - img [ref=e571]
        - button "Can I define custom transaction policies beyond the default templates?" [ref=e574] [cursor=pointer]:
          - generic [ref=e575]: Can I define custom transaction policies beyond the default templates?
          - img [ref=e576]
        - button "Is the SDK compatible with existing agent frameworks like LangChain, CrewAI, or AutoGen?" [ref=e579] [cursor=pointer]:
          - generic [ref=e580]: Is the SDK compatible with existing agent frameworks like LangChain, CrewAI, or AutoGen?
          - img [ref=e581]
        - button "What happens when an agent violates its policy in a live economic environment?" [ref=e584] [cursor=pointer]:
          - generic [ref=e585]: What happens when an agent violates its policy in a live economic environment?
          - img [ref=e586]
        - button "How does the Agent Integrity Score (AIS) reputation system work on-chain?" [ref=e589] [cursor=pointer]:
          - generic [ref=e590]: How does the Agent Integrity Score (AIS) reputation system work on-chain?
          - img [ref=e591]
        - button "How does Xibalba compare to Ritual, Autonolas, Fetch.ai, and Phala Network?" [ref=e594] [cursor=pointer]:
          - generic [ref=e595]: How does Xibalba compare to Ritual, Autonolas, Fetch.ai, and Phala Network?
          - img [ref=e596]
        - button "What's the go-to-market strategy? Why start with healthcare?" [ref=e599] [cursor=pointer]:
          - generic [ref=e600]: What's the go-to-market strategy? Why start with healthcare?
          - img [ref=e601]
  - contentinfo [ref=e603]:
    - generic [ref=e604]:
      - generic [ref=e605]:
        - img "Xibalba" [ref=e607]
        - paragraph [ref=e608]: The deterministic trust layer for autonomous agents. Cryptographic guarantees over AI behavior for regulated industries.
        - generic [ref=e609]:
          - img [ref=e610] [cursor=pointer]
          - img [ref=e613] [cursor=pointer]
          - img [ref=e615] [cursor=pointer]
      - generic [ref=e618]:
        - heading "Product" [level=4] [ref=e619]
        - link "Xibalba Shield" [ref=e620] [cursor=pointer]:
          - /url: "#"
        - link "Integrity Oracle" [ref=e621] [cursor=pointer]:
          - /url: "#"
        - link "Smart BAAs" [ref=e622] [cursor=pointer]:
          - /url: "#"
        - link "Developer API" [ref=e623] [cursor=pointer]:
          - /url: "#"
      - generic [ref=e624]:
        - heading "Resources" [level=4] [ref=e625]
        - link "Documentation" [ref=e626] [cursor=pointer]:
          - /url: "#"
        - link "Whitepaper" [ref=e627] [cursor=pointer]:
          - /url: "#"
        - link "ZK Circuits Wiki" [ref=e628] [cursor=pointer]:
          - /url: "#"
        - link "Status Page" [ref=e629] [cursor=pointer]:
          - /url: "#"
      - generic [ref=e630]:
        - heading "Company" [level=4] [ref=e631]
        - link "About Us" [ref=e632] [cursor=pointer]:
          - /url: "#"
        - link "Careers" [ref=e633] [cursor=pointer]:
          - /url: "#"
        - link "Privacy Policy" [ref=e634] [cursor=pointer]:
          - /url: "#"
        - link "Terms of Service" [ref=e635] [cursor=pointer]:
          - /url: "#"
    - generic [ref=e636]:
      - generic [ref=e637]: © 2026 Xibalba Technologies. All rights reserved.
      - generic [ref=e638]:
        - img [ref=e639]
        - generic [ref=e642]: "System Status: Fully Attested"
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
     |                                                                                     ^ Error: console/page errors on /landing: Failed to load resource: net::ERR_CONNECTION_REFUSED
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