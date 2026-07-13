# Integrity Protocol — Interface Contract (v1)

This document is the single source of truth for how the seven packages in this
monorepo talk to each other. Every package is being rebuilt from scratch in
parallel by a different engineer (human or agent) — if something isn't pinned
down here, packages will drift and stop interoperating. When in doubt, follow
this doc over any assumption from the old codebase.

Scope: this rewrite covers **six core packages**:
`contracts/`, `integrity-zkp/`, `integrity-oracle/`, `integrity-sdk/`,
`integrity-cli/`, `bcc_middleware/` — plus `integrity-mvp/`, the ONE
dashboard/landing app (its `demo/` subdirectory is the multi-vertical
investor/developer closed-loop scenario engine, see §11 — merged from the
former separate `integrity-dashboard/` + `integrity-demo/` packages on
2026-07-09), `integrity-userapi/`, a dedicated user-accounts/auth backend
kept strictly separate from the oracle (see §13), and
`integrity-framework/`, a reputation-derivatives package reviving the old
repo's marketplace/lending concept (see §12, not yet built). Everything
else from the old repo (marketing site, unrelated scaffolding, legacy
backups, stray installer scripts) is intentionally left out.

Ground rule for this rewrite: **no silent mocks**. Every previously-stubbed
piece (ZK proving, TEE attestation, OPA policy evaluation, on-chain BAA
checks, Merkle anchoring) must be a real, working implementation, tested
against the real toolchain below — not a hardcoded return value. If something
truly cannot be made real in this environment (e.g. real AWS Nitro hardware
attestation, which requires physical/cloud enclave hardware we don't have),
implement the real *verification* logic against the real wire format, use a
real published test vector as a fixture, and say so explicitly in a comment
and in that package's README — don't fake the check silently.

## 1. Toolchain (confirmed installed in this dev environment)

| Tool | Version | Used by |
|---|---|---|
| `forge` / `anvil` (Foundry) | 1.7.1 | contracts |
| `cargo` / `rustc` | 1.96.0 | integrity-oracle |
| `nargo` (Noir) | 1.0.0-beta.22 | integrity-zkp, integrity-oracle circuits |
| `bb` (Barretenberg) | 5.0.0-nightly | integrity-zkp, integrity-oracle (proof gen/verify) |
| `opa` | 1.18.2 | bcc_middleware, integrity-sdk |
| `node` / `npm` | 22.x / 10.x | integrity-mvp, contracts (npm-based deps) |
| `python` / `uv` | 3.12 / 0.11 | integrity-sdk, integrity-cli, bcc_middleware |

All of these are on `PATH` (added to `~/.bashrc`). Use them for real — compile
the circuits, run `bb prove`/`bb verify`, run `forge test`, run `opa eval`
against real policies. Don't write code you haven't run.

## 2. Ports & local endpoints (dev/docker-compose defaults)

| Service | Port | Package |
|---|---|---|
| Postgres | 5432 | integrity-oracle |
| Redis | 6379 | integrity-oracle |
| Anvil (local EVM chain) | 8545 | contracts |
| OPA server | 8181 | bcc_middleware |
| BCC Middleware (FastAPI) | 8000 | bcc_middleware |
| Integrity Oracle backend (Axum) | 8080 | integrity-oracle |
| Integrity Oracle OTLP/gRPC receiver | 4317 | integrity-oracle |
| Integrity User API (FastAPI) | 8090 | integrity-userapi |
| Postgres (userapi) | 5435 | integrity-userapi |
| Integrity MVP (Vite dev) | 5173 | integrity-mvp |

## 3. Environment variables (shared names — use exactly these)

- `DATABASE_URL` — Postgres connection string (oracle). Must point at a
  `timescale/timescaledb` instance, not plain `postgres` — migration 0004 runs
  `CREATE EXTENSION timescaledb` (see `docker-compose.yml`'s `postgres` service and
  §1's OTLP receiver below).
- `REDIS_URL` — Redis connection string (oracle)
- `OTLP_GRPC_ADDR` — bind address for the oracle's real OTLP/gRPC receiver
  (`integrity-oracle/backend/src/otlp.rs`), defaults to `0.0.0.0:4317` — the standard
  OTLP/gRPC port `integrity-sdk`'s `OTLPSpanExporter`/`OTLPMetricExporter` already
  target by default. A second listener, separate from the oracle's HTTP `BIND_ADDR`.
- `RPC_URL` — EVM RPC endpoint, defaults to `http://localhost:8545` (anvil) for local dev
- `CHAIN_ID` — `31337` for local anvil
- `OPA_URL` — `http://localhost:8181` (bcc_middleware, sdk)
- `BCC_MIDDLEWARE_URL` — `http://localhost:8000` (sdk, cli)
- `ORACLE_URL` — `http://localhost:8080` (sdk, cli, bcc_middleware)
- `USERAPI_URL` — `http://localhost:8090` (dashboard; integrity-userapi's own
  outbound calls to `ORACLE_URL` for agent data, never the reverse — see
  §6.10 on the backend split)
- `RESOLVER_ADDRESS` / `RESOLVER_PRIVATE_KEY` — the demo/market resolver
  signer (see §6.9's `RESOLVER_ROLE` trust boundary). Defaults to the
  deployer/funder for a single-operator testnet deployment, same posture as
  `ORACLE_SIGNER_ADDRESS` etc below.
- `DEPLOYMENTS_FILE` — path to `deployments.local.json` (see §6.6), defaults to repo root
- `BASE_SEPOLIA_RPC_URL` — RPC endpoint for the `base_sepolia` entry in
  `contracts/foundry.toml`'s `[rpc_endpoints]` (already configured there,
  referenced as `${BASE_SEPOLIA_RPC_URL}`). Needed by anything deploying or
  reading from the Base Sepolia testnet deployment rather than local anvil.
  The corresponding deployments file for that network is
  `deployments.baseSepolia.json` (also whitelisted in `foundry.toml`'s
  `fs_permissions`, same shape as §6.6).
- Signing keys are **dev-only**, read from `.env` files that are
  `.gitignore`d in every package. Never commit a populated `.env`. Only
  commit `.env.example` with placeholder values.
  `contracts/.env.example` does not exist yet as of this revision — the
  keys below describe the intended Base Sepolia deploy flow per the
  self-sovereign model (§6), not a file that's already checked in:
  - `DEPLOYER_PRIVATE_KEY` — deploys the protocol `singletons` and
    `cloneTemplates` (§6.6), once per network.
  - `ORACLE_SIGNER_PRIVATE_KEY` — the `oracleSigner` address wired into
    every agent's `ReputationRegistry`/`StateAnchor` at registration
    (§6.1, §6.3 step 3).
  - `GOVERNANCE_PRIVATE_KEY` — the `governance` address that is every
    agent's `Slasher` arbiter (§6.2) — never the agent's own key.
  - `DISPUTER_PRIVATE_KEY` — the protocol's `disputer` signer for
    `Slasher.raiseDispute` (§6.2).
  - `FUNDER_PRIVATE_KEY` — funds new agent wallets with enough native gas
    to self-deploy their `SovereignAgent`/`StateAnchor` and call
    `registerPrimitives` (§6.3), since under the self-sovereign model no
    shared factory pays those gas costs on the agent's behalf. Corresponds
    to `protocolAddresses.funderWallet` in the deployments file (§6.6).
  - Per-agent controller keys are **not** protocol env vars at all —
    they're generated/held client-side by whatever created the agent
    (`integrity-sdk`, `integrity-cli`), since the whole point of the
    self-sovereign model is that the protocol never custodies them.

## 4. Core data contracts

### 4.1 DID Document (produced/consumed by integrity-sdk, integrity-oracle)
```json
{
  "id": "did:integrity:<hex-pubkey-fingerprint>",
  "controller": "did:integrity:<hex-pubkey-fingerprint>",
  "created": "<ISO8601>",
  "verificationMethod": [{
    "id": "did:integrity:<fingerprint>#key-1",
    "type": "Ed25519VerificationKey2020",
    "publicKeyMultibase": "<base58/multibase-encoded pubkey>"
  }]
}
```
Real Ed25519 only (via the `cryptography` library) — no HMAC pseudo-signature fallback.

### 4.2 BCC Commitment (the "Behavioral Commitment Chain" intent-lock object)
```json
{
  "agent_id": "did:integrity:...",
  "intent_type": "string, e.g. 'payment' | 'data_access' | 'contract_call'",
  "intended_state_hash": "0x<32-byte hex, sha256 of the canonical intent payload>",
  "nonce": "monotonic per-agent integer",
  "timestamp": "<unix ms>",
  "signature": "0x<hex, Ed25519 sig over the above fields, canonical JSON>"
}
```
This exact shape is POSTed by `integrity-sdk` and `integrity-cli` to
`bcc_middleware`'s `POST /v1/bcc/intercept`. Field names are load-bearing —
don't rename them per-package.

### 4.3 Agent Integrity Score (AIS)
Formula (from the product spec, keep as-is):
`AIS = (S_entropy*wE + S_grounding*wG + S_sacrifice*wS + S_compliance*wC) * ZK_boost`

Default weights (must sum to 1.0, make them configurable but ship this default):
`wE = 0.30, wG = 0.30, wS = 0.20, wC = 0.20`. `ZK_boost` is `1.15` when a real
Barretenberg proof was verified for the reporting period, else `1.0`. This
formula lives in `integrity-oracle/scoring-core` and is the only place it's computed —
other packages call the oracle's `/v1/agent/{id}/ais` endpoint rather than recompute it.

### 4.4 Merkle tree convention (must match between integrity-oracle and contracts)
- Hash function: `keccak256` (not SHA-256) — this tree's root gets verified on-chain in
  `StateAnchor.sol`, and keccak256 is native/cheap in the EVM.
- Leaf hashing: `keccak256(abi.encodePacked(leafData))`.
- Parent hashing: sort the pair of child hashes ascending before concatenating
  (`keccak256(a < b ? a,b : b,a)`) — the standard OpenZeppelin `MerkleProof` convention.
  This avoids second-preimage ordering ambiguity and lets contracts use OZ's
  `MerkleProof.verify` directly instead of a custom verifier.

## 5. Zero-knowledge proving pipeline (must be real, end-to-end)

1. Circuit lives in `integrity-zkp/src/main.nr` (Noir). It proves: "I know a
   private Ed25519-derived secret and an intent payload whose hash equals the
   public `intended_state_hash`, without revealing the secret or full payload."
   Keep the circuit's constraint logic real — no `assert(true)`-style shortcuts.
2. Compile with `nargo compile` (produces the ACIR bytecode).
3. Generate a proving/verification key and Solidity verifier with `bb`:
   `bb write_vk`, and `bb write_solidity_verifier` to emit a real
   `contracts/src/oracle/UltraPlonkVerifier.sol` (generated file — replace the
   old hand-written always-true stub entirely).
4. `integrity-sdk`'s `prover.py` shells out to `nargo execute` + `bb prove` to
   produce a real proof for a given commitment, and can call `bb verify`
   locally before submission.
5. `contracts`' verifier contract is the on-chain source of truth; `integrity-oracle`
   also verifies proofs off-chain for scoring purposes using the same `bb verify` flow
   (or a Rust binding) — no independent/duplicate mock verifier.

Since this requires re-running `nargo`/`bb` commands as part of the build,
document the exact commands in `integrity-zkp/README.md` and wire them into
that package's Makefile target so CI actually exercises them.

## 6. On-chain architecture: per-agent primitives, not a singleton registry

**This section supersedes the old singleton model.** The old `contracts/`
had one shared `ReputationRegistry`, one shared `Slasher`, one shared
`StateAnchor`, and an admin-controlled `AgentFactory` that registered each
new agent into that shared state. That model is gone. It has been replaced
end-to-end (127/127 `forge test` passing) with a **self-sovereign
per-agent model**: every agent deploys and owns its own 7 "primitive"
contracts at registration time, and there is no longer a global
`ReputationRegistry`/`Slasher`/`StateAnchor` address to hardcode anywhere.
`AgentFactory.sol` has been deleted; its replacement is
`AgentPrimitivesFactory.sol` (§6.3).

### 6.1 The seven primitives

| # | Contract | Deploy mode | Purpose |
|---|---|---|---|
| 1 | `SovereignAgent` (`core/SovereignAgent.sol`) | **Direct**, by the agent's own EVM wallet | The agent's on-chain account: identity (DID), controller, `execute()`, cached AIS. Its address is the agent's canonical identity everywhere downstream. |
| 2 | `StateAnchor` (`oracle/StateAnchor.sol`) | **Direct**, by the agent's own EVM wallet (constructor `admin` = the just-deployed `SovereignAgent` address) | Anchors Merkle roots of this agent's off-chain Trust Vault state (§4.4) so individual leaves can be proven on demand. |
| 3 | `ReputationRegistry` (`oracle/ReputationRegistry.sol`) | EIP-1167 clone | This agent's AIS ledger: oracle-pushed `baseScore` plus a self-earned `ZK_boost` from a verified Barretenberg proof (§4.3). |
| 4 | `Slasher` (`oracle/Slasher.sol`) | EIP-1167 clone | Holds this agent's $ITK collateral; dispute-gated, arbiter-resolved slashing. |
| 5 | `VerifierRegistry` (`oracle/VerifierRegistry.sol`) | EIP-1167 clone | This agent's versioned pointer to whichever `IZkVerifier` implementation it currently trusts, so a global circuit upgrade doesn't force every agent onto a new version simultaneously. |
| 6 | `ComplianceGate` (`shield/ComplianceGate.sol`) | EIP-1167 clone | This agent's regulated-industry (Xibalba Shield) compliance declaration + a single live-verified `isHealthcareCompliant` read. |
| 7 | `AgentProfile` (`framework/AgentProfile.sol`) | EIP-1167 clone | Domain-membership pointer (`primaryDomain`) + off-chain metadata URI (`profileURI`). |

Only #1 and #2 are fully, independently deployed (their own bytecode, their
own address derivation) — directly by the agent's own wallet, which is
itself the cryptographic proof of self-sovereign control (nobody else's
transaction created them). #3–#7 are cheap EIP-1167 minimal-proxy clones of
5 shared implementation contracts, deployed by `AgentPrimitivesFactory` in
one registration transaction.

`XibalbaAgentRegistry.sol` (reshaped from its previous role) is the
canonical index of all 7 addresses per agent, via a `PrimitiveSet` struct:
```solidity
struct PrimitiveSet {
    address sovereignAgent;
    address stateAnchor;
    address reputationRegistry;
    address slasher;
    address verifierRegistry;
    address complianceGate;
    address agentProfile;
}
```
It is keyed both by `keccak256(bytes(did))` (`resolveDID`/`resolveDIDHash`)
and by the agent's `SovereignAgent` address (`resolveAgent`,
`isRegisteredAgent`) — the latter is what downstream consumers use, since
that's the address that arrives as `msg.sender` on every other call (e.g.
`EHRGate.checkAccess`, §6.4). `registerPrimitives` is restricted to
`REGISTRAR_ROLE`, granted only to `AgentPrimitivesFactory` — no other
contract should hold it.

