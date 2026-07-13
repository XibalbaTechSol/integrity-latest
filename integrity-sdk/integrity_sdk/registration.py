"""
Top-level self-sovereign agent registration: the full dependency-ordered
sequence described in docs/INTERFACE_CONTRACT.md's "Agent Primitives"
section, from a bare DID all the way to a fully-registered 7-primitive
on-chain identity.

Sequence (each step hard-depends on the previous one succeeding on-chain):
  1. Load or create the agent's Ed25519 DID (did.py).
  2. Load or create the agent's EVM wallet (wallet.py) — a separate keypair.
  3. Attach the EVM wallet as a CAIP-10 verification method on the DID doc.
  4. Fund the EVM wallet with ETH from the protocol's funder wallet (ETH
     pays gas for the wallet's own transactions, including every
     SovereignAgent.execute() call in later steps and in markets.py).
  5. The agent's own wallet directly deploys SovereignAgent.
  6. The agent's own wallet directly deploys StateAnchor.
  7. Mint a testnet ITK allocation to the SovereignAgent CONTRACT (not the
     wallet — testnet convenience, not a core protocol invariant, but the
     mint TARGET is load-bearing: see chain.mint_testnet_itk and this
     module's step-7 comment for why it must be the contract).
  8. Grant the protocol's oracle signer ANCHOR_ROLE on that StateAnchor,
     routed through SovereignAgent.execute.
  9. Call AgentPrimitivesFactory.registerPrimitives to clone+register the
     remaining 5 primitives.
  10. Persist every address next to the DID's document.json.
  11. POST to the oracle's /v1/agent/register, which independently
      re-verifies the claimed primitives against on-chain state before
      accepting the registration (see integrity-oracle's routes.rs) — this
      is what makes registration "real" from the protocol's point of view,
      not just from this SDK's.

This module deliberately does not swallow any step's failure — a partially
completed registration (e.g. SovereignAgent deployed but registerPrimitives
never called) is a real, visible error state, not something to paper over
with a retry-forever loop or a silently-incomplete return value.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, asdict
from typing import Optional

import requests
from web3 import Web3

from . import chain, did, wallet

logger = logging.getLogger("integrity_sdk.registration")

# ComplianceGate.Vertical enum values (contracts/src/shield/ComplianceGate.sol).
# One vertical per agent -- ComplianceGate stores a single `Vertical public
# vertical` field, not a list, so "multi-vertical" in the broader MVP sense
# means many DIFFERENT agents each declaring a different vertical (a
# healthcare agent, a trading agent, a market-maker agent), not one agent
# declaring several. This is a self-declared badge for dashboard/discovery
# purposes (mirrors the self-declared compliance flags below Healthcare in
# the enum) -- it does NOT gate participation in IntegrityMarket/
# A2ACapitalPool, which only ever check live AIS (see markets.py); an agent
# can enter a market or receive a capital allocation regardless of which
# vertical (if any) it declared here.
_VERTICALS = {
    "none": 0,
    "healthcare": 1,
    "prediction_market": 2,
    "trading": 3,
    "capital_allocation": 4,
}

_DEFAULT_AGENT_FUND_WEI = Web3.to_wei(0.01, "ether")
_DEFAULT_TESTNET_ITK_ALLOCATION_WEI = Web3.to_wei(10_000, "ether")


class RegistrationError(RuntimeError):
    """Raised when any step of the registration sequence fails. The
    exception message always identifies which step failed — a partially
    completed registration must never look like a generic failure the
    caller has to dig through logs to diagnose."""


@dataclass
class AgentRegistration:
    did: str
    evm_address: str
    sovereign_agent: str
    state_anchor: str
    reputation_registry: str
    slasher: str
    verifier_registry: str
    compliance_gate: str
    agent_profile: str
    domain_id: str
    oracle_registered: bool

    def to_dict(self) -> dict:
        return asdict(self)


def register_agent(
    agent_id: Optional[str] = None,
    *,
    domain_name: str = "general.integrity",
    compliance_vertical: str = "none",
    profile_uri: str = "",
    rpc_url: Optional[str] = None,
    deployments_file: Optional[str] = None,
    oracle_url: Optional[str] = None,
    fund_amount_wei: int = _DEFAULT_AGENT_FUND_WEI,
    testnet_itk_allocation_wei: int = _DEFAULT_TESTNET_ITK_ALLOCATION_WEI,
    skip_oracle_registration: bool = False,
) -> AgentRegistration:
    """
    Runs the full self-sovereign registration sequence for `agent_id`
    (defaults to the DID home's "default" slot — see did.py/wallet.py).

    `rpc_url`/`deployments_file`/`oracle_url` default to the same
    cross-package env vars every other component reads (see
    docs/INTERFACE_CONTRACT.md §3: RPC_URL, DEPLOYMENTS_FILE, ORACLE_URL).

    `skip_oracle_registration=True` runs only the on-chain portion (steps
    1-10) without the final oracle POST — useful for testing/CLI flows
    against a chain that has no oracle running yet. The default is False:
    a "real" registration per the interface contract includes the oracle's
    independent on-chain re-verification.
    """
    rpc_url = rpc_url or os.getenv("RPC_URL", "http://localhost:8545")
    deployments_file = deployments_file or os.getenv("DEPLOYMENTS_FILE", "../deployments.local.json")
    oracle_url = oracle_url or os.getenv("ORACLE_URL", "http://localhost:8080")

    if compliance_vertical not in _VERTICALS:
        raise ValueError(f"compliance_vertical must be one of {sorted(_VERTICALS)}, got {compliance_vertical!r}")

    w3 = chain.get_w3(rpc_url)
    if not w3.is_connected():
        raise RegistrationError(f"RPC {rpc_url} is unreachable — cannot register an agent")
    chain_id = w3.eth.chain_id

    deployments = chain.load_deployments(deployments_file)
    factory_address = deployments["singletons"]["AgentPrimitivesFactory"]
    itk_address = deployments["singletons"]["IntegrityToken"]
    oracle_signer = deployments["protocolAddresses"]["oracleSigner"]
    funder_key = os.getenv("FUNDER_PRIVATE_KEY")
    if not funder_key:
        raise RegistrationError("FUNDER_PRIVATE_KEY is not set — required to fund the agent's new wallet")

    from eth_account import Account
    from eth_utils import keccak

    funder = Account.from_key(funder_key)

    # Steps 1-3: DID + EVM wallet + CAIP-10 binding.
    agent_did, keypair, doc = did.load_or_create_did(agent_id)
    evm_account = wallet.generate_or_load_evm_wallet(agent_id)
    doc = did.attach_evm_account(doc, evm_account.address, chain_id)

    # Step 4: fund. ETH goes to the WALLET (not the SovereignAgent contract) --
    # the wallet is what pays gas for every transaction the agent signs,
    # including the SovereignAgent.execute() calls that route state changes
    # through its own contract (see step 5's comment for why ITK, unlike
    # ETH, goes to the contract instead).
    try:
        chain.fund_agent_wallet(w3, funder, evm_account.address, fund_amount_wei, chain_id)
    except Exception as exc:  # noqa: BLE001 — re-raised with step context below
        raise RegistrationError(f"step 4 (fund_agent_wallet) failed: {exc}") from exc

    # Steps 5-6: direct deploys. Moved ahead of the testnet ITK mint (which
    # used to be step 5, minting to the wallet) because ITK collateral must
    # live on the SovereignAgent CONTRACT, not the wallet -- see the mint
    # step's comment below for why, and IntegrityMarket.sol/A2ACapitalPool.sol
    # for the downstream contracts that require it.
    try:
        sovereign_agent = chain.deploy_sovereign_agent(w3, evm_account, agent_did, oracle_signer, chain_id)
        state_anchor = chain.deploy_state_anchor(w3, evm_account, sovereign_agent, chain_id)
    except Exception as exc:  # noqa: BLE001
        raise RegistrationError(f"step 5/6 (direct primitive deploy) failed: {exc}") from exc

    # Step 7: testnet ITK allocation, minted to the SovereignAgent CONTRACT
    # address (not the wallet). Every AIS-gated application contract
    # (IntegrityMarket.enterPosition, A2ACapitalPool via markets.py) checks
    # `agentRegistry.isRegisteredAgent(msg.sender)` -- which only resolves
    # for the SovereignAgent contract address, never the raw controller
    # wallet (see XibalbaAgentRegistry.sol: `didHashOf` is keyed on
    # `primitives.sovereignAgent`). Since those same calls also pull ITK
    # FROM msg.sender, the collateral has to already be sitting on that same
    # contract, or every real market/allocation transaction markets.py
    # submits (via SovereignAgent.execute, see markets.py) would revert with
    # an ERC20 insufficient-balance error despite the agent's wallet holding
    # plenty of ITK it can never spend through that call path.
    if testnet_itk_allocation_wei > 0:
        try:
            chain.mint_testnet_itk(w3, funder, itk_address, sovereign_agent, testnet_itk_allocation_wei, chain_id)
        except Exception as exc:  # noqa: BLE001
            raise RegistrationError(f"step 7 (mint_testnet_itk) failed: {exc}") from exc

    # Step 8: route the ANCHOR_ROLE grant through the agent's own contract.
    try:
        chain.grant_anchor_role(w3, evm_account, sovereign_agent, state_anchor, oracle_signer, chain_id)
    except Exception as exc:  # noqa: BLE001
        raise RegistrationError(
            f"step 8 (grant_anchor_role) failed — SovereignAgent {sovereign_agent} and "
            f"StateAnchor {state_anchor} were deployed but are not fully wired: {exc}"
        ) from exc

    # Step 9: clone + register the remaining 5.
    domain_id = keccak(text=domain_name)
    try:
        result = chain.register_primitives(
            w3,
            evm_account,
            factory_address,
            sovereign_agent,
            state_anchor,
            agent_did,
            domain_id,
            _VERTICALS[compliance_vertical],
            profile_uri,
            chain_id,
        )
    except Exception as exc:  # noqa: BLE001
        raise RegistrationError(
            f"step 9 (register_primitives) failed — SovereignAgent {sovereign_agent} and "
            f"StateAnchor {state_anchor} exist on-chain but are not registered in "
            f"XibalbaAgentRegistry: {exc}"
        ) from exc

    registration = AgentRegistration(
        did=agent_did,
        evm_address=evm_account.address,
        sovereign_agent=result.sovereign_agent,
        state_anchor=result.state_anchor,
        reputation_registry=result.reputation_registry,
        slasher=result.slasher,
        verifier_registry=result.verifier_registry,
        compliance_gate=result.compliance_gate,
        agent_profile=result.agent_profile,
        domain_id=result.domain_id,
        oracle_registered=False,
    )

    # Step 10: persist.
    doc_path = did.agent_dir(agent_id) / "document.json"
    doc_path.write_text(json.dumps(doc, indent=2) + "\n")
    primitives_path = did.agent_dir(agent_id) / "primitives.json"
    primitives_path.write_text(json.dumps(registration.to_dict(), indent=2) + "\n")

    # Step 11: oracle independent re-verification. Payload shape is pinned by
    # integrity-oracle's real `RegisterAgentRequest` struct (handlers.rs) --
    # see docs/INTERFACE_CONTRACT.md §6.3 for the documented schema. Three
    # things this used to get wrong (found 2026-07-09 via a real 422/400
    # against a live oracle, not a guess):
    #   1. The DID field is named `did`, not `agent_id` -- sending `agent_id`
    #      left the struct's required `did` field missing, which serde
    #      rejects at the JSON-body-extraction layer (422) before the
    #      handler even runs.
    #   2. `primitives` must be exactly the 7-address PrimitiveSetDto shape --
    #      built explicitly here rather than reusing `registration.to_dict()`
    #      (which also carries `did`/`evm_address`/`domain_id`/
    #      `oracle_registered`, fields PrimitiveSetDto doesn't have).
    #   3. The handler requires at least one of `ed25519_pubkey_hex` /
    #      `eth_address_hex` (400 if both are absent) so it has real
    #      verification material to store against the DID -- both are sent
    #      here since this SDK always has both by this point in the sequence.
    if not skip_oracle_registration:
        try:
            resp = requests.post(
                f"{oracle_url}/v1/agent/register",
                json={
                    "did": agent_did,
                    "did_document": doc,
                    "primitives": {
                        "sovereign_agent": registration.sovereign_agent,
                        "state_anchor": registration.state_anchor,
                        "reputation_registry": registration.reputation_registry,
                        "slasher": registration.slasher,
                        "verifier_registry": registration.verifier_registry,
                        "compliance_gate": registration.compliance_gate,
                        "agent_profile": registration.agent_profile,
                    },
                    "ed25519_pubkey_hex": "0x" + keypair.public_bytes().hex(),
                    "eth_address_hex": evm_account.address,
                },
                timeout=10,
            )
            resp.raise_for_status()
            registration.oracle_registered = True
        except requests.RequestException as exc:
            # Deliberately re-raised, not swallowed: per the interface contract,
            # an agent isn't "really" registered from the protocol's point of
            # view until the oracle has independently re-verified it on-chain.
            # A caller that genuinely wants the on-chain-only state (e.g. to
            # register the oracle service itself, which can't call its own
            # not-yet-running API) should pass skip_oracle_registration=True
            # explicitly rather than have this fail silently.
            raise RegistrationError(
                f"step 11 (oracle registration) failed — the agent's 7 primitives are "
                f"fully deployed and registered on-chain at {registration.sovereign_agent}, "
                f"but the oracle at {oracle_url} did not accept the registration: {exc}"
            ) from exc

    logger.info("registered agent %s (SovereignAgent %s)", agent_did, registration.sovereign_agent)
    return registration
