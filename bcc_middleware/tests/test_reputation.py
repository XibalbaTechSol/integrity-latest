"""
Real on-chain tests for app/reputation.py (updateScore / raiseDispute
eth_sendTransaction, stakeOf/lockedStakeOf eth_call), run against a real
local `anvil` instance with the minimal fixture contracts in
tests/fixtures/foundry/src/ actually deployed to it (see the `anvil_chain`
fixture in conftest.py). Same "prove the real chain code path before
contracts/ is targeted directly" convention as test_chain_baa_anchor.py.
"""

from __future__ import annotations

from eth_account import Account

from app.config import Settings
from app.reputation import get_available_stake, push_score, raise_dispute


def _seed_stake(anvil_chain, agent_address: str, amount: int) -> None:
    w3 = anvil_chain["w3"]
    account = Account.from_key(anvil_chain["signer_private_key"])
    contract = w3.eth.contract(address=anvil_chain["slasher_address"], abi=anvil_chain["slasher_abi"])
    tx = contract.functions.seedStake(agent_address, amount).build_transaction(
        {"from": account.address, "nonce": w3.eth.get_transaction_count(account.address), "chainId": anvil_chain["chain_id"]}
    )
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
    assert receipt.status == 1


# --- push_score -----------------------------------------------------------------


def test_push_score_submits_a_real_transaction(anvil_chain):
    settings = Settings(rpc_url=anvil_chain["rpc_url"], anchor_signer_private_key=anvil_chain["signer_private_key"])
    agent_address = Account.create().address

    result = push_score(settings, anvil_chain["reputation_registry_address"], agent_address, 742)

    assert result.submitted, result.detail
    assert result.tx_hash is not None

    w3 = anvil_chain["w3"]
    contract = w3.eth.contract(address=anvil_chain["reputation_registry_address"], abi=anvil_chain["reputation_registry_abi"])
    assert contract.functions.baseScoreOf(agent_address).call() == 742


def test_push_score_uses_dedicated_reputation_signer_when_set(anvil_chain):
    """A distinct REPUTATION_SIGNER_PRIVATE_KEY, when set, takes priority
    over the anchor signer -- the fallback in _signer_key exists for
    today's single-operator testnet, not to make the dedicated key a
    no-op once someone configures it."""
    settings = Settings(
        rpc_url=anvil_chain["rpc_url"],
        anchor_signer_private_key="0x" + "11" * 32,  # deliberately invalid/unfunded, must NOT be used
        reputation_signer_private_key=anvil_chain["signer_private_key"],
    )
    agent_address = Account.create().address

    result = push_score(settings, anvil_chain["reputation_registry_address"], agent_address, 500)

    assert result.submitted, result.detail


def test_push_score_is_best_effort_when_no_signer_configured(anvil_chain):
    settings = Settings(rpc_url=anvil_chain["rpc_url"], anchor_signer_private_key=None, reputation_signer_private_key=None)
    result = push_score(settings, anvil_chain["reputation_registry_address"], Account.create().address, 100)
    assert not result.submitted
    assert "signer" in result.detail


def test_push_score_is_best_effort_when_rpc_unreachable():
    settings = Settings(rpc_url="http://127.0.0.1:1", anchor_signer_private_key="0x" + "22" * 32)
    result = push_score(settings, "0x" + "00" * 20, Account.create().address, 100)
    assert not result.submitted
    assert "unreachable" in result.detail


# --- get_available_stake / raise_dispute -----------------------------------------


def test_get_available_stake_reflects_seeded_minus_locked(anvil_chain):
    settings = Settings(rpc_url=anvil_chain["rpc_url"], anchor_signer_private_key=anvil_chain["signer_private_key"])
    agent_address = Account.create().address
    _seed_stake(anvil_chain, agent_address, 1_000)

    assert get_available_stake(settings, anvil_chain["slasher_address"], agent_address) == 1_000


def test_get_available_stake_returns_none_when_rpc_unreachable():
    settings = Settings(rpc_url="http://127.0.0.1:1")
    assert get_available_stake(settings, "0x" + "00" * 20, Account.create().address) is None


def test_raise_dispute_submits_a_real_transaction_and_locks_stake(anvil_chain):
    settings = Settings(rpc_url=anvil_chain["rpc_url"], anchor_signer_private_key=anvil_chain["signer_private_key"])
    agent_address = Account.create().address
    _seed_stake(anvil_chain, agent_address, 1_000)

    result = raise_dispute(settings, anvil_chain["slasher_address"], agent_address, 100, "oracle-flagged telemetry ratio 6/10 (60%)")

    assert result.submitted, result.detail
    assert result.tx_hash is not None
    # dispute_id is a monotonically increasing counter on the shared,
    # session-scoped fixture contract, not necessarily 0 -- other tests in
    # this session may have raised disputes against it first.
    assert isinstance(result.dispute_id, int) and result.dispute_id >= 0

    assert get_available_stake(settings, anvil_chain["slasher_address"], agent_address) == 900


def test_raise_dispute_reverts_when_amount_exceeds_available_stake(anvil_chain):
    settings = Settings(rpc_url=anvil_chain["rpc_url"], anchor_signer_private_key=anvil_chain["signer_private_key"])
    agent_address = Account.create().address
    _seed_stake(anvil_chain, agent_address, 50)

    result = raise_dispute(settings, anvil_chain["slasher_address"], agent_address, 100, "insufficient stake case")

    assert not result.submitted
    assert "reverted" in result.detail


def test_raise_dispute_is_best_effort_when_no_signer_configured(anvil_chain):
    settings = Settings(rpc_url=anvil_chain["rpc_url"], anchor_signer_private_key=None, reputation_signer_private_key=None)
    result = raise_dispute(settings, anvil_chain["slasher_address"], Account.create().address, 100, "no signer case")
    assert not result.submitted
    assert "signer" in result.detail