### 6.2 Call-routing convention

Every clone's `DEFAULT_ADMIN_ROLE` is the agent's own `SovereignAgent`
**contract address**, never the raw controller EOA. An agent that wants to
change its `VerifierRegistry` pointer, update its `ComplianceGate`
self-declared flags, or update its `AgentProfile` metadata routes that call
through `SovereignAgent.execute(target, value, data)`, which checks
`onlyController` (the EOA) before forwarding — so control ultimately still
traces back to the controller key, but every clone only ever sees the
`SovereignAgent` contract as its admin. This is deliberate: it means a
compromise of the raw EOA's signing key is recoverable by
`rotateController`, without having to re-point every clone's admin role
individually.

**Exception — the `AgentPrimitivesFactory.registerPrimitives` call itself
is EOA-signed directly**, not routed through `execute`, because
`SovereignAgent` cannot route a call to register itself (that would be
circular: the account doesn't have an admin-recognized `execute` path
until after it exists). Instead, `registerPrimitives` verifies the caller
by checking that `msg.sender` holds `DEFAULT_ADMIN_ROLE` on the
`SovereignAgent` it claims to own
(`sa.hasRole(sa.DEFAULT_ADMIN_ROLE(), msg.sender)`) — this is the one
bootstrap exception to the "route everything through `execute`" rule.

