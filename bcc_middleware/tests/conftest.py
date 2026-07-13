"""
Shared pytest fixtures.

`anvil_chain` spins up a REAL local anvil instance (foundry) and deploys the
two minimal fixture contracts under tests/fixtures/foundry/src/ so
app/baa.py and app/anchor.py's on-chain code paths (eth_call,
eth_sendTransaction) get exercised against a real EVM, not a web3 mock.
This is the proof-before-contracts/-exists that the task calls for: once
`contracts/` lands its real SmartBAA / StateAnchor, only the address in
deployments.local.json changes -- the eth_call/eth_sendTransaction code in
app/baa.py and app/anchor.py doesn't.
"""

from __future__ import annotations

import json
import socket
import subprocess
import time
from pathlib import Path

import pytest
from eth_account import Account
from web3 import Web3

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "foundry"
POLICIES_DIR = Path(__file__).parent.parent / "policies"
ANVIL_DEV_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_for_rpc(url: str, timeout: float = 15.0) -> None:
    w3 = Web3(Web3.HTTPProvider(url))
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if w3.is_connected():
                return
        except Exception:
            pass
        time.sleep(0.2)
    raise RuntimeError(f"anvil at {url} did not become reachable in {timeout}s")


def _build_fixture_contracts() -> None:
    """Compiles the fixture contracts with the REAL `forge` toolchain."""
    result = subprocess.run(
        ["forge", "build"],
        cwd=FIXTURES_DIR,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"forge build failed:\n{result.stdout}\n{result.stderr}")


def _load_artifact(contract_file: str, contract_name: str) -> dict:
    artifact_path = FIXTURES_DIR / "out" / contract_file / f"{contract_name}.json"
    with open(artifact_path) as f:
        return json.load(f)


@pytest.fixture(scope="session")
def anvil_chain():
    """
    Starts a real `anvil` subprocess for the test session, deploys
    MockBAARegistry and MockStateAnchor to it via web3.py using their
    forge-compiled bytecode, and yields connection info + deployed
    addresses. Torn down (anvil killed) at the end of the session.
    """
    _build_fixture_contracts()

    port = _free_port()
    rpc_url = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        ["anvil", "--port", str(port), "--silent"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        _wait_for_rpc(rpc_url)
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        account = Account.from_key(ANVIL_DEV_PRIVATE_KEY)

        def _deploy(contract_file: str, contract_name: str) -> str:
            artifact = _load_artifact(contract_file, contract_name)
            abi = artifact["abi"]
            bytecode = artifact["bytecode"]["object"]
            contract = w3.eth.contract(abi=abi, bytecode=bytecode)
            tx = contract.constructor().build_transaction(
                {
                    "from": account.address,
                    "nonce": w3.eth.get_transaction_count(account.address),
                    "chainId": w3.eth.chain_id,
                }
            )
            signed = account.sign_transaction(tx)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
            assert receipt.status == 1, f"{contract_name} deployment reverted"
            return receipt.contractAddress

        baa_address = _deploy("MockBAARegistry.sol", "MockBAARegistry")
        anchor_address = _deploy("MockStateAnchor.sol", "MockStateAnchor")

        yield {
            "rpc_url": rpc_url,
            "chain_id": w3.eth.chain_id,
            "w3": w3,
            "signer_private_key": ANVIL_DEV_PRIVATE_KEY,
            "baa_address": baa_address,
            "anchor_address": anchor_address,
            "baa_abi": _load_artifact("MockBAARegistry.sol", "MockBAARegistry")["abi"],
        }
    finally:
        proc.terminate()
        proc.wait(timeout=10)


@pytest.fixture(scope="session")
def always_allow_requires_baa_opa_server(tmp_path_factory):
    """
    A second, separate real OPA server loaded with a trivial throwaway
    policy (`allow := true`, `requires_baa := true` unconditionally) rather
    than our real policies/bcc.rego.

    Why this exists: the real bcc.rego's clinical allowlist (see its
    `authorized_clinical_agents`) is keyed on a few fixed demo DID strings
    that aren't real Ed25519 keys, so a run_intercept test using a REAL
    generated signing keypair can never simultaneously (a) pass real
    signature verification and (b) land in bcc.rego's allowlist. This
    fixture isolates "does run_intercept correctly wire OPA's requires_baa
    signal into a real on-chain BAA eth_call" from "is this particular
    agent on the clinical allowlist" -- the latter is already covered by
    the `opa test` suite in policies/bcc_test.rego and
    test_opa_fail_closed.py's real-OPA tests.
    """
    policy_dir = tmp_path_factory.mktemp("trivial_policy")
    (policy_dir / "bcc.rego").write_text(
        "package integrity.bcc\n\n"
        "default allow := true\n"
        "default requires_baa := true\n"
        "violation := []\n"
    )

    port = _free_port()
    url = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        ["opa", "run", "--server", f"--addr=127.0.0.1:{port}", str(policy_dir)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        _wait_for_http_health(f"{url}/health")
        yield url
    finally:
        proc.terminate()
        proc.wait(timeout=10)


def _wait_for_http_health(url: str, timeout: float = 15.0) -> None:
    import httpx

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            resp = httpx.get(url, timeout=1.0)
            if resp.status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(0.2)
    raise RuntimeError(f"{url} did not become healthy in {timeout}s")


@pytest.fixture(scope="session")
def real_opa_server():
    """
    Starts a REAL `opa run --server` process loaded with this package's
    actual policies/*.rego, so tests exercise the genuine OPA REST API
    (POST /v1/data/integrity/bcc) rather than a mocked response. Used both
    for "policy really allows/denies as expected" tests and as the *known
    good* counterpart to the deliberately-unreachable-OPA fail-closed test.
    """
    port = _free_port()
    url = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        ["opa", "run", "--server", f"--addr=127.0.0.1:{port}", str(POLICIES_DIR)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        _wait_for_http_health(f"{url}/health")
        yield url
    finally:
        proc.terminate()
        proc.wait(timeout=10)
