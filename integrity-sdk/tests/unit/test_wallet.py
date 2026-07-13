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
    wallet.generate_or_load_evm_wallet("agent-a")
    import os

    os.environ["INTEGRITY_WALLET_PASSWORD"] = "a-different-password"
    with pytest.raises(ValueError):
        wallet.generate_or_load_evm_wallet("agent-a")


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
