---
title: Identity Ceiling & Verification Ladder [PARTIALLY BUILT]
created: 2026-07-09
updated: 2026-07-11
type: concept
tags: [identity, metrics, compliance]
confidence: high
source_files:
  - README.md
  - integrity-oracle/backend/src/handlers.rs
  - bcc_middleware/app/chain.py
  - bcc_middleware/policies/bcc.rego
---

**`[PARTIALLY BUILT]`** — updated 2026-07-11: this page previously said
nothing below gates anything in the running code. That's no longer fully
true. Two real pieces now exist:

1. **Tier assignment is server-verified, not client-asserted.**
   `integrity-oracle`'s `register_agent` handler (`SERVER_VERIFIED_TIER`
   constant) always computes the tier itself — a client can no longer send
   `verification_tier: 3` and have it stored as-is. Today the constant is
   always `1`, because Tier 1 is the only tier with a real verification path
   (see the ladder table below); this becomes a real per-agent computation
   once Tier 2/3 verification exists.
2. **`bcc_middleware`'s OPA policy consults tier for a subset of actions.**
   `bcc.rego`'s `min_tier_by_intent_type` rule denies clinical intent-types
   (`EMR_WRITE`, `DISPENSE_MEDICATION`, `BILLING_SUBMISSION`,
   `SECURE_EMR_WRITE`, `CLINICAL_DATA_ACCESS`) from any agent whose
   server-verified tier is below the required minimum — currently 1 for all
   of them, since (as below) nothing higher is achievable yet. This is
   defense-in-depth on top of the existing clinical allowlist, not a
   replacement for it: an unresolvable/unregistered agent (tier resolves to
   0 on lookup failure, see `app/chain.py::resolve_verification_tier`) is
   denied even if it somehow ended up on the allowlist.

**Still not built:** the `AIS_final = min(S_calculated, Tier_ceiling)` clamp
below, Tier 2/3 verification paths themselves, and — because of that — any
tier requirement above 1 would either be a permanent no-op or a policy that
looks enforced but can never actually be satisfied. Raise thresholds only
once real Tier 2/3 verification exists.

## The design

The idea: an agent's [AIS](ais.md) *ceiling* (not just its measured score)
should be tied to how strongly its identity is verified, so a freshly
created, unverified agent can never simply out-score a hardware-attested
institutional one.

| Tier | Verification | AIS ceiling | Status |
|---|---|---|---|
| 1 — Sovereign | Proof-of-possession of a software key (what every agent has today) | 600 | **Server-verified and assigned at registration** (`SERVER_VERIFIED_TIER`); **consulted by `bcc_middleware`'s OPA gate** for clinical intent-types — but the AIS *ceiling* clamp itself is still not enforced |
| 2 — Linked | DNS TXT record or social-account attestation | 850 | Not built |
| 3 — Institutional | Remote TEE attestation + institutional audit | 1000 (uncapped credit) | Not built |
| Developer API key (testnet convenience) | Issued by `integrity-userapi` (in progress, no wiki entity page yet — see [WIKI_INDEX.md](../WIKI_INDEX.md)) | Capped at 300 | Planned — its `ais_trust_ceiling` column exists in the schema today but isn't consulted by any live gate yet |

`AIS_final = min(S_calculated, Tier_ceiling)` — this clamp is not
implemented anywhere in `scoring-core` today; the formula
(`concepts/ais.md`) has no ceiling term. Note this is a **separate** gap from
the `bcc_middleware` tier gate above: that gate checks "is this agent's tier
high enough to attempt this *action*," which is now real; this clamp would
cap the agent's *score* itself, which is still unbuilt.

## Correcting the old wiki's mechanism

The old wiki's `identity-ceiling.md`/`hardware-fingerprinting.md` described
Tier 1 as "hardware-tethered" and Tier 2/3 verification building on a
`did:xibalba:<hardware_hash>` derived by hashing CPU model, MAC address,
and OS `machine-id`. **This does not match the current design.** Identity
in this rewrite is a software-held Ed25519/secp256k1 keypair (see
[DID](did.md)) — there is no hardware fingerprint anywhere in
`integrity-sdk`/`integrity-cli` today, and the corrected long-term roadmap
(README's "Identity & hardware trust" table) points at a different, more
credible mechanism: keys tethered to a real TEE/SGX enclave or an HSM (AWS
KMS, FIPS 140-2 Level 3), verified via genuine remote attestation
(AWS Nitro/Intel SGX), not a locally-computed hardware hash a host could
freely fabricate. [integrity-sdk](../entities/integrity-sdk.md)'s
`security/attestation.py` already implements real *verification* of AWS
Nitro attestation documents against a published test fixture — proof
*generation* needs real enclave hardware this environment doesn't have,
which is why the ladder above is entirely unenforced today. Treat any
mention of MAC-address/CPU-serial hashing as never-built product ideation,
not a superseded-but-once-real mechanism.

## EIP-712 binding (design detail, not implemented)

The old wiki proposed an `EntityBinding` EIP-712 typed-data schema binding
an agent's wallet to a named legal `controller`. No such schema or
verification code exists in `contracts/` or `integrity-sdk/` today — noted
here only because it's a plausible future shape for Tier 2/3 binding, not
because it's built.

Related: [DID](did.md), [AIS](ais.md), [agent primitives](agent-primitives.md).
