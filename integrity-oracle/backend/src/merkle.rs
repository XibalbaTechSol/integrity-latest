//! Merkle tree over agent telemetry, using the exact hashing convention pinned by
//! `docs/INTERFACE_CONTRACT.md` §4.4 so that roots computed here can be verified
//! on-chain by `contracts/`'s `StateAnchor.sol` using OpenZeppelin's stock
//! `MerkleProof.verify` — NOT a bespoke verifier. Two invariants matter and are
//! both tested below against hashes independently computed with `cast keccak`
//! (Foundry's CLI), not just self-consistency within this file:
//!
//!   1. Hash function is keccak256, not SHA-256 (cheap/native in the EVM; this is
//!      the whole reason the old prototype's SHA-256 tree had to be replaced).
//!   2. Parent hashing sorts the pair of child hashes ascending before
//!      concatenating. This makes `hash_pair(a, b) == hash_pair(b, a)`, which is
//!      what lets a verifier walk a proof without tracking left/right position at
//!      each level — get this wrong and proofs that are valid off-chain will be
//!      rejected on-chain (or, worse, invalid proofs could be accepted).

use sha3::{Digest, Keccak256};

pub type Hash = [u8; 32];

/// Raw keccak256 over arbitrary bytes. Callers are responsible for encoding their
/// input the way Solidity's `abi.encodePacked` would (i.e. plain concatenation,
/// no length-prefixing) if the resulting hash needs to be reproduced on-chain —
/// see `telemetry_leaf_data` below for the one concrete case this package needs.
pub fn keccak256(data: &[u8]) -> Hash {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    hasher.finalize().into()
}

/// Combines two child hashes into a parent using the OpenZeppelin `MerkleProof`
/// convention: sort ascending, then concatenate and hash. Order-independence
/// (`hash_pair(a,b) == hash_pair(b,a)`) is the entire point — it avoids the
/// second-preimage / ordering-ambiguity attack that a naive "always left||right"
/// scheme is vulnerable to, and matches what `MerkleProof.verify` does on-chain.
pub fn hash_pair(a: Hash, b: Hash) -> Hash {
    let (lo, hi) = if a <= b { (a, b) } else { (b, a) };
    let mut buf = [0u8; 64];
    buf[..32].copy_from_slice(&lo);
    buf[32..].copy_from_slice(&hi);
    keccak256(&buf)
}

/// Packs the fields of a telemetry event into the flat byte layout that gets
/// keccak256'd into a leaf hash. This mirrors `abi.encodePacked(bytes, uint64,
/// bytes32)` semantics: plain concatenation, big-endian fixed-width integers, no
/// length prefixes.
///
/// NOTE: the interface contract (§4.4) pins the *hashing convention* (keccak256,
/// sorted-pair parents) that `contracts/` relies on, but does not pin this exact
/// leaf byte layout — that's an oracle-internal choice, since (for the current
/// scope) only the *root* needs to be verified on-chain, not individual leaves
/// reconstructed in Solidity. If `contracts/`'s `StateAnchor.sol` ever needs to
/// recompute a leaf hash itself (e.g. to verify a specific telemetry claim
/// on-chain), this byte layout becomes cross-package-load-bearing and must be
/// copied there exactly.
pub fn telemetry_leaf_data(agent_id: &str, nonce: u64, payload_hash: Hash) -> Vec<u8> {
    let mut buf = Vec::with_capacity(agent_id.len() + 8 + 32);
    buf.extend_from_slice(agent_id.as_bytes());
    buf.extend_from_slice(&nonce.to_be_bytes());
    buf.extend_from_slice(&payload_hash);
    buf
}

/// A binary Merkle tree over a fixed, ordered set of leaves. Rebuilt from
/// scratch on demand (from the ordered leaf hashes persisted per anchored root in
/// Postgres) rather than kept resident — anchoring happens in batches, not on
/// every request, so recomputation is cheap and avoids having to keep tree state
/// in sync with the DB.
pub struct MerkleTree {
    levels: Vec<Vec<Hash>>,
}

impl MerkleTree {
    /// Builds a tree from leaves in the given order. Order is significant and must
    /// match the `leaf_index` values persisted alongside each leaf in Postgres,
    /// since `get_proof` is positional.
    ///
    /// Panics if `leaves` is empty — an oracle anchoring call with zero pending
    /// leaves is a caller bug (the anchor endpoint checks for this before
    /// constructing a tree at all) rather than something to silently paper over
    /// with a sentinel root.
    pub fn new(leaves: Vec<Hash>) -> Self {
        assert!(!leaves.is_empty(), "MerkleTree::new requires at least one leaf");
        let mut levels = vec![leaves];
        while levels.last().unwrap().len() > 1 {
            let current = levels.last().unwrap();
            let mut next = Vec::with_capacity(current.len().div_ceil(2));
            for pair in current.chunks(2) {
                let parent = if pair.len() == 2 {
                    hash_pair(pair[0], pair[1])
                } else {
                    // Odd node out: duplicate it rather than promoting it unhashed,
                    // so every level is itself a keccak256 output and a proof step
                    // is always a `hash_pair` — no special-casing needed in
                    // `verify_proof`/`get_proof`.
                    hash_pair(pair[0], pair[0])
                };
                next.push(parent);
            }
            levels.push(next);
        }
        Self { levels }
    }

