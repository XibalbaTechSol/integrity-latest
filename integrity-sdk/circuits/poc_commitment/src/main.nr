// poc_commitment — a small, REAL Noir circuit used to exercise integrity-sdk's
// `prover.py` end-to-end against the actual nargo/bb toolchain, ahead of
// `integrity-zkp` publishing the real attestation circuit this SDK will
// eventually point at instead (see integrity-sdk/README.md, "ZK proving").
//
// What it proves: "I know a private field `secret` that, combined with the
// publicly-known `intent_hash` (the BCC commitment's `intended_state_hash`,
// packed into a single field — see prover.py's `_pack_hash_to_field`), hashes
// to the publicly-revealed `secret_commitment` output." This has the same
// *shape* as the real circuit described in the interface contract
// (§5: "I know a private Ed25519-derived secret and an intent payload whose
// hash equals the public intended_state_hash") — a private witness bound to
// a public commitment — without trying to replicate sha256-inside-a-circuit
// or the full Ed25519 key-derivation logic, which belongs to the real
// integrity-zkp circuit once that package lands.
//
// Hash function choice (flagged for integration reconciliation): the BCC
// commitment's `intended_state_hash` is fixed by the interface contract
// (§4.2) to be SHA-256, computed outside the circuit in prover.py. Inside
// the circuit, binding the secret to that hash is done with Noir's
// `pedersen_hash` — a SNARK-friendly hash, chosen because sha256 is very
// constraint-expensive inside a circuit and because Pedersen/Poseidon are
// the conventional choice for in-circuit commitments. integrity-zkp may
// choose Poseidon instead; whichever it picks, this stand-in must be
// updated to match before wiring integrity-sdk to the real circuit.
use std::hash::pedersen_hash;

fn main(secret: Field, intent_hash: pub Field) -> pub Field {
    // A real constraint (not `assert(true)`): the prover must know a
    // `secret` such that this specific pedersen_hash matches the value
    // bb's public output will be checked against by the verifier. Noir/ACIR
    // encodes the return value as an additional public witness, so `bb verify`
    // checks it exactly like any other public input.
    pedersen_hash([secret, intent_hash])
}

#[test]
fn test_commitment_hash_is_deterministic() {
    let out1 = main(123, 456);
    let out2 = main(123, 456);
    assert(out1 == out2);
}

#[test]
fn test_different_secrets_produce_different_commitments() {
    let out1 = main(123, 456);
    let out2 = main(124, 456);
    assert(out1 != out2);
}
