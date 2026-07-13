//! Ed25519 signature verification for DID-based agent authentication (§4.1/§4.2).
//! This is the primary signing scheme for the protocol: the DID document
//! (`did:integrity:<fingerprint>`) commits to an Ed25519 public key, and BCC
//! commitments / telemetry submissions are signed with the corresponding private
//! key over canonical JSON.
//!
//! No bypass path exists here (unlike the old prototype's `verify_agent_signature`,
//! which skipped verification for any `agent_id` starting with `"agent_"`) — a bad
//! or missing signature always returns `Ok(false)` or an `Err`, never silent success.

use ed25519_dalek::{Signature, Verifier, VerifyingKey};

#[derive(Debug, thiserror::Error)]
pub enum Ed25519Error {
    #[error("public key must be 32 bytes, got {0}")]
    BadPublicKeyLength(usize),
    #[error("signature must be 64 bytes, got {0}")]
    BadSignatureLength(usize),
    #[error("malformed public key: {0}")]
    MalformedPublicKey(String),
    #[error("invalid hex: {0}")]
    Hex(#[from] hex::FromHexError),
    #[error("invalid multibase public key: {0}")]
    MalformedMultibase(String),
}

fn strip_0x(s: &str) -> &str {
    s.strip_prefix("0x").unwrap_or(s)
}

/// Verifies `signature_hex` (0x-hex, 64 bytes) is a valid Ed25519 signature over
/// `message` by the holder of `public_key_hex` (0x-hex, 32 bytes). A well-formed
/// but non-matching signature returns `Ok(false)`; malformed input is an `Err`.
pub fn verify_ed25519_signature(
    message: &[u8],
    signature_hex: &str,
    public_key_hex: &str,
) -> Result<bool, Ed25519Error> {
    let pk_bytes = hex::decode(strip_0x(public_key_hex))?;
    let pk_arr: [u8; 32] = pk_bytes
        .clone()
        .try_into()
        .map_err(|_| Ed25519Error::BadPublicKeyLength(pk_bytes.len()))?;
    let vk = VerifyingKey::from_bytes(&pk_arr).map_err(|e| Ed25519Error::MalformedPublicKey(e.to_string()))?;

    let sig_bytes = hex::decode(strip_0x(signature_hex))?;
    let sig_arr: [u8; 64] = sig_bytes
        .clone()
        .try_into()
        .map_err(|_| Ed25519Error::BadSignatureLength(sig_bytes.len()))?;
    let sig = Signature::from_bytes(&sig_arr);

    Ok(vk.verify(message, &sig).is_ok())
}

/// Decodes a DID document `publicKeyMultibase` value (§4.1) into raw 32-byte
/// Ed25519 public key bytes.
///
/// Per the `Ed25519VerificationKey2020` spec this is base58btc (multibase prefix
/// `'z'`) over a multicodec-prefixed key: `0xed 0x01` followed by the 32 raw key
/// bytes (34 bytes total decoded). Some producers omit the multicodec prefix and
/// just base58-encode the raw 32 bytes directly; this function accepts both
/// shapes rather than hard-failing on the one the actual `integrity-sdk` turns
/// out to emit, since that package is being built in parallel and its exact
/// encoding choice isn't nailed down yet.
pub fn decode_multibase_ed25519_pubkey(multibase: &str) -> Result<[u8; 32], Ed25519Error> {
    let encoded = multibase
        .strip_prefix('z')
        .ok_or_else(|| Ed25519Error::MalformedMultibase("expected base58btc multibase prefix 'z'".into()))?;
    let decoded = bs58::decode(encoded)
        .into_vec()
        .map_err(|e| Ed25519Error::MalformedMultibase(e.to_string()))?;

    match decoded.len() {
        32 => Ok(decoded.try_into().unwrap()),
        34 if decoded[0] == 0xed && decoded[1] == 0x01 => Ok(decoded[2..].try_into().unwrap()),
        other => Err(Ed25519Error::MalformedMultibase(format!(
            "expected 32 raw bytes or 34 bytes with 0xed01 multicodec prefix, got {other} bytes"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Independently generated with Python's `cryptography` library (NOT this
    // Rust code) via:
    //   priv = Ed25519PrivateKey.generate()
    //   sig = priv.sign(b"hello integrity oracle ed25519")
    // so this test actually exercises interop with a real, independent Ed25519
    // implementation rather than just round-tripping through ed25519-dalek.
    const MESSAGE: &[u8] = b"hello integrity oracle ed25519";
    const PUBKEY_HEX: &str = "7cc65a69212551a29579bc4787161dba269d2f43e8cdef931495192c4db72879";
    const SIGNATURE_HEX: &str = "f4a42c385a80908b51666d94b1926e8382a5ff24046539a1116315d566885909c730255bf369bde134dc27a71967ec5ca738b2066c82e89bbe27a01ce476af03";

    #[test]
    fn verifies_a_signature_produced_by_pythons_cryptography_library() {
        assert!(verify_ed25519_signature(MESSAGE, SIGNATURE_HEX, PUBKEY_HEX).unwrap());
    }

    #[test]
    fn rejects_tampered_message() {
        assert!(!verify_ed25519_signature(b"tampered", SIGNATURE_HEX, PUBKEY_HEX).unwrap());
    }

    #[test]
    fn rejects_wrong_public_key() {
        let (_, wrong_vk) = {
            use ed25519_dalek::SigningKey;
            let sk = SigningKey::from_bytes(&[7u8; 32]);
            (sk.clone(), sk.verifying_key())
        };
        let wrong_hex = hex::encode(wrong_vk.to_bytes());
        assert!(!verify_ed25519_signature(MESSAGE, SIGNATURE_HEX, &wrong_hex).unwrap());
    }

    #[test]
    fn malformed_signature_length_is_an_error() {
        let err = verify_ed25519_signature(MESSAGE, "0xdead", PUBKEY_HEX);
        assert!(matches!(err, Err(Ed25519Error::BadSignatureLength(_))));
    }

    #[test]
    fn decodes_multibase_without_multicodec_prefix() {
        let pk_bytes = hex::decode(PUBKEY_HEX).unwrap();
        let encoded = format!("z{}", bs58::encode(&pk_bytes).into_string());
        let decoded = decode_multibase_ed25519_pubkey(&encoded).unwrap();
        assert_eq!(hex::encode(decoded), PUBKEY_HEX);
    }

    #[test]
    fn decodes_multibase_with_ed01_multicodec_prefix() {
        let pk_bytes = hex::decode(PUBKEY_HEX).unwrap();
        let mut prefixed = vec![0xed, 0x01];
        prefixed.extend_from_slice(&pk_bytes);
        let encoded = format!("z{}", bs58::encode(&prefixed).into_string());
        let decoded = decode_multibase_ed25519_pubkey(&encoded).unwrap();
        assert_eq!(hex::encode(decoded), PUBKEY_HEX);
    }

    #[test]
    fn rejects_missing_z_prefix() {
        assert!(decode_multibase_ed25519_pubkey("abcdef").is_err());
    }
}
