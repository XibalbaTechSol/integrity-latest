from __future__ import annotations

import pytest

from integrity_sdk import did


@pytest.fixture(autouse=True)
def _did_env(tmp_path, monkeypatch):
    monkeypatch.setenv("INTEGRITY_DID_HOME", str(tmp_path / "dids"))


def test_load_or_create_did_generates_fresh_identity():
    """Regression test for a real bug: load_or_create_did previously called
    an undefined `_agent_dir` (NameError at runtime, never caught because no
    test exercised this function before)."""
    agent_did, keypair, doc = did.load_or_create_did("agent-a")
    assert agent_did.startswith("did:integrity:")
    assert doc["id"] == agent_did
    assert doc["verificationMethod"][0]["type"] == "Ed25519VerificationKey2020"


def test_load_or_create_did_is_stable_across_reloads():
    did1, _, _ = did.load_or_create_did("agent-a")
    did2, _, _ = did.load_or_create_did("agent-a")
    assert did1 == did2


def test_different_agents_get_different_dids():
    did1, _, _ = did.load_or_create_did("agent-a")
    did2, _, _ = did.load_or_create_did("agent-b")
    assert did1 != did2


def test_attach_evm_account_adds_caip10_verification_method():
    _, _, doc = did.load_or_create_did("agent-a")
    evm_address = "0x1234567890123456789012345678901234567890"
    doc = did.attach_evm_account(doc, evm_address, chain_id=84532)

    evm_methods = [
        vm for vm in doc["verificationMethod"] if vm["type"] == "EcdsaSecp256k1RecoveryMethod2020"
    ]
    assert len(evm_methods) == 1
    assert evm_methods[0]["blockchainAccountId"] == f"eip155:84532:{evm_address}"
    assert evm_methods[0]["controller"] == doc["id"]
    # Original Ed25519 verification method must still be present — attaching
    # the EVM account extends the document, never replaces the DID key.
    assert any(vm["type"] == "Ed25519VerificationKey2020" for vm in doc["verificationMethod"])
