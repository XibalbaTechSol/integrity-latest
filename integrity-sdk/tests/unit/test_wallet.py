from __future__ import annotations

import pytest

from integrity_sdk import wallet


@pytest.fixture(autouse=True)
def _wallet_env(tmp_path, monkeypatch):
    monkeypatch.setenv("INTEGRITY_WALLET_HOME", str(tmp_path / "wallets"))
    monkeypatch.setenv("INTEGRITY_WALLET_PASSWORD", "test-only-password")


def test_generate_creates_and_persists_keystore():
    account = wallet.generate_or_load_evm_wallet("agent-a")
    assert account.address.startswith("0x")
    assert len(account.address) == 42


def test_reload_returns_same_address():
    account1 = wallet.generate_or_load_evm_wallet("agent-a")
    account2 = wallet.generate_or_load_evm_wallet("agent-a")
    assert account1.address == account2.address


def test_different_agents_get_different_wallets():
    account1 = wallet.generate_or_load_evm_wallet("agent-a")
    account2 = wallet.generate_or_load_evm_wallet("agent-b")
    assert account1.address != account2.address


def test_missing_password_raises(monkeypatch):
    monkeypatch.delenv("INTEGRITY_WALLET_PASSWORD", raising=False)
    with pytest.raises(wallet.WalletPasswordNotSet):
        wallet.generate_or_load_evm_wallet("agent-a")


def test_wrong_password_fails_to_decrypt():
    # Regression test for PRODUCTION_GAPS.md Sec3: this used to raise a raw
    # ValueError (eth_account's generic "MAC mismatch"), which this same
    # test used to assert on directly -- codifying the untyped behavior as
    # correct rather than flagging it. Now a typed, keystore-specific error.
    wallet.generate_or_load_evm_wallet("agent-a")
    import os

    os.environ["INTEGRITY_WALLET_PASSWORD"] = "a-different-password"
    with pytest.raises(wallet.WalletDecryptionError):
        wallet.generate_or_load_evm_wallet("agent-a")


def test_corrupted_keystore_raises_typed_error():
    wallet.generate_or_load_evm_wallet("agent-a")
    keystore_path = wallet.wallet_dir("agent-a") / "keystore.json"
    keystore_path.write_text("{not valid json")

    with pytest.raises(wallet.CorruptedKeystoreError):
        wallet.generate_or_load_evm_wallet("agent-a")


def test_load_evm_address_raises_typed_error_on_corrupted_keystore():
    wallet.generate_or_load_evm_wallet("agent-a")
    keystore_path = wallet.wallet_dir("agent-a") / "keystore.json"
    keystore_path.write_text("{not valid json")

    with pytest.raises(wallet.CorruptedKeystoreError):
        wallet.load_evm_address("agent-a")


def test_concurrent_bootstrap_converges_on_one_keypair(monkeypatch):
    """
    Regression test for PRODUCTION_GAPS.md Sec3: simulates two callers
    racing to bootstrap the SAME agent_id's wallet, both passing the
    `.exists()`-is-False check before either has written anything. The old
    check-then-act code let both generate different keypairs and silently
    let whichever wrote last win, stranding the other's in-memory account.
    The fix's os.link-based claim must make both callers agree on ONE
    keypair regardless of scheduling order.
    """
    import os as _os

    real_open = _os.open
    calls = {"count": 0}

    def racing_open(path, flags, mode=0o777):
        # On the FIRST temp-file creation only, let a second "concurrent"
        # caller fully complete its own bootstrap first -- simulating a
        # context switch right after this caller generated its keypair but
        # before it claimed the final path.
        calls["count"] += 1
        if calls["count"] == 1 and ".tmp." in str(path):
            wallet.generate_or_load_evm_wallet("agent-race")
        return real_open(path, flags, mode)

    monkeypatch.setattr(_os, "open", racing_open)

    account = wallet.generate_or_load_evm_wallet("agent-race")
    reloaded = wallet.generate_or_load_evm_wallet("agent-race")

    assert account.address == reloaded.address
    keystore_path = wallet.wallet_dir("agent-race") / "keystore.json"
    assert keystore_path.exists()
    # No leftover temp files from either "concurrent" attempt.
    leftovers = [p for p in keystore_path.parent.iterdir() if ".tmp." in p.name]
    assert leftovers == []


def test_load_evm_address_does_not_require_password(monkeypatch):
    account = wallet.generate_or_load_evm_wallet("agent-a")
    monkeypatch.delenv("INTEGRITY_WALLET_PASSWORD", raising=False)
    assert wallet.load_evm_address("agent-a") == account.address


def test_load_evm_address_none_when_no_wallet():
    assert wallet.load_evm_address("never-created") is None


def test_keystore_file_is_owner_only_permissions():
    import stat

    wallet.generate_or_load_evm_wallet("agent-a")
    keystore_path = wallet.wallet_dir("agent-a") / "keystore.json"
    mode = keystore_path.stat().st_mode
    assert stat.S_IMODE(mode) == (stat.S_IRUSR | stat.S_IWUSR)
