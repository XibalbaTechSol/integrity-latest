//! EIP-191 ("personal_sign") signature verification via secp256k1 public key
//! recovery. Used when an agent authenticates with an Ethereum address instead
//! of (or in addition to) an Ed25519 DID key — e.g. an agent whose on-chain
//! identity (`SovereignAgent`/`AgentFactory` in `contracts/`) is the source of
//! truth for its address.
//!
//! There is deliberately no fallback path here: if recovery fails or the
//! recovered address doesn't match, verification returns `Ok(false)` (a normal,
//! expected outcome for a bad signature) or `Err` (malformed input) — never a
//! bypass. This directly replaces the old prototype's
//! `verify_agent_signature` bug, which skipped verification entirely whenever
//! `agent_id.starts_with("agent_")`.

use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};
use sha3::{Digest, Keccak256};

/// The EIP-191 "personal_sign" prefix. Prefixing prevents a signature over a
/// plain message from being replayable as a signature over, say, a raw
/// transaction — it's a domain separator between "this is a human/agent-readable
/// message" and other things secp256k1 signatures get used for on Ethereum.
fn eth_signed_message_hash(message: &[u8]) -> [u8; 32] {
    let prefix = format!("\x19Ethereum Signed Message:\n{}", message.len());
    let mut hasher = Keccak256::new();
    hasher.update(prefix.as_bytes());
    hasher.update(message);
    hasher.finalize().into()
}

/// Ethereum address = the low 20 bytes of keccak256(uncompressed pubkey minus the
/// leading 0x04 tag byte). Not a generic hash-of-pubkey scheme — this exact
/// derivation is what every Ethereum client uses, so getting the tag-byte
/// stripping wrong would silently recover a "valid-looking" but wrong address.
fn eth_address_from_verifying_key(vk: &VerifyingKey) -> [u8; 20] {
    let encoded = vk.to_encoded_point(false);
    let uncompressed = encoded.as_bytes(); // [0x04, X (32 bytes), Y (32 bytes)]
    let hash = Keccak256::digest(&uncompressed[1..]);
    let mut addr = [0u8; 20];
    addr.copy_from_slice(&hash[12..]);
    addr
}

#[derive(Debug, thiserror::Error)]
pub enum Eip191Error {
    #[error("signature must be 65 bytes (r || s || v), got {0}")]
    BadSignatureLength(usize),
    #[error("invalid recovery id byte {0:x}")]
    BadRecoveryId(u8),
    #[error("malformed signature bytes: {0}")]
    MalformedSignature(String),
    #[error("public key recovery failed: {0}")]
    RecoveryFailed(String),
    #[error("expected address must be 20 bytes, got {0}")]
    BadAddressLength(usize),
    #[error("invalid hex: {0}")]
    Hex(#[from] hex::FromHexError),
}

fn strip_0x(s: &str) -> &str {
    s.strip_prefix("0x").unwrap_or(s)
}

/// Recovers the signer's Ethereum address from an EIP-191 signature over `message`.
/// `signature_hex` is the standard 65-byte `r || s || v` encoding (v in {27,28} or
/// {0,1} — both are accepted since different signing libraries disagree here).
pub fn recover_eth_address(message: &[u8], signature_hex: &str) -> Result<[u8; 20], Eip191Error> {
    let sig_bytes = hex::decode(strip_0x(signature_hex))?;
    if sig_bytes.len() != 65 {
        return Err(Eip191Error::BadSignatureLength(sig_bytes.len()));
    }
    let (rs, v_slice) = sig_bytes.split_at(64);
    let mut v = v_slice[0];
    if v >= 27 {
        v -= 27;
    }
    let recid = RecoveryId::from_byte(v).ok_or(Eip191Error::BadRecoveryId(v))?;
    let sig = Signature::from_slice(rs).map_err(|e| Eip191Error::MalformedSignature(e.to_string()))?;

    let hash = eth_signed_message_hash(message);
    let vk = VerifyingKey::recover_from_prehash(&hash, &sig, recid)
        .map_err(|e| Eip191Error::RecoveryFailed(e.to_string()))?;
    Ok(eth_address_from_verifying_key(&vk))
}

/// Verifies that `signature_hex` is a valid EIP-191 signature over `message` by
/// `expected_address_hex`. Returns `Ok(false)` (not an error) for a well-formed
/// signature that simply doesn't match — that's the normal "bad signature"
/// outcome, distinct from a malformed-input error.
pub fn verify_eip191_signature(
    message: &[u8],
    signature_hex: &str,
    expected_address_hex: &str,
) -> Result<bool, Eip191Error> {
    let expected = hex::decode(strip_0x(expected_address_hex))?;
    if expected.len() != 20 {
        return Err(Eip191Error::BadAddressLength(expected.len()));
    }
    let recovered = recover_eth_address(message, signature_hex)?;
    Ok(recovered.as_slice() == expected.as_slice())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Independently generated with Foundry's `cast`, NOT by this code:
    //   cast wallet new
    //     -> Address:     0x5f9F8420Fc91E604e68c47C36DB92Cbd34B7C552
    //     -> Private key: 0x61983844176f3f3cfea0458337dd2e9863290a06d6911fe3ef35c3a4bd14072c
    //   cast wallet sign --private-key <pk> "hello integrity oracle"
    //     -> 0x34a7bcdd9db950b8627a776dc689aff8620e4b749999004421ed2454779d48f...1c
        // (cast also independently confirmed via `cast wallet verify`)
    const MESSAGE: &[u8] = b"hello integrity oracle";
    const SIGNATURE: &str = "0x34a7bcdd9db950b8627a776dc689aff8620e4b749999004421ed2454779d48fa26448a700568bedcb82ffa65536e9b7cd8f748525a8e89777811638cd634f0821c";
    const ADDRESS: &str = "0x5f9F8420Fc91E604e68c47C36DB92Cbd34B7C552";

    #[test]
    fn recovers_the_correct_address_for_a_cast_generated_signature() {
        let recovered = recover_eth_address(MESSAGE, SIGNATURE).unwrap();
        let expected = hex::decode(strip_0x(ADDRESS)).unwrap();
        assert_eq!(recovered.as_slice(), expected.as_slice());
    }

    #[test]
    fn verify_eip191_signature_accepts_the_real_vector() {
        assert!(verify_eip191_signature(MESSAGE, SIGNATURE, ADDRESS).unwrap());
    }

    #[test]
    fn verify_eip191_signature_rejects_wrong_address() {
        // Must be a full 20-byte (40-hex-char) address — a shorter string errors on
        // length before the signature check even runs, which isn't what this test means
        // to exercise (it's testing "valid address, wrong signer", not "malformed input").
        let wrong_address = "0x000000000000000000000000000000000000dEaD";
        assert!(!verify_eip191_signature(MESSAGE, SIGNATURE, wrong_address).unwrap());
    }

    #[test]
    fn verify_eip191_signature_rejects_tampered_message() {
        assert!(!verify_eip191_signature(b"a different message", SIGNATURE, ADDRESS).unwrap());
    }

    #[test]
    fn malformed_signature_is_an_error_not_a_silent_false() {
        let err = verify_eip191_signature(MESSAGE, "0xdead", ADDRESS);
        assert!(matches!(err, Err(Eip191Error::BadSignatureLength(_))));
    }
}