`Slasher` is a partial exception to "admin = SovereignAgent": its
`DEFAULT_ADMIN_ROLE` (arbiter) is `governance` — the protocol's, not the
agent's — passed in at `AgentPrimitivesFactory` construction time, because
an agent must never be able to arbitrate its own slashing dispute (see the
NatSpec on `Slasher.sol`). `DISPUTER_ROLE` is likewise a protocol-held
signer (`disputer`), separate from `governance`, so a bridge/oracle
compromise and a governance-key compromise are independently revocable.
`ReputationRegistry`'s `ORACLE_ROLE` and `Slasher`'s `DISPUTER_ROLE` follow
the same pattern: protocol-held signers, distinct from both the agent's
admin role and each other.

### 6.3 Registration sequence

`AgentPrimitivesFactory` (`framework/AgentPrimitivesFactory.sol`) replaces
the deleted `AgentFactory.sol`. The real end-to-end sequence (mirrored
exactly by `contracts/test/AgentPrimitivesFactory.t.sol`, and the sequence
`integrity-sdk` will implement against real Base Sepolia transactions) is:

1. The agent's own wallet deploys `SovereignAgent` directly:
   `new SovereignAgent(did, controller, oracleSigner, factory)`.
2. The same wallet deploys `StateAnchor` directly, passing the just-deployed
   `SovereignAgent` address as `admin`:
   `new StateAnchor(address(sovereignAgent))`.
3. The wallet calls `SovereignAgent.execute(stateAnchor, 0,
   abi.encodeCall(AccessControl.grantRole, (ANCHOR_ROLE, oracleSigner)))` —
   routing the grant through the agent's own account (per §6.2) to give the
   protocol's oracle signer `ANCHOR_ROLE` on this agent's `StateAnchor`, so
   the oracle can anchor Merkle roots on the agent's behalf.
4. The wallet calls `AgentPrimitivesFactory.registerPrimitives(sovereignAgent,
   stateAnchor, did, domainId, vertical, profileURI)` (EOA-signed directly,
   per the §6.2 bootstrap exception). This single transaction:
   - verifies the caller controls the claimed `SovereignAgent`,
   - verifies `domainRegistry.canJoin(domainId, msg.sender)`,
   - clones and initializes all 5 remaining primitives with the
     `SovereignAgent` address as their admin (protocol-held roles —
     `oracleSigner`, `disputer`, `governance` — come from the factory's own
     immutables, never from the registering agent),
   - calls `XibalbaAgentRegistry.registerPrimitives` to atomically record
     the full `PrimitiveSet`,
   - calls `DomainRegistry.recordJoin` to mark the `SovereignAgent` address
     as a member of `domainId`,
   - emits `PrimitivesRegistered` with all 7 addresses.

No consumer can ever observe an agent that only half-exists: registration
either completes all 5 clones + both registry writes in one transaction, or
reverts entirely.

