"""
Runtime configuration for the BCC middleware.

Every knob here is read from the environment (with `.env` support for local
dev) rather than hardcoded, because this service's security posture depends
on operators being able to point it at the right OPA server, chain RPC, and
deployed contract addresses per environment (local anvil vs. a real testnet)
without editing code.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # no-op in prod if no .env file is present; picks it up for local dev


def _bool_env(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


@dataclass
class Settings:
    # --- Cross-package shared env vars (see docs/INTERFACE_CONTRACT.md §3) ---
    opa_url: str = field(default_factory=lambda: os.getenv("OPA_URL", "http://localhost:8181"))
    oracle_url: str = field(default_factory=lambda: os.getenv("ORACLE_URL", "http://localhost:8080"))
    rpc_url: str = field(default_factory=lambda: os.getenv("RPC_URL", "http://localhost:8545"))
    chain_id: int = field(default_factory=lambda: int(os.getenv("CHAIN_ID", "31337")))
    deployments_file: str = field(
        default_factory=lambda: os.getenv("DEPLOYMENTS_FILE", str(Path(__file__).resolve().parents[2] / "deployments.local.json"))
    )

    # --- OPA policy document coordinates (§7) ---
    # We evaluate the whole `integrity/bcc` package document in one call rather
    # than only the `/allow` leaf so we can also read `violation` (for audit
    # logging) and `requires_baa` (to decide whether the on-chain BAA gate
    # applies) out of the *same* OPA evaluation as the allow/deny decision.
    # This is the identical Rego rule set the interface contract's
    # `/v1/data/integrity/bcc/allow` path evaluates -- see README "Integration
    # reconciliation" section for why integrity-sdk calling the narrower path
    # is still guaranteed to agree with us.
    opa_package_path: str = field(default_factory=lambda: os.getenv("OPA_PACKAGE_PATH", "/v1/data/integrity/bcc"))
    opa_timeout_seconds: float = field(default_factory=lambda: float(os.getenv("OPA_TIMEOUT_SECONDS", "3.0")))

    # --- Commitment freshness / replay window ---
    # A signed commitment older than this is refused even if everything else
    # checks out -- this bounds how long a captured-and-replayed commitment
    # stays valid.
    max_commitment_age_ms: int = field(default_factory=lambda: int(os.getenv("BCC_MAX_AGE_MS", "60000")))

    # --- Circuit breaker ---
    circuit_breaker_violation_threshold: int = field(
        default_factory=lambda: int(os.getenv("BCC_CB_VIOLATION_THRESHOLD", "3"))
    )
    circuit_breaker_lockout_seconds: int = field(
        default_factory=lambda: int(os.getenv("BCC_CB_LOCKOUT_SECONDS", "900"))
    )

    # --- On-chain BAA check ---
    # Key looked up in deployments.<network>.json's `singletons` section (§6.6).
    # It's `SmartBAAFactory`, not `SmartBAA`: the FACTORY implements
    # `isBAAActive(coveredEntity, businessAssociate)`; the per-pair `SmartBAA`
    # escrow instances it creates do not. This is now a real deployed singleton
    # (bootstrapped by contracts/script/Deploy.s.sol), no longer a §6 gap.
    baa_contract_name: str = field(default_factory=lambda: os.getenv("BAA_CONTRACT_NAME", "SmartBAAFactory"))
    baa_check_timeout_seconds: float = field(default_factory=lambda: float(os.getenv("BAA_CHECK_TIMEOUT_SECONDS", "5.0")))

    # --- Merkle anchoring ---
    # NOTE: StateAnchor is now a PER-AGENT primitive, not a global singleton, so
    # there is no single deployments-file key for it — anchoring resolves each
    # agent's own StateAnchor clone via the oracle (see app/anchor.py). This
    # setting is retained only as a legacy/override escape hatch.
    state_anchor_contract_name: str = field(
        default_factory=lambda: os.getenv("STATE_ANCHOR_CONTRACT_NAME", "StateAnchor")
    )
    merkle_batch_size: int = field(default_factory=lambda: int(os.getenv("BCC_MERKLE_BATCH_SIZE", "8")))
    # Dev-only signer used to submit the anchorRoot() transaction. Never a
    # populated real value in committed config -- see .env.example.
    anchor_signer_private_key: str | None = field(
        default_factory=lambda: os.getenv("ANCHOR_SIGNER_PRIVATE_KEY")
    )

    def load_deployments(self) -> dict:
        """
        Best-effort read of the shared deployments.local.json (§6). Missing
        file (common in dev before `contracts/` has deployed anything) or a
        missing key is NOT an error here -- callers (baa.py, anchor.py) are
        responsible for treating "no address configured" as "cannot verify"
        and failing closed where that matters (BAA), vs. best-effort where
        it doesn't (anchoring, see README).
        """
        path = Path(self.deployments_file)
        if not path.exists():
            return {}
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            return {}

    def contract_address(self, name: str) -> str | None:
        """
        Resolve a deployed contract address by name from the nested
        deployments-file shape (§6.6): `singletons` first (the common case —
        SmartBAAFactory, XibalbaAgentRegistry, DomainRegistry, …), then
        `cloneTemplates` (the 5 implementation contracts). Per-agent primitive
        instances are deliberately NOT in this file and are never resolved here
        — they come from the on-chain registry / oracle (see app/anchor.py).

        Also accepts the old flat `contracts` map as a fallback so a legacy
        deployments file still works, though nothing writes that shape anymore.
        """
        data = self.load_deployments()
        for section in ("singletons", "cloneTemplates", "contracts"):
            addr = data.get(section, {}).get(name)
            if addr:
                return addr
        return None


settings = Settings()
