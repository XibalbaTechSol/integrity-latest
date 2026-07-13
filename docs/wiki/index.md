# Integrity Protocol Wiki

Compiled knowledge base for the Integrity Protocol monorepo — start at
[WIKI_INDEX.md](WIKI_INDEX.md) for the full content catalog, or jump to a
concept: [AIS](concepts/ais.md) · [BCC](concepts/bcc.md) · [DID](concepts/did.md) · [ZKP](concepts/zkp.md).

See `../INTERFACE_CONTRACT.md` for the binding cross-package contract this
wiki documents, and `../../.agents/AGENTS.md` for how this wiki gets kept in
sync with the code.

## System at a glance

```mermaid
flowchart TB
    Wallet["Agent's own wallet"]
    Factory["AgentPrimitivesFactory"]

    subgraph OnChain["On-chain (EVM / Base Sepolia + anvil)"]
        SA["SovereignAgent<br/>(identity account)"]
        StA["StateAnchor<br/>(per-agent audit root)"]
        subgraph Clones["5 EIP-1167 minimal-proxy clones"]
            RR["ReputationRegistry"]
            SL["Slasher"]
            VR["VerifierRegistry"]
            CG["ComplianceGate"]
            AP["AgentProfile"]
        end
    end

    SDK["integrity-sdk / integrity-cli"]
    BCC["bcc_middleware<br/>(FastAPI + OPA)"]
    Oracle["integrity-oracle<br/>(Rust/Axum)"]
    MVP["integrity-mvp<br/>(React + Python)"]

    Wallet -->|signs direct deploys| SA
    Wallet -->|signs direct deploys| StA
    Factory -->|clones| RR
    Factory -->|clones| SL
    Factory -->|clones| VR
    Factory -->|clones| CG
    Factory -->|clones| AP

    SDK --> Wallet
    SDK -->|pre-execution gate| BCC
    BCC -->|telemetry| Oracle
    Oracle -->|resolve + score| OnChain
    Oracle --> MVP
```

See [concepts/ais.md](concepts/ais.md) for the AIS scoring flow diagram and
[entities/](entities/) for a per-package breakdown.
