"""
EVM (secp256k1) wallet module for the Integrity Protocol SDK.

This is deliberately a SEPARATE keypair from did.py's Ed25519 identity key,
not a re-derivation of it. The DID key proves "which agent said this" for
off-chain BCC commitments and telemetry signatures (§4.1/§4.2); the EVM key
proves "which wallet deployed/controls this agent's on-chain primitives" —
per docs/INTERFACE_CONTRACT.md's "Agent Primitives" section, the whole point
of self-sovereign registration is that the agent's OWN wallet signs the
SovereignAgent/StateAnchor deployment transactions, so that deployment-time
signature is real, independently-verifiable proof of control. Mixing the two
key types (e.g. reusing the Ed25519 seed as an EVM private key) would also be
cryptographically wrong: EVM/secp256k1 keys and Ed25519 keys are different
curves with different scalar validity ranges, there is no safe bit-for-bit
reuse between them.

Storage posture is intentionally stronger than did.py's plain PEM: this key
signs real value-bearing transactions (contract deploys, ITK transfers), so
it's persisted as an Ethereum V3 encrypted keystore (the same format
MetaMask/geth use) rather than plaintext, gated by a password the caller must
supply out-of-band (INTEGRITY_WALLET_PASSWORD) rather than a convenience
default.
"""

from __future__ import annotations

import json
import os
import stat
from pathlib import Path
from typing import Optional

from eth_account import Account
from eth_account.signers.local import LocalAccount
from eth_utils import to_checksum_address

# Registers extended key-derivation/message-signing functionality onto
# `Account` (HD wallets, EIP-712, etc.) — not strictly required for the plain
# `Account.create`/`Account.encrypt` calls below, but importing it is the
# documented way to get the full `eth_account` feature surface predictably
# available for any sibling module that reaches for it later (e.g. EIP-712
# domain-separated signing for a future off-chain order/attestation format).
Account.enable_unaudited_hdwallet_features()


class WalletPasswordNotSet(RuntimeError):
    """Raised when a keystore operation needs INTEGRITY_WALLET_PASSWORD and
    it isn't set. No silent fallback to an empty/default password — an EVM
    wallet controls real (even if testnet) value, and a convenience default
    here would be exactly the kind of silent security downgrade did.py's own
    docstring warns against for the DID key."""


def _default_wallet_home() -> Path:
    override = os.getenv("INTEGRITY_WALLET_HOME")
    if override:
        return Path(override).expanduser()
    return Path.home() / ".integrity" / "wallet"


def wallet_dir(agent_id: Optional[str]) -> Path:
    """Public so registration.py / the CLI can co-locate other per-agent
    on-chain state (e.g. a cached primitives.json) without duplicating the
    path-resolution logic — mirrors did.py's `agent_dir`."""
    base = _default_wallet_home()
    return base / (agent_id or "default")


def _wallet_password() -> str:
    password = os.getenv("INTEGRITY_WALLET_PASSWORD")
    if not password:
        raise WalletPasswordNotSet(
            "INTEGRITY_WALLET_PASSWORD is not set. An EVM wallet keystore "
            "cannot be created or unlocked without it — see wallet.py's "
            "module docstring for why this has no default."
        )
    return password


def generate_or_load_evm_wallet(agent_id: Optional[str] = None) -> LocalAccount:
    """
    Load the persisted EVM keypair for `agent_id`, or generate a fresh
    secp256k1 keypair and encrypted keystore if none exists yet.

    Returns an `eth_account.signers.local.LocalAccount` — has `.address` and
    `.key` (raw private key bytes) and can sign transactions/messages
    directly, or be handed to `chain.py`'s deploy/registration functions.
    """
    this_wallet_dir = wallet_dir(agent_id)
    this_wallet_dir.mkdir(parents=True, exist_ok=True)
    keystore_path = this_wallet_dir / "keystore.json"

    password = _wallet_password()

    if keystore_path.exists():
        keystore_json = json.loads(keystore_path.read_text())
        private_key = Account.decrypt(keystore_json, password)
        return Account.from_key(private_key)

    account: LocalAccount = Account.create()
    keystore_json = Account.encrypt(account.key, password)
    keystore_path.write_text(json.dumps(keystore_json, indent=2) + "\n")
    # Keystore JSON is password-encrypted, but owner-only permissions are
    # still the right default posture — same reasoning as did.py's PEM file.
    os.chmod(str(keystore_path), stat.S_IRUSR | stat.S_IWUSR)

    return account


def load_evm_address(agent_id: Optional[str] = None) -> Optional[str]:
    """
    Read-only address lookup that does NOT require the wallet password —
    the V3 keystore format's top-level `address` field is unencrypted (only
    the private key material inside `crypto` is), so callers that just need
    "does this agent have a wallet, and what's its address" (e.g. the CLI's
    `agent status` command, or a UI) don't need to prompt for a password.
    Returns None if no keystore exists yet.
    """
    keystore_path = wallet_dir(agent_id) / "keystore.json"
    if not keystore_path.exists():
        return None
    keystore_json = json.loads(keystore_path.read_text())
    raw_address = keystore_json.get("address")
    if not raw_address:
        return None
    return to_checksum_address("0x" + raw_address.removeprefix("0x"))
