import pytest
import shutil
from unittest.mock import MagicMock
from integrity_sdk.prover import NoirProver, ProverError

def test_verifier_target_validation(monkeypatch):
    monkeypatch.setattr(shutil, "which", lambda x: "/mock/bin/" + x)
    monkeypatch.setattr("integrity_sdk.prover.NoirProver._ensure_compiled", lambda self: None)
    monkeypatch.setattr("integrity_sdk.prover.NoirProver._ensure_vk", lambda self: None)

    # Valid targets
    NoirProver(verifier_target="noir-recursive-no-zk")
    NoirProver(verifier_target="valid_target-123")

    # Invalid targets
    with pytest.raises(ValueError, match="Invalid verifier_target"):
        NoirProver(verifier_target="invalid target")

    with pytest.raises(ValueError, match="Invalid verifier_target"):
        NoirProver(verifier_target="target;rm -rf /")

def test_null_byte_rejection(monkeypatch):
    monkeypatch.setattr(shutil, "which", lambda x: "/mock/bin/" + x)
    monkeypatch.setattr("integrity_sdk.prover.NoirProver._ensure_compiled", lambda self: None)
    monkeypatch.setattr("integrity_sdk.prover.NoirProver._ensure_vk", lambda self: None)

    prover = NoirProver()

    # We expect ValueError when _run receives a null byte
    with pytest.raises(ValueError, match="Arguments must not contain null bytes."):
        prover._run(["echo", "hello\x00world"])
