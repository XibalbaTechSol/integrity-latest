"""
Real end-to-end test of registration.register_agent against the session
anvil chain from conftest.py's `deployed_chain` fixture. Runs with
skip_oracle_registration=True since integrity-oracle's HTTP layer doesn't
exist yet (see docs/INTERFACE_CONTRACT.md §6.6's honest note on that) — this
test proves every ON-CHAIN step of the sequence, which is everything this
package can verify on its own; oracle re-verification gets its own coverage
once integrity-oracle's routes exist.
"""

from __future__ import annotations

import json
import os

import pytest

from integrity_sdk import registration


@pytest.fixture(autouse=True)
def _env(tmp_path, monkeypatch, deployed_chain):
    monkeypatch.setenv("INTEGRITY_DID_HOME", str(tmp_path / "dids"))
    monkeypatch.setenv("INTEGRITY_WALLET_HOME", str(tmp_path / "wallets"))
    monkeypatch.setenv("INTEGRITY_WALLET_PASSWORD", "test-only-password")
    monkeypatch.setenv("RPC_URL", deployed_chain["rpc_url"])
    monkeypatch.setenv("FUNDER_PRIVATE_KEY", deployed_chain["funder"].key.hex())

    # Write a deployments file matching the new nested shape, from the real
    # addresses this session's Deploy.s.sol run actually produced.
    addr = deployed_chain["addresses"]
    deployments = {
        "chainId": deployed_chain["chain_id"],
        "singletons": {
            "AgentPrimitivesFactory": addr["AgentPrimitivesFactory"],
            "IntegrityToken": addr["IntegrityToken"],
            "XibalbaAgentRegistry": addr["XibalbaAgentRegistry"],
        },
        "protocolAddresses": {"oracleSigner": deployed_chain["funder"].address},
    }
    deployments_path = tmp_path / "deployments.local.json"
    deployments_path.write_text(json.dumps(deployments))
    monkeypatch.setenv("DEPLOYMENTS_FILE", str(deployments_path))


def test_register_agent_full_onchain_sequence():
    result = registration.register_agent("registration-test-agent", skip_oracle_registration=True)

    assert result.did.startswith("did:integrity:")
    assert result.evm_address.startswith("0x")
    assert result.oracle_registered is False
    zero = "0x0000000000000000000000000000000000000000"
    for field_value in (
        result.sovereign_agent,
        result.state_anchor,
        result.reputation_registry,
        result.slasher,
        result.verifier_registry,
        result.compliance_gate,
        result.agent_profile,
    ):
        assert field_value.lower() != zero


def test_register_agent_persists_document_and_primitives(tmp_path):
    from integrity_sdk import did

    result = registration.register_agent("persist-test-agent", skip_oracle_registration=True)

    doc_path = did.agent_dir("persist-test-agent") / "document.json"
    primitives_path = did.agent_dir("persist-test-agent") / "primitives.json"
    assert doc_path.exists()
    assert primitives_path.exists()

    doc = json.loads(doc_path.read_text())
    assert doc["id"] == result.did
    evm_methods = [vm for vm in doc["verificationMethod"] if vm["type"] == "EcdsaSecp256k1RecoveryMethod2020"]
    assert len(evm_methods) == 1
    assert result.evm_address in evm_methods[0]["blockchainAccountId"]

    primitives = json.loads(primitives_path.read_text())
    assert primitives["sovereign_agent"] == result.sovereign_agent


def test_register_agent_is_idempotent_for_an_already_registered_did():
    """
    Regression test for PRODUCTION_GAPS.md Sec3: register_agent() used to
    always deploy a FRESH SovereignAgent/StateAnchor pair on every call, so
    calling it twice for the same identity (a real retry-after-partial-failure
    scenario, or simply an idempotent re-run) deployed a second, orphaned pair
    that then reverted AlreadyRegistered() at the final registerPrimitives
    step -- after gas and testnet ITK were already spent on the throwaway
    deploy. The second call must now short-circuit and return the SAME
    on-chain primitives, with no new SovereignAgent deployed.
    """
    first = registration.register_agent("idempotent-test-agent", skip_oracle_registration=True)
    second = registration.register_agent("idempotent-test-agent", skip_oracle_registration=True)

    assert second.sovereign_agent == first.sovereign_agent
    assert second.state_anchor == first.state_anchor
    assert second.reputation_registry == first.reputation_registry
    assert second.slasher == first.slasher
    assert second.verifier_registry == first.verifier_registry
    assert second.compliance_gate == first.compliance_gate
    assert second.agent_profile == first.agent_profile


def test_register_agent_requires_funder_key(monkeypatch):
    monkeypatch.delenv("FUNDER_PRIVATE_KEY", raising=False)
    with pytest.raises(registration.RegistrationError, match="FUNDER_PRIVATE_KEY"):
        registration.register_agent("no-funder-agent", skip_oracle_registration=True)


def test_register_agent_rejects_unknown_vertical():
    with pytest.raises(ValueError, match="compliance_vertical"):
        registration.register_agent("bad-vertical-agent", compliance_vertical="not-a-real-vertical")
