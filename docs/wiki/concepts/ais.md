---
title: Agent Integrity Score (AIS)
acronyms: [AIS]
created: 2026-07-07
updated: 2026-07-11
type: concept
tags: [metrics]
confidence: high
source_files:
  - integrity-oracle/scoring-core/src/lib.rs
  - integrity-sdk/integrity_sdk/telemetry/derive.py
  - docs/INTERFACE_CONTRACT.md
---

The composite trust score for an agent, computed by [Integrity Oracle](../entities/integrity-oracle.md):

`AIS = (S_entropy*wE + S_grounding*wG + S_sacrifice*wS + S_compliance*wC) * ZK_boost`

Default weights (sum to 1.0): `wE=0.30, wG=0.30, wS=0.20, wC=0.20`.
`ZK_boost = 1.15` when a real Barretenberg proof (see [ZKP](zkp.md)) was
verified for the reporting period, else `1.0`.

This formula is computed in exactly one place (`integrity-oracle/scoring-core`
per the package's own README once built) — other packages read it via the
oracle's `GET /v1/agent/{id}/ais` endpoint rather than recomputing it. See
[Interface Contract §4.3](../../INTERFACE_CONTRACT.md#43-agent-integrity-score-ais)
for the canonical definition. The four component *inputs* the SDK derives
client-side before the oracle applies this formula are documented
separately — see [Local Metrology](local-metrology.md), which also
supersedes an old, inconsistent 3-component draft formula (no compliance
term, weights not summing to 1.0) that never matched this one.

`AIS_final = min(S_calculated, Tier_ceiling)` — an identity-verification
ceiling clamp — is a **`[PLANNED]`** design, not implemented in
`scoring-core` today; see [Identity Ceiling](identity-ceiling.md).

Related: [Behavioral Commitment Chain](bcc.md), [Integrity Oracle](../entities/integrity-oracle.md),
[Local Metrology](local-metrology.md), [AIS API — Versioned Wire Spec](ais-api-spec.md),
[Identity Ceiling & Verification Ladder](identity-ceiling.md).