    pub fn root(&self) -> Hash {
        self.levels.last().unwrap()[0]
    }

    pub fn leaf_count(&self) -> usize {
        self.levels[0].len()
    }

    /// Inclusion proof (sibling hashes from leaf level up to, but not including,
    /// the root) for the leaf at `index`. Verify with `verify_proof`.
    pub fn get_proof(&self, index: usize) -> Option<Vec<Hash>> {
        if index >= self.levels[0].len() {
            return None;
        }
        let mut proof = Vec::new();
        let mut idx = index;
        for level in &self.levels[..self.levels.len() - 1] {
            let sibling_idx = if idx % 2 == 0 { idx + 1 } else { idx - 1 };
            let sibling = level.get(sibling_idx).copied().unwrap_or(level[idx]);
            proof.push(sibling);
            idx /= 2;
        }
        Some(proof)
    }
}

/// Verifies an inclusion proof the same way OpenZeppelin's `MerkleProof.verify`
/// does on-chain: fold the leaf up through each proof element with `hash_pair`
/// and check the result matches the claimed root. Because `hash_pair` sorts
/// internally, this doesn't need to know left/right position at each level.
pub fn verify_proof(leaf: Hash, proof: &[Hash], root: Hash) -> bool {
    let computed = proof.iter().fold(leaf, |acc, sibling| hash_pair(acc, *sibling));
    computed == root
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Cross-checked against `cast keccak "0x"` (Foundry), independent of this
    /// implementation: keccak256 of the empty byte string is a well-known
    /// constant. If this ever fails, it means the wrong hash function got wired
    /// in (e.g. SHA-256 or SHA3-256's differing padding), not a subtle bug.
    #[test]
    fn keccak256_matches_known_empty_input_constant() {
        let expected: Hash =
            hex::decode("c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")
                .unwrap()
                .try_into()
                .unwrap();
        assert_eq!(keccak256(b""), expected);
    }

    /// Cross-checked against `cast keccak "0x61"` / `"0x62"` and a manually
    /// sorted-then-concatenated `cast keccak` of the two results — i.e. this test
    /// vector was NOT generated by this code, it was generated independently by
    /// Foundry's `cast` CLI and hardcoded here, so it actually catches a wrong
    /// hash function or wrong sort order rather than just testing self-consistency.
    #[test]
    fn hash_pair_matches_independently_computed_cast_keccak_vector() {
        let leaf_a: Hash = hex::decode("3ac225168df54212a25c1c01fd35bebfea408fdac2e31ddd6f80a4bbf9a5f1cb")
            .unwrap()
            .try_into()
            .unwrap();
        let leaf_b: Hash = hex::decode("b5553de315e0edf504d9150af82dafa5c4667fa618ed0a6f19c69b41166c5510")
            .unwrap()
            .try_into()
            .unwrap();
        let expected_parent: Hash =
            hex::decode("805b21d846b189efaeb0377d6bb0d201b3872a363e607c25088f025b0c6ae1f8")
                .unwrap()
                .try_into()
                .unwrap();

        assert_eq!(hash_pair(leaf_a, leaf_b), expected_parent);
        // Order independence is the entire point of the sorted-pair convention.
        assert_eq!(hash_pair(leaf_b, leaf_a), expected_parent);
    }

    #[test]
    fn single_leaf_tree_root_is_the_leaf_itself() {
        let leaf = keccak256(b"only-leaf");
        let tree = MerkleTree::new(vec![leaf]);
        assert_eq!(tree.root(), leaf);
        assert_eq!(tree.get_proof(0).unwrap().len(), 0);
    }

    #[test]
    fn every_leaf_in_a_larger_tree_produces_a_valid_proof() {
        let leaves: Vec<Hash> = (0..7u8).map(|i| keccak256(&[i])).collect();
        let tree = MerkleTree::new(leaves.clone());
        let root = tree.root();

        for (i, leaf) in leaves.iter().enumerate() {
            let proof = tree.get_proof(i).expect("index in range");
            assert!(
                verify_proof(*leaf, &proof, root),
                "leaf {i} failed to verify against the tree root"
            );
        }
    }

    #[test]
    fn tampered_leaf_fails_verification() {
        let leaves: Vec<Hash> = (0..4u8).map(|i| keccak256(&[i])).collect();
        let tree = MerkleTree::new(leaves.clone());
        let root = tree.root();
        let proof = tree.get_proof(2).unwrap();

        let wrong_leaf = keccak256(b"not-the-real-leaf");
        assert!(!verify_proof(wrong_leaf, &proof, root));
    }

    #[test]
    fn odd_leaf_count_duplicates_last_node_rather_than_promoting_unhashed() {
        // 3 leaves: level 1 pairs (0,1) and duplicates (2,2). Root must differ
        // from a naive scheme that just promotes the odd leaf unhashed, since
        // that scheme is second-preimage-vulnerable.
        let leaves: Vec<Hash> = (0..3u8).map(|i| keccak256(&[i])).collect();
        let tree = MerkleTree::new(leaves.clone());
        let expected_level1 = vec![hash_pair(leaves[0], leaves[1]), hash_pair(leaves[2], leaves[2])];
        let expected_root = hash_pair(expected_level1[0], expected_level1[1]);
        assert_eq!(tree.root(), expected_root);
    }
}
