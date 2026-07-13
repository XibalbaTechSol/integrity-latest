# Integrity Protocol Wiki — Schema (v1)

## Domain
The compiled knowledge base for the Integrity Protocol monorepo: on-chain
agent identity/reputation, zero-knowledge attestation, behavioral policy
gating, off-chain scoring, and the SDK/CLI/dashboard/demo that use them.

## Conventions
- **Filenames**: lowercase, hyphenated, `.md` (e.g. `behavioral-commitment-chain.md`).
- **Solidity contracts**: exact contract name + `.sol.md` (e.g. `SovereignAgent.sol.md`).
- **Wikilinks**: use `[Title](relative/path.md)` to interlink entities/concepts/acronyms. Minimum 2 outbound links per page.
- **Frontmatter**: required on every page (template below).
- **Index sync**: every new page is added to `WIKI_INDEX.md` in the same pass it's created.
- **Append log**: every creation/update is logged in `WIKI_LOG.md` (append-only).
- **No aspirational content**: only document what exists in the code. Planned-but-unbuilt is marked `[PLANNED]`.
- **No duplication**: each fact lives on exactly one canonical page; others link to it.
- **Code over prose**: include real function signatures, schemas, or CLI commands, not paraphrase.

## Frontmatter template
```yaml
---
title: Page Title
acronyms: [optional, e.g. AIS, BCC]
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: entity | concept | comparison | query
tags: [see taxonomy below]
confidence: high | medium | low
source_files:
  - relative/path/to/file
---
```

### Confidence scoring
| Level | Meaning |
|---|---|
| `high` | Verified against source within the last 14 days |
| `medium` | Previously verified; source may have changed since — needs review |
| `low` | Carried over from a spec/plan, not yet verified against real code |

## Tag taxonomy
- `cryptography` — ZK proofs, hashing, signing
- `identity` — DIDs, key management
- `compliance` — HIPAA/OPA policy, guardrails
- `metrics` — AIS formula, scoring
- `tokenomics` — staking, slashing, $ITK
- `layer-2` — on-chain registries, anchoring
- `sdk` — client libraries, integrations
- `infrastructure` — oracle, middleware, deploy, CI

## Directory structure
- `entities/` — packages, services, contracts (one page per real thing)
- `concepts/` — protocols, algorithms, cryptographic conventions shared across packages
- `architecture/` — cross-cutting data-flow / sequence docs
- `queries/` — open research questions, investigation notes (not conclusions)

## Source binding rule
Every entity page's `source_files` must list real files that exist right
now. If a listed file is deleted or renamed, the page is stale — fix it or
remove the page in the same pass that changes the code.
