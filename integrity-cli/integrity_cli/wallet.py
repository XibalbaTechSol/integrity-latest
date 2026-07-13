"""
EVM (secp256k1) wallet module for the Integrity CLI.

Deliberately a SEPARATE keypair from identity.py's Ed25519 DID key, not a
re-derivation of it -- same rationale as integrity-sdk's wallet.py (see that
module's docstring, which this file's logic mirrors): the DID key proves
"which agent said this" for off-chain DID documents; the EVM key proves
"which wallet deployed/controls this agent's on-chain primitives" -- per
docs/INTERFACE_CONTRACT.md's "Agent Primitives" section, self-sovereign
registration means the agent's OWN wallet signs the SovereignAgent/
StateAnchor deployment transactions, so that signature is real,
independently-verifiable proof of control. EVM/secp256k1 and Ed25519 are
different curves with different scalar validity ranges -- there is no safe
bit-for-bit reuse between the two key types.

This is a CLI-local reimplementation, not an import of integrity_sdk.wallet
-- see identity.py's module docstring for why this package deliberately
duplicates identity/wallet logic instead of depending on the sibling SDK
package while both are still in flux. The on-disk format and library calls
are the same (Ethereum V3 encrypted keystore via eth_account); only the
storage path convention differs, to match this CLI's own layout:
~/.integrity-cli/identity/<name>.wallet.json, alongside identity.py's
~/.integrity-cli/identity/<name>.pem -- the two files are siblings for the
same local identity, distinguished only by extension. Note this module reads
identity.IDENTITY_DIR *inside* each function (not a copied module-level
constant) so that tests which monkeypatch identity.IDENTITY_DIR (see
tests/conftest.py's isolated_home fixture) transparently also redirect
wallet storage -- no separate test scaffolding needed to keep the two paths
in sync.

Storage posture is intentionally stronger than identity.py's plain PEM: this
key signs real value-bearing transactions (contract deploys, ITK transfers),
so it's persisted as an Ethereum V3 encrypted keystore (the same format
MetaMask/geth use) rather than plaintext, gated by a password the caller
must supply out-of-band (INTEGRITY_WALLET_PASSWORD) rather than a
convenience default.
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

from . import identity

# Registers extended key-derivation/message-signing functionality onto
# `Account` (HD wallets, EIP-712, etc.) -- not strictly required for the
# plain `Account.create`/`Account.encrypt` calls below, but importing it
# keeps the full `eth_account` feature surface available, same as
# integrity-sdk's wallet.py.
Account.enable_unaudited_hdwallet_features()


class WalletPasswordNotSet(RuntimeError):
    """Raised when a keystore operation needs INTEGRITY_WALLET_PASSWORD and
    it isn't set. No silent fallback to an empty/default password -- an EVM
    wallet controls real (even if testnet) value, and a convenience default
    here would be exactly the kind of silent security downgrade identity.py's
    own docstring warns against for the DID key's storage posture."""


def _wallet_path(name: str) -> Path:
    return identity.IDENTITY_DIR / f"{name}.wallet.json"


def _wallet_password() -> str:
    password = os.getenv("INTEGRITY_WALLET_PASSWORD")
    if not password:
        raise WalletPasswordNotSet(
            "INTEGRITY_WALLET_PASSWORD is not set. An EVM wallet keystore "
            "cannot be created or unlocked without it -- see wallet.py's "
            "module docstring for why this has no default."
        )
    return password


def wallet_exists(name: str = "default") -> bool:
    return _wallet_path(name).exists()


def generate_or_load_evm_wallet(name: str = "default") -> LocalAccount:
    """
    Load the persisted EVM keypair for the local identity `name`, or
    generate a fresh secp256k1 keypair and encrypted keystore if none exists
    yet.

    Returns an `eth_account.signers.local.LocalAccount` -- has `.address`
    and `.key` (raw private key bytes) and can sign transactions/messages
    directly, or be handed to `chain.py`'s deploy/registration functions.
    """
    identity.IDENTITY_DIR.mkdir(parents=True, exist_ok=True)
    keystore_path = _wallet_path(name)

    password = _wallet_password()

    if keystore_path.exists():
        keystore_json = json.loads(keystore_path.read_text())
        private_key = Account.decrypt(keystore_json, password)
        return Account.from_key(private_key)

    account: LocalAccount = Account.create()
    keystore_json = Account.encrypt(account.key, password)
    keystore_path.write_text(json.dumps(keystore_json, indent=2) + "\n")
    # Keystore JSON is password-encrypted, but owner-only permissions are
    # still the right default posture -- same reasoning as identity.py's PEM.
    os.chmod(str(keystore_path), stat.S_IRUSR | stat.S_IWUSR)

    return account


def load_evm_address(name: str = "default") -> Optional[str]:
    """
    Read-only address lookup that does NOT require the wallet password --
    the V3 keystore format's top-level `address` field is unencrypted (only
    the private key material inside `crypto` is), so callers that just need
    "does this identity have a wallet, and what's its address" don't need to
    prompt for a password. Returns None if no keystore exists yet.
    """
    keystore_path = _wallet_path(name)
    if not keystore_path.exists():
        return None
    keystore_json = json.loads(keystore_path.read_text())
    raw_address = keystore_json.get("address")
    if not raw_address:
        return None
    return to_checksum_address("0x" + raw_address.removeprefix("0x"))