**Step 5 — off-chain: oracle independent re-verification.** After the
4 on-chain steps above, `integrity-sdk`'s `registration.register_agent()`
POSTs to `integrity-oracle`'s `POST /v1/agent/register`
(`integrity-oracle/backend/src/handlers.rs`'s `RegisterAgentRequest`), which
independently re-derives the agent's primitives from
`XibalbaAgentRegistry.resolveDID` on-chain and rejects (`400`) if the
client's claim doesn't match byte-for-byte — this is what makes the agent
"really" registered from the protocol's point of view, not just on-chain
from the SDK's own say-so. This schema was previously undocumented here
(silent gap, not a deliberate omission) — that silence is exactly how
`integrity-sdk`'s payload drifted from the oracle's real struct undetected
until 2026-07-09 (see `docs/wiki/WIKI_LOG.md`'s entry of that date). The real
JSON shape, pinned to the actual Rust struct:

```jsonc
// POST /v1/agent/register
{
  "did": "did:integrity:<sha256-hex-fingerprint>",   // required — NOT "agent_id"
  "did_document": { /* §4.1 DID Document, verbatim */ },
  "primitives": {
    // exactly these 7 fields (checksummed hex addresses) — nothing else;
    // extra fields are silently ignored by serde, but don't rely on that
    "sovereign_agent": "0x...",
    "state_anchor": "0x...",
    "reputation_registry": "0x...",
    "slasher": "0x...",
    "verifier_registry": "0x...",
    "compliance_gate": "0x...",
    "agent_profile": "0x..."
  },
  "ed25519_pubkey_hex": "0x...",   // optional, but the handler 400s if this
  "eth_address_hex": "0x...",      // AND eth_address_hex are both absent —
                                    // integrity-sdk always sends both
  "verification_tier": 0           // optional i32, defaults to 0 — no
                                    // verification-ladder semantics exist
                                    // yet (see identity-ceiling.md, [PLANNED])
}
```

`integrity-cli`'s `agent register` command hand-builds this same POST body
independently (it does not import `integrity_sdk.registration` — see
`entities/integrity-cli.md`'s "no sibling dependency" note) and had the
identical `agent_id`-vs-`did` drift until it was fixed in lockstep on
2026-07-09, the same day as the SDK fix above — both client implementations
now conform to this exact schema.

`integrity-sdk`'s `registration.py` sends this exact shape as of the
2026-07-09 fix (it previously sent `{"agent_id", "did_document",
"primitives": <the full AgentRegistration dataclass, extra fields and
all>}`, which 422'd on the missing `did` field and would then 400 on the
missing pubkey/address fields even if `did` were fixed alone — never caught
because every test up to that point ran with `skip_oracle_registration=True`).

### 6.4 `EHRGate` reputation resolution (was: one immutable global registry)

`shield/EHRGate.sol` used to hold one immutable global `ReputationRegistry`
address, read once at construction. Now that every agent owns its own
`ReputationRegistry` clone, there is no single address to point at.
`EHRGate` instead holds the shared `XibalbaAgentRegistry` and resolves
`msg.sender`'s own clone on every call:
```solidity
if (!registry.isRegisteredAgent(msg.sender)) return false;
address reputationRegistry = registry.resolveAgent(msg.sender).primitives.reputationRegistry;
if (ReputationRegistry(reputationRegistry).effectiveScore(msg.sender) < minAisThreshold) return false;
```
This resolution is itself a meaningful check, not just plumbing: an address
that was never registered through `AgentPrimitivesFactory` has no entry in
`XibalbaAgentRegistry`, so `checkAccess` returns `false` before it can even
reach the reputation check — closing off any hand-rolled contract that only
pretends to be a Sovereign Agent. All three of `EHRGate`'s gates (patient
consent, active BAA, AIS ≥ `minAisThreshold`) are required simultaneously;
consent alone is necessary but not sufficient.

### 6.5 Known gap: `CCIPReputationBridge` is unwired

`oracle/CCIPReputationBridge.sol` predates the per-agent clone model and
still assumes one global, immutable `ReputationRegistry` — its
`registry.getAgent(agent)` / `registry.updateScoreByBridge(agent, baseScore)`
calls no longer resolve to "the" registry for an arbitrary agent now that
every agent has its own clone. This is a documented, honest gap, not a
silently broken feature: the contract is **not** deployed by the deploy
script and **not** referenced by `AgentPrimitivesFactory`. It needs to be
reworked to resolve each agent's own `ReputationRegistry` clone via
`XibalbaAgentRegistry` before reading/writing a score, before it can be
wired back in. Don't build cross-chain reputation sync against this
contract as it stands today.

### 6.6 Deployments file shape

Local/dev deployments get written to `deployments.local.json` at the repo
root (gitignored). **This shape has changed** — it is no longer a flat list
of contract addresses, because most of those addresses no longer exist as
singletons:
```json
{
  "chainId": 31337,
  "singletons": {
    "IntegrityToken": "0x...",
    "UltraPlonkVerifier": "0x...",
    "XibalbaAgentRegistry": "0x...",
    "DomainRegistry": "0x...",
    "AgentPrimitivesFactory": "0x...",
    "CoveredEntityRegistry": "0x...",
    "SmartBAAFactory": "0x...",
    "HIPAAGuardrailRegistry": "0x..."
  },
  "cloneTemplates": {
    "ReputationRegistry": "0x...",
    "Slasher": "0x...",
    "VerifierRegistry": "0x...",
    "ComplianceGate": "0x...",
    "AgentProfile": "0x..."
  },
  "protocolAddresses": {
    "oracleSigner": "0x...",
    "governance": "0x...",
    "funderWallet": "0x...",
    "resolverSigner": "0x..."
  }
}
```

**Market/application layer additions (§6.9)**: `singletons.MarketFactory` and
`singletons.A2ACapitalPool` (protocol-level, deployed once), plus
`cloneTemplates.IntegrityMarket` (the shared implementation `MarketFactory`
clones per-market — the sixth clone template, alongside the five identity
ones above). These are written by a SEPARATE, INCREMENTAL script,
`contracts/script/DeployMarkets.s.sol` — not genesis `Deploy.s.sol` — because
by the time the market layer was added, the genesis singletons already had
real registered agents on them; re-running `Deploy.s.sol` would redeploy
`IntegrityToken`/`XibalbaAgentRegistry`/etc from scratch and orphan every one
of them. `DeployMarkets.s.sol` reads the existing deployments file, deploys
only the new contracts against the existing `IntegrityToken`/
`XibalbaAgentRegistry` addresses, and merges the new fields into the same
file (every pre-existing field is re-serialized unchanged). This is now the
general pattern for any future protocol-layer addition after genesis: a new,
narrowly-scoped incremental script, never a re-run of `Deploy.s.sol` against
a live network.
- `singletons` — protocol-level contracts that exist exactly once, deployed
  by governance, unchanged from before except for the removal of
  `AgentFactory` (deleted) and `ReputationRegistry`/`Slasher`/`StateAnchor`
  (no longer singletons — see below) and the addition of
  `AgentPrimitivesFactory`.
- `cloneTemplates` — the 5 shared implementation contracts every agent's
  EIP-1167 clones delegatecall into (§6.1, #3–#7). These are deployed once
  with `_disableInitializers()` already called, so they can never be
  initialized/hijacked directly — only clones of them can be. Note
  `SovereignAgent` and `StateAnchor` do **not** appear here: they aren't
  clone templates, they're fully independent bytecode the agent deploys
  itself (§6.1).
- `protocolAddresses` — signer/governance addresses the deploy flow wires
  into `AgentPrimitivesFactory`'s constructor (`oracleSigner`, `governance`,
  and a `funderWallet` intended to gas-fund new agent wallets on Base
  Sepolia, since agents now sign their own deployment transactions instead
  of a shared factory paying for them).

**Per-agent primitive addresses are deliberately NOT in this static file.**
There is no fixed set of them — a new set of 7 is created every time an
agent registers. `integrity-oracle` is now built and is exactly this
resolution layer: `GET /v1/agent/{id}` resolves a given agent's primitives
live from `XibalbaAgentRegistry.resolveAgent`/`resolveDID` on-chain (via
`alloy`, see `integrity-oracle/backend/src/chain.rs`), independently
re-verifying anything a client claims rather than trusting it. Any package
needing an agent's primitive addresses should call the oracle's HTTP API
(what `bcc_middleware`'s `agent_id_to_address`/`resolve_agent_primitives`
does) rather than querying `XibalbaAgentRegistry` directly — the oracle is
the one place that owns turning a DID into live on-chain primitive state.

`integrity-oracle`, `integrity-sdk`, `integrity-cli`, and `integrity-mvp`
read the *singleton and template* addresses from this file rather than
hardcoding them; per-agent addresses are always resolved live (or, once
built, via the oracle's cache) rather than read from any static file.

### 6.7 Xibalba Shield / regulated-industry compliance wiring

`shield/ComplianceGate.sol` (primitive #6, §6.1) is the concrete wire
between the core protocol and the Xibalba Shield (HIPAA) vertical, and it
is worth spelling out because it has two halves that must never be
confused with each other:

- **Live-verified compliance** — `isHealthcareCompliant(coveredEntity)`
  returns `true` only if (a) the agent declared `Vertical.Healthcare` at
  registration (`ComplianceGate.vertical`, set once in `initialize` from
  `AgentPrimitivesFactory.registerPrimitives`'s `vertical` parameter) *and*
  (b) a live on-chain read against the real `CoveredEntityRegistry`
  (`isActiveCoveredEntity`) and `SmartBAAFactory` (`isBAAActive`) both
  pass. `CoveredEntityRegistry` and `SmartBAAFactory` addresses are baked
  into `ComplianceGate`'s implementation contract as constructor
  immutables (shared across every agent's clone, same pattern as
  `AgentProfile`'s `domainRegistry`), so every clone reads the same,
  correct Shield registries without a per-agent storage write. This is a
  read path only — `ComplianceGate` does **not** replace `EHRGate` as the
  PHI-access enforcement boundary; `EHRGate.checkAccess` still performs its
  own independent live checks (patient consent, BAA, AIS threshold — §6.4)
  at access time. `ComplianceGate` is a read-optimized compliance summary
  for callers like integrity-oracle's `S_compliance` AIS component or
  integrity-mvp's Shield page, not a second enforcement point.
- **Self-declared compliance** — `hipaaEligible`, `zdrEnabled`,
  `externalWebAccessDeclared`, `dataResidencyRegion`, set via
  `setSelfDeclaredCompliance` (routed through `SovereignAgent.execute`,
  per §6.2 — `ComplianceGate`'s admin is the agent's own `SovereignAgent`).
  These mirror `integrity_sdk/telemetry/conventions.py`'s
  `IntegrityAttributes.COMPLIANCE_HIPAA_ELIGIBLE` /
  `COMPLIANCE_ZDR_ENABLED` / `COMPLIANCE_EXTERNAL_WEB_ACCESS` /
  `COMPLIANCE_DATA_RESIDENCY_REGION` span attributes — i.e. they are an
  on-chain mirror of an off-chain-attested claim the agent makes about
  itself. `isHealthcareCompliant` never reads any of these fields. Treat
  them as "what the agent says about itself" vs. "what the chain actually
  verified" — a consumer that needs an enforceable guarantee (e.g. gating
  PHI access) must use the live-verified boolean or `EHRGate`, never the
  self-declared flags.

### 6.8 Agent Contract Ownership — a formal protocol primitive

**This is the protocol's core architectural thesis, stated once, formally,
so every future package builds on it consistently rather than
reinventing it ad hoc.** Integrity Protocol agents do not merely *use*
smart contracts the way a normal dApp user does — they **own and deploy**
them, and that ownership is itself the cryptographic substrate the rest of
the protocol (reputation, compliance, markets) is built on. Two deployment
modes are both first-class, and any future primitive or application layer
must pick one of them explicitly rather than a third, undocumented pattern:

1. **Direct deployment.** The agent's own EVM wallet signs and broadcasts
   the contract-creation transaction itself. The deployment signature *is*
   the proof of self-sovereign control — nobody else's key could have
   produced it. This is how `SovereignAgent` and `StateAnchor` work (§6.1,
   primitives #1–#2), and it is available to any agent for a fully custom,
   hand-authored contract too, with no protocol factory involved at all —
   an agent can deploy literally anything from its own wallet.
2. **Factory-mediated clone deployment.** The agent calls a shared,
   protocol-level factory to cheaply clone (EIP-1167) and initialize its
   own instance of a shared implementation contract. The agent still ends
   up as that clone's owner/admin (`DEFAULT_ADMIN_ROLE` = the agent's
   `SovereignAgent` address, per §6.2's call-routing convention) — the
   factory only pays the one-time cost of the shared implementation's
   bytecode once, not per agent. This is how primitives #3–#7 work
   (`AgentPrimitivesFactory`), and — critically — it is **not limited to
   identity primitives**. `MarketFactory` (§6.9) applies the exact same
   pattern one layer up, at the *application* level: any registered agent
   can deploy and own its own customized `IntegrityMarket` instance the
   same way it owns its `ReputationRegistry` clone. This is the concrete
   proof that "agents own their contracts" is a general protocol property,
   not a one-off fact about identity.

**Why this matters beyond mechanics:** it inverts the usual "platform owns
the contract, users are just addresses in someone else's system" model.
Trust earned by one agent-owned contract (a market it created, a
reputation ledger it accrued) is portable and composable, because it's
genuinely the agent's own on-chain footprint — not a row in a platform
database the agent has no control over. Any future application layer
(lending, insurance, whatever comes after `integrity-framework`, §12)
should extend this same two-mode pattern rather than introducing a third,
platform-owned model. `integrity-mvp`'s Contracts/Factory-IDE page
(§9) is expected to expose BOTH modes to a human operator/developer: a
"deploy from template" path calling a factory, and a "deploy custom" path
where the agent's own wallet broadcasts a contract the developer authored
directly.

### 6.9 Market / application layer (`contracts/src/markets/`)

The first concrete application of §6.8's second mode beyond identity.
Global infrastructure, deployed via the incremental `DeployMarkets.s.sol`
script (§6.6):

- **`IntegrityMarket.sol`** — an EIP-1167 clone template (like primitives
  #3–#7), NOT a singleton. One clone = one market. Backs both prediction
  markets (N outcomes) and binary options (the 2-outcome case) as the same
  mechanism. `enterPosition` gates entry on the caller's LIVE
  `ReputationRegistry.effectiveScore` (resolved via `XibalbaAgentRegistry`,
  same pattern as `EHRGate.checkAccess`, §6.4) and records a
  `bccCommitmentHash` binding the position to the agent's off-chain BCC
  commitment (§4.2) — the position is provably the agent's own
  pre-committed call, not a reaction to information obtained afterward.
  Payout is pari-mutuel across the full pool on `resolve`.
  - ***Trust boundary, documented not hidden***: `resolve()` is gated to
    `RESOLVER_ROLE`, set by the market's creator at deploy time (itself, a
    delegate, or the protocol's demo/oracle signer). For the
    investor/developer MVP this is a clearly-labeled demo resolver, not a
    live price-feed oracle network (Chainlink/UMA) — staking, AIS-gating,
    BCC-commitment binding, and payout are all real; only ground-truth
    outcome resolution is a documented, swappable trust boundary. A
    production deployment swaps `RESOLVER_ROLE`'s holder; the contract's
    interface doesn't change.
  - Fraud/misreporting (a BCC-committed intent not matching an agent's
    actual position) is deliberately NOT handled inside this contract — the
    oracle is expected to compare telemetry/BCC commitments against
    on-chain positions and raise a dispute on the offending agent's own
    `Slasher` clone (the existing mechanism, §6.1 primitive #4). This keeps
    `IntegrityMarket` a small, auditable escrow rather than a second
    slashing engine.
- **`MarketFactory.sol`** — the factory (singleton) any registered agent
  calls to deploy+own its own `IntegrityMarket` clone. Deliberately
  ungated (no curator role, unlike `SmartBAAFactory`'s entity-registry
  check) — restricting *who* may create a market would undercut §6.8's
  thesis. Discovery/quality (e.g. surfacing markets by creator AIS) is a
  dashboard/oracle-index concern, not an on-chain gate.
- **`A2ACapitalPool.sol`** — a global singleton (deliberately NOT
  agent-clonable like `IntegrityMarket` — a capital pool is a shared
  many-allocator-to-many-agent venue, not an application one party
  authors and owns). Real on-chain agent-to-agent capital allocation:
  `allocate` escrows ITK from an allocator (a human wallet, or another
  agent's `SovereignAgent`) earmarked for a target agent, gated on that
  target's live AIS; `release` pays out (re-checking the AIS gate);
  `clawback` reclaims still-escrowed (pre-release) funds. Post-release
  misconduct has no fund-reversal path in this contract by design — the
  punitive lever is the target agent's own `Slasher`; `flagBreach` records
  a non-fund-moving history marker for dashboard/leaderboard display.
- **`ComplianceGate.Vertical`** (§6.7) extended: `{ None, Healthcare,
  PredictionMarket, Trading, CapitalAllocation }`. New values are
  additive-only (existing numeric ids never change). Like `Healthcare`'s
  self-declared flags, these have no live-verified `is*Compliant` check of
  their own yet — they're a self-declared operating-domain badge for
  dashboard/discovery, and do **not** gate `IntegrityMarket`/
  `A2ACapitalPool` participation, which only ever check live AIS.

### 6.10 Backend responsibility split (two trust domains, not three peer services)

As of the multi-vertical MVP, protocol-facing HTTP is split across two
**trust domains** — not three interchangeable peer services, a framing
this section used to have and which undersold how tightly the first two
pieces below are coupled — with one hard rule: **only `integrity-oracle`
ever reads on-chain state.** No other backend queries a chain RPC or a
contract directly.

- **The Oracle trust domain — one domain, two processes, split by
  before/after the action:**
  - **`bcc_middleware`** (§7, Python/FastAPI) — the BEFORE-the-action
    half: pre-execution BCC/OPA policy gating, real on-chain BAA checks,
    Merkle anchoring. An agent's own process could simply skip calling an
    SDK-side check, which is why this can't live in `integrity-sdk` — it
    has to be a service the agent cannot bypass or tamper with, and it
    does real on-chain reads/writes, which is Oracle's territory, not a
    peer concern.
  - **`integrity-oracle`** (§2, Rust/Axum) — the AFTER-the-action half
    (plus always-on reads): agent registration re-verification, telemetry
    ingest, AIS computation, and live reads of markets, positions,
    allocations, wallet balances, and a derived leaderboard (§6.9). No
    demo-orchestration logic lives here — it is a read/verify layer over
    real on-chain + telemetry state, nothing else.
  - These two keep separate codebases/processes (no forced rewrite —
    `bcc_middleware` stays Python, `integrity-oracle` stays Rust) but are
    organizationally one deployment group and one trust boundary: both
    independently re-verify what a client claims against real on-chain/
    policy state rather than trusting it.
- **`integrity-userapi`** (FastAPI + Postgres, §13) — a second, separate
  trust domain: user-facing data ONLY — accounts/auth, developer API
  keys, which DIDs a human user has claimed as "theirs," and a record of
  demo runs a user requested. It never calls a contract or a chain RPC;
  anything protocol-related it needs, it fetches from `integrity-oracle`
  over HTTP (`ORACLE_URL`). This keeps the oracle's scope narrow and
  auditable and keeps user-account concerns (passwords, sessions,
  ownership) out of a service whose whole job is being a trustworthy
  on-chain-state verifier.

`integrity-mvp` (the one dashboard/landing app, §9) is the only client
expected to talk to both the Oracle trust domain and `integrity-userapi`
directly.

## 7. OPA policy integration (must be real, no "assume success" fallback)

- `bcc_middleware/policies/*.rego` holds the real Rego policies (carry over the
  HIPAA guardrail logic from the old repo, cleaned up).
- Both `bcc_middleware` and `integrity-sdk` evaluate policy by calling a real,
  running OPA server's REST API: `POST {OPA_URL}/v1/data/integrity/bcc/allow`
  with the intent as `input`. No local regex-only fallback path — if OPA is
  unreachable, the request must fail closed (deny), not silently approve.
- Ship a `bcc_middleware/policies/*_test.rego` suite runnable via `opa test .`

## 8. TEE attestation (honest real-verification scope)

We do not have real Nitro/SGX hardware in this environment, so we cannot
*generate* genuine attestation documents. But the *verification* code must be
real: parse the actual AWS Nitro Enclave COSE_Sign1/CBOR attestation format,
verify the COSE signature against the embedded leaf certificate, and verify
the certificate chain up to AWS's published Nitro root CA. Use AWS's publicly
documented example attestation document as a test fixture (cite the source in
a code comment). Document explicitly in `integrity-sdk/security/attestation.py`
and its README that proof *generation* needs real enclave hardware we don't
have, while verification is fully implemented and tested against the fixture.
Do not leave literal placeholder strings like the old `"MRENCLAVE_STUB"`.

## 9. Directory layout (top level)

```
INTEGRITY-LATEST/
  docs/INTERFACE_CONTRACT.md   <- this file
  docker-compose.yml
  Makefile
  .gitignore
  README.md
  contracts/
  integrity-zkp/
  integrity-oracle/
  integrity-sdk/
  integrity-cli/
  bcc_middleware/
  integrity-userapi/
  integrity-mvp/            <- the ONE dashboard/landing app
    src/                     (React/Vite/TS — every product page)
    demo/                    (Python closed-loop scenario engine, §11 — a
                               script this package runs, not a second app)
```

`integrity-dashboard/` and `integrity-demo/` (below in §11's prose, and
anywhere else in this doc) were two separate packages until 2026-07-09,
when they were merged into `integrity-mvp/` — one deployed app, per the
"exactly one user-facing product surface" rule. Any reference elsewhere in
this document to either old name means the corresponding piece of
`integrity-mvp/`.

Each package keeps its own README, its own `.env.example`, its own test
suite, and its own CI-runnable `make test` / `make build` targets, wired into
the root `Makefile` and `docker-compose.yml`.

## 10. Code style

Same languages/frameworks as the old repo per package (Solidity/Foundry,
Noir, Rust/Axum, Python SDK+CLI, FastAPI, React/Vite/TypeScript). Code must
be commented for a human reader: explain *why*, not *what* — skip comments
that just restate the code, but do explain non-obvious cryptographic/protocol
invariants, since this is exactly the kind of code where a subtle mistake
(e.g. hash ordering, signature domain separation) is a real vulnerability.

## 11. integrity-mvp/demo/ (multi-vertical investor/developer closed-loop MVP)

Lives at `integrity-mvp/demo/` — a Python subdirectory of the one
dashboard app package (§9), not a standalone top-level package (it was
`integrity-demo/` until the 2026-07-09 merge). It has no UI of its own: a
runnable script/CLI entrypoint (`make demo` from the repo root) that
drives real on-chain activity for `integrity-mvp`'s dashboard pages to
display — the dashboard reads the results back out via `integrity-oracle`
(live chain reads) and `integrity-userapi` (`GET /demo/runs`), it does not
embed or launch this script itself.

Purpose: prove the whole stack works end-to-end, across MULTIPLE verticals,
by running a small fleet of real agents through a real, repeated loop — not
a static mockup, not canned data, not a single-vertical toy. This is the
flagship demonstration of §6.8's thesis (agents own their contracts, and
that ownership underwrites real financial + regulated actions) — the
target audience is investors and developers, so every step must be
independently verifiable (real tx hashes, real BaseScan links when run
against Base Sepolia), not narrated-but-faked.

**Agent fleet** (each REALLY self-registers all 7 primitives via
`integrity-sdk`'s `registration.register_agent`, real wallet, real minted
ITK — see §6.3): an honest, well-grounded agent whose AIS climbs and wins
real market calls; a reckless/overleveraged agent whose AIS decays; an
agent exercising the real Xibalba Shield/healthcare vertical (`§6.7`, real
`CoveredEntity` + `SmartBAA` + `EHRGate` access flow); and a scenario
demonstrating what a BCC-commitment/on-chain-action mismatch would surface
once oracle-side detection exists (honestly labeled if not yet automated —
never a faked slash event).

**Loop, generalized across verticals**: an agent signs a real BCC
Commitment (§4.2) for its intended action → `bcc_middleware`'s
`/v1/bcc/intercept` (real OPA evaluation, real circuit breaker) → the
action lands on a real vertical contract (`IntegrityMarket`/
`A2ACapitalPool` from §6.9, or `EHRGate` for the healthcare vertical) →
real telemetry reported to `integrity-oracle` → the oracle recomputes AIS
(§4.3) and (for markets/allocation) the demo's resolver settles real ITK
payouts → the fleet's *next* actions are chosen with awareness of each
agent's own current score — closing the loop. Capital visibly reallocates
toward the trustworthy agent via `A2ACapitalPool` as the loop progresses.

This package depends on the real, running `integrity-sdk` and deployed
`contracts/` (both required); `bcc_middleware`/`integrity-oracle` are
strongly preferred for full realism but the SDK's lower-level,
non-BCC-gated functions (`markets.enter_position`, etc.) let the core
chain mechanics be proven even if those services aren't up in a given
environment — any such gap must be stated explicitly in this package's own
`README.md`, never silently skipped. It holds the demo `RESOLVER_ROLE`
(§6.9) via a dedicated signer (`RESOLVER_PRIVATE_KEY`, §3). It has its own
`README.md` with exact run instructions (which services need to be up, in
what order, for local anvil vs. Base Sepolia) and its own real test
coverage for the scenario logic (not the sibling services, which are
tested in their own packages). `integrity-userapi` (§13) may record that a
user triggered a given demo run (`POST /demo/run`), but orchestrating the
run itself is entirely this package's job, not the user API's.

## 12. integrity-framework/ (reputation-derivatives — not yet built)

Referenced in §1's scope list but not part of this rewrite's current
phases (§6.8–§6.10, §11, §13 cover the multi-vertical MVP that now
supersedes what this package was originally scoped to explore). Concept
carried over from the old repo: a marketplace/lending layer over agent
reputation (e.g. AIS-collateralized credit, reputation derivatives). Any
future work here should build on §6.8's agent-contract-ownership pattern
(agents deploying/owning their own lending-position contracts via a
factory, the same way `MarketFactory`/`A2ACapitalPool` do today) rather
than introducing a new ownership model. Marked here explicitly as
**not yet built** per the "no silent mocks" ground rule — do not assume
any `integrity-framework/` code exists.

## 13. integrity-userapi/ (user accounts — strictly non-chain)

Purpose: own user-facing data (accounts, auth, developer API keys,
agent-ownership claims, demo-run history) with zero smart-contract or
chain-RPC access of its own — see §6.10 for the full three-backend split
rationale. FastAPI + a real Postgres (never sqlite/mocked in tests).

Real schema (illustrative, see the package's own migrations for the
authoritative shape): `users` (email, hashed password), `api_keys`
(hashed key, `ais_trust_ceiling` — mirrors the old dashboard's
developer-key convention of capping dev-issued agents at a fixed AIS
ceiling), `user_agents` (a user_id ↔ agent DID ownership POINTER only —
never a cache of full agent state, which always comes live from
`integrity-oracle`), `demo_runs` (status/history of `integrity-mvp/demo/`
invocations a user requested).

Core endpoints: `POST /auth/register`, `POST /auth/login`, `GET /me`,
`POST /api-keys` (returns the raw key exactly once, stores only its
hash), `GET /api-keys`, `DELETE /api-keys/{id}`, `GET /me/agents` (fans
out to `integrity-oracle`'s `GET /v1/agent/{id}` for live data per owned
DID — never duplicates it locally), `POST /me/agents`, `POST /demo/run`,
`GET /demo/runs`.

Hard rule, worth repeating from §6.10 because it is the one invariant this
whole package exists to preserve: if a change to this package would
require importing `web3`/`alloy`-equivalent tooling or reading a
`deployments.*.json` file, that change belongs in `integrity-oracle`
instead.

**Postgres, wiring, tests (as of 2026-07-09):** `docker-compose.yml` has a
dedicated `userapi-postgres` service (`postgres:16-alpine`,
`integrity`/`integrity_dev_only`, db `integrity_userapi`, host port
`5435`) — deliberately its own instance/port, never sharing
integrity-oracle's `postgres` service (5432) or its ad hoc e2e-test
convention (5434, see `integrity-oracle/README.md`), since two separate
Postgres instances per trust domain is the whole point of the §6.10 split.
The `userapi` app service builds `integrity-userapi/Dockerfile` (uv-based,
same pattern as `bcc_middleware/Dockerfile`) and exposes 8090. 33 real
pytest tests in `integrity-userapi/tests/` run against a real Postgres via
this same server (a separate `integrity_userapi_test` database,
auto-created by `tests/conftest.py` on first run) — unlike
`integrity-oracle`'s opt-in/env-gated e2e test, this suite has no skip
path: it fails hard (connection refused at collection time) if
`userapi-postgres` isn't reachable, since "pytest green against a real
Postgres" is this package's stated completion gate, not an optional extra.
The `GET /me/agents` tri-state (live data / not found / oracle
unreachable) is tested against a real local HTTP server standing in for
`integrity-oracle`, never a mock of `app/oracle_client.py`'s internals.

**CORS (added 2026-07-09, real gap found wiring `integrity-mvp`'s auth
swap):** this service had no CORS policy at all before — every request
from a browser-hosted `integrity-mvp` (served by Vite on its own port,
never the same origin as this API) would be blocked outright. Fixed with
`fastapi.middleware.cors.CORSMiddleware` in `app/main.py`
(`allow_origins=["*"]`, `allow_credentials=False` — every authenticated
request here carries a `Authorization: Bearer <jwt>` header, never a
cookie, so a wildcard origin is safe; combining a wildcard origin with
`allow_credentials=True` is invalid per the CORS spec anyway). Verified:
`integrity-userapi`'s 33 pytest tests still pass unchanged after the
addition (CORS is a browser-enforced concern, invisible to a server-side
test client), and a real cross-origin browser call from `integrity-mvp`
(Playwright, `e2e/auth.spec.ts`) now succeeds end-to-end.

## 14. integrity-mvp's real integration with integrity-userapi (auth swap, 2026-07-09)

Per §13's "one unified app" rule and the previously-pending item this
section resolves: `integrity-mvp`'s dashboard now authenticates against
this service for real (`src/lib/api/userapi.ts`, `src/auth/AuthContext.tsx`)
— the Firebase-based `AuthContext`/`AuthGate`/`firebase.ts` from the
original scaffold are gone, not left running alongside a second auth
system. A JWT from `POST /auth/login`/`POST /auth/register` is stored in
`localStorage` and attached to every `userapiClient` request via an axios
request interceptor (`src/lib/api/client.ts`). Only account-scoped routes
(`/account` — API keys, owned-agent pointers, demo-run history) sit behind
a real session check; Landing, the agent list/detail, markets,
leaderboard, and wallet stay public — real protocol data doesn't require
an account to read, matching investor/developer intent. `integrity-mvp/e2e/global-setup.ts`
now boots a real `integrity-userapi` instance (its own ephemeral Postgres
database on the same E2E container, real `uvicorn` process) alongside the
oracle, so `e2e/auth.spec.ts` exercises real registration, real login, and
a real 401 on bad credentials against this actual service — not a mock.

### Real oracle wire-shape corrections found while wiring this (integrity-oracle untouched, worked around client-side)

Running the pre-existing Playwright suite for the first time (before this
pass's fixes) surfaced that `integrity-mvp`'s `lib/api/types.ts` had
drifted from what `integrity-oracle/backend/src/handlers.rs` actually
serializes — 4 of 5 specs failed. Documented here because it's a
cross-package contract fact, not just an `integrity-mvp`-internal detail:

- `GET /v1/agents` returns `{id, verification_tier, created_at}`
  (`AgentSummary`) — no `ais`/`alias`/`zk_proof_verified`/`registered_at`/
  `last_active` fields ever existed in this response; those were an
  unverified assumption in the original dashboard scaffold.
- `GET /v1/agent/{id}` (`AgentResponse`) never returns a `did_document` —
  `POST /v1/agent/register`'s `RegisterAgentRequest.did_document` is
  accepted on the way in but never persisted or returned by any GET. A
  real, confirmed gap (not fixed here — out of `integrity-mvp`'s scope to
  fix the oracle).
- `PrimitiveSetDto`'s own doc comment in `handlers.rs` claims its fields
  match the dashboard "field-for-field (camelCase)" — this is incorrect;
  the struct has no `#[serde(rename_all = "camelCase")]`, so it actually
  serializes snake_case (`sovereign_agent`, `state_anchor`, ...). Worth
  fixing the stale comment (or adding the attribute) in a future
  `integrity-oracle` pass; `integrity-mvp` now assumes the real snake_case
  shape.
- `ComplianceResponse` fields are `is_compliant`/`covered_entity`
  (snake_case), not the `isCompliant`/`coveredEntity` the original
  dashboard scaffold guessed.
- `AisResponse.weights` (`scoring_core::AisWeights`) fields are
  `w_entropy`/`w_grounding`/`w_sacrifice`/`w_compliance`, and there is no
  `history` array anywhere in the response — the dashboard's old AIS
  sparkline was reading a field the oracle never sends.

`GET /v1/markets`, `GET /v1/markets/{id}`, `GET /v1/leaderboard`, and
`GET /v1/agent/{id}/wallet` had no prior dashboard assumption to drift from
(first-time consumers) and match `handlers.rs` as documented in §6.9.
`integrity-oracle` exposes **no** `A2ACapitalPool` read endpoint at all
(confirmed against `routes.rs`) — `integrity-mvp`'s Capital Allocation page
states this as a real, visible gap rather than fabricating live pool data.
