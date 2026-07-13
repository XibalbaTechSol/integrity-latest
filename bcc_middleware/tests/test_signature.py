"""
Tests for app/canonical.py -- real Ed25519 signature verification, no mocks.
"""

import pytest

from app.canonical import SignatureVerificationError, verify_commitment_signature
from tests.helpers import make_commitment_model, new_agent, sign_commitment


def test_valid_signature_verifies():
    agent_id, private_key = new_agent()
    payload = sign_commitment(private_key, agent_id=agent_id, intent_type="payment", nonce=1)
    commitment = make_commitment_model(**payload)
    verify_commitment_signature(commitment)  # must not raise


def test_tampered_field_after_signing_is_rejected():
    agent_id, private_key = new_agent()
    payload = sign_commitment(private_key, agent_id=agent_id, intent_type="payment", nonce=1)
    payload["intent_type"] = "DISPENSE_MEDICATION"  # tampered after signing
    commitment = make_commitment_model(**payload)
    with pytest.raises(SignatureVerificationError):
        verify_commitment_signature(commitment)


def test_signature_from_a_different_key_is_rejected():
    agent_id, _real_key = new_agent()
    _other_id, impostor_key = new_agent()
    # Sign with the impostor's key but claim to be `agent_id`.
    payload = sign_commitment(impostor_key, agent_id=agent_id, intent_type="payment", nonce=1)
    commitment = make_commitment_model(**payload)
    with pytest.raises(SignatureVerificationError):
        verify_commitment_signature(commitment)


def test_malformed_agent_id_fingerprint_is_rejected():
    agent_id, private_key = new_agent()
    payload = sign_commitment(private_key, agent_id=agent_id, intent_type="payment", nonce=1)
    payload["agent_id"] = "did:integrity:deadbeef"  # too short to be a real pubkey
    commitment = make_commitment_model(**payload)
    with pytest.raises(SignatureVerificationError):
        verify_commitment_signature(commitment)
