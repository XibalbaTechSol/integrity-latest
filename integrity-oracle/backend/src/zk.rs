//! Off-chain Zero-Knowledge proof verification for scoring purposes, via
//! Barretenberg's `bb verify` CLI (§5 of the interface contract).
//!
//! Design choice — shelling out vs. a Rust binding: as of this writing there is
//! no maintained Rust crate binding the installed `bb` 5.0.0-nightly's UltraHonk
//! verifier (the old prototype's `bb_rs` was a hand-written FFI stub that never
//! called real Barretenberg code — see its one-line `!proof.is_null()` "verifier").
//! `bb` itself is a real, actively-developed CLI that `integrity-sdk`'s prover
//! also shells out to (§5.4), so using the same CLI here keeps oracle verification
//! and SDK-side local verification behaviorally identical by construction — they
//! run literally the same binary. Shelling out is the practical, honest choice;
//! revisit if/when a real safe Rust binding exists for this bb version.
//!
//! Trust boundary: the verification key comes from *this service's own config*
//! (`vk_paths`, populated from `ZK_VK_PATHS` at startup), never from the request.
//! If a caller could supply their own VK, "verification" would be meaningless —
//! anyone can produce a valid proof against a circuit they made up themselves.
//! Only the proof and public inputs come from the request; the VK is always ours.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use tokio::process::Command;

#[derive(Debug, thiserror::Error)]
pub enum ZkVerifyError {
    #[error("unknown circuit id '{0}' — not present in ZK_VK_PATHS config")]
    UnknownCircuit(String),
    #[error("failed to write scratch file for verification: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to launch `bb` (checked path: {path}): {source}")]
    SpawnFailed { path: String, source: std::io::Error },
    #[error("`bb verify` produced output that was neither a clear pass nor a clear fail — treating as an error rather than guessing. stdout={stdout:?} stderr={stderr:?}")]
    AmbiguousOutput { stdout: String, stderr: String },
}

/// Wraps the `bb verify` CLI. One instance is shared (via `Arc`) across the Axum
/// app; it holds no mutable state, just config (paths), so sharing is trivial.
#[derive(Clone)]
pub struct ZkVerifier {
    /// circuit_id -> path of the trusted verification key for that circuit.
    vk_paths: HashMap<String, PathBuf>,
    /// Must match the `--verifier_target` the proof was generated with (`bb
    /// prove`'s target determines the transcript hash function — mismatched
    /// targets fail verification even for an otherwise-valid proof). "evm" is the
    /// default because that's the target `contracts/`'s Solidity verifier also
    /// needs, so the sdk's proof generation and this oracle's off-chain
    /// verification stay aligned with what will eventually be checked on-chain too.
    verifier_target: String,
    bb_binary: PathBuf,
    /// Scratch directory for the proof/public-inputs files `bb` reads — `bb
    /// verify` takes file paths, not stdin, so the request's bytes have to land
    /// on disk momentarily. Cleaned up after every call, success or failure.
    scratch_dir: PathBuf,
}

impl ZkVerifier {
    pub fn new(
        vk_paths: HashMap<String, PathBuf>,
        verifier_target: impl Into<String>,
        bb_binary: impl Into<PathBuf>,
        scratch_dir: impl Into<PathBuf>,
    ) -> Self {
        Self {
            vk_paths,
            verifier_target: verifier_target.into(),
            bb_binary: bb_binary.into(),
            scratch_dir: scratch_dir.into(),
        }
    }

    pub fn known_circuits(&self) -> impl Iterator<Item = &str> {
        self.vk_paths.keys().map(|s| s.as_str())
    }

    /// Verifies a proof for `circuit_id` against this oracle's own trusted VK.
    /// `proof_bytes` and `public_inputs_bytes` are exactly the binary blobs
    /// `bb prove` produced (i.e. the raw contents of its `proof` / `public_inputs`
    /// output files) — the caller (a telemetry submission) supplies these; the VK
    /// never comes from the caller.
    pub async fn verify(
        &self,
        circuit_id: &str,
        proof_bytes: &[u8],
        public_inputs_bytes: &[u8],
    ) -> Result<bool, ZkVerifyError> {
        let vk_path = self
            .vk_paths
            .get(circuit_id)
            .ok_or_else(|| ZkVerifyError::UnknownCircuit(circuit_id.to_string()))?;

        tokio::fs::create_dir_all(&self.scratch_dir).await?;
        let request_id = uuid::Uuid::new_v4();
        let proof_path = self.scratch_dir.join(format!("proof-{request_id}.bin"));
        let inputs_path = self.scratch_dir.join(format!("public_inputs-{request_id}.bin"));

        // Best-effort cleanup guard: write files, run bb, then always remove them,
        // even on error paths, so a burst of failed verifications can't fill disk
        // with abandoned scratch files.
        let result = self
            .run_bb_verify(&proof_path, &inputs_path, vk_path, proof_bytes, public_inputs_bytes)
            .await;
        let _ = tokio::fs::remove_file(&proof_path).await;
        let _ = tokio::fs::remove_file(&inputs_path).await;
        result
    }

    async fn run_bb_verify(
        &self,
        proof_path: &Path,
        inputs_path: &Path,
        vk_path: &Path,
        proof_bytes: &[u8],
        public_inputs_bytes: &[u8],
    ) -> Result<bool, ZkVerifyError> {
        tokio::fs::write(proof_path, proof_bytes).await?;
        tokio::fs::write(inputs_path, public_inputs_bytes).await?;

        let output = Command::new(&self.bb_binary)
            .arg("verify")
            .arg("-p")
            .arg(proof_path)
            .arg("-k")
            .arg(vk_path)
            .arg("-i")
            .arg(inputs_path)
            .arg("--verifier_target")
            .arg(&self.verifier_target)
            .output()
            .await
            .map_err(|source| ZkVerifyError::SpawnFailed {
                path: self.bb_binary.display().to_string(),
                source,
            })?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        // `bb verify`'s exit status is the authoritative signal (0 = verified,
        // nonzero = not verified); the message check is a belt-and-suspenders
        // sanity check so a `bb` CLI/flag mismatch (e.g. wrong verifier_target
        // producing some other error) surfaces as `AmbiguousOutput` rather than
        // silently being read as "invalid proof".
        //
        // The success banner is checked on BOTH streams: current `bb`
        // (Barretenberg 5.x, the version pinned in the interface contract §1)
        // writes "Proof verified successfully" to STDERR alongside its memory
        // stats, not stdout — matching the failure check below, which already
        // scans both streams for the same reason.
        let verified_banner = "Proof verified successfully";
        if output.status.success() && (stdout.contains(verified_banner) || stderr.contains(verified_banner)) {
            return Ok(true);
        }
        if !output.status.success()
            && (stdout.contains("verification failed") || stderr.contains("verification failed"))
        {
            return Ok(false);
        }
        Err(ZkVerifyError::AmbiguousOutput { stdout, stderr })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Fixture generated once, by hand, exactly as documented in
    /// `backend/tests/fixtures/zk_smoke/circuit/` — a tiny Noir circuit proving
    /// knowledge of a `secret` whose Pedersen hash equals a public commitment.
    /// This mirrors the *shape* of the real `integrity-zkp` attestation circuit
    /// (prove knowledge of a private value matching a public commitment) without
    /// its Ed25519 machinery, which doesn't exist yet since that's a sibling
    /// package being built in parallel. Regenerate with:
    ///   cd backend/tests/fixtures/zk_smoke/circuit
    ///   nargo compile
    ///   nargo execute witness
    ///   bb write_vk -b target/test_circuit.json -o ../out_vk --verifier_target evm
    ///   bb prove -b target/test_circuit.json -w target/witness.gz -k ../out_vk/vk -o ../out_proof --verifier_target evm
    fn fixtures_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/zk_smoke")
    }

    fn make_verifier() -> ZkVerifier {
        let dir = fixtures_dir();
        let mut vk_paths = HashMap::new();
        vk_paths.insert("smoke-test-circuit".to_string(), dir.join("vk"));
        ZkVerifier::new(
            vk_paths,
            "evm",
            // Resolved the same way config.rs does: trust PATH unless BB_BINARY is set.
            std::env::var("BB_BINARY").unwrap_or_else(|_| "bb".to_string()),
            std::env::temp_dir().join("integrity-oracle-zk-test-scratch"),
        )
    }

    #[tokio::test]
    async fn verifies_a_real_bb_generated_proof() {
        let dir = fixtures_dir();
        let proof = tokio::fs::read(dir.join("proof")).await.unwrap();
        let public_inputs = tokio::fs::read(dir.join("public_inputs")).await.unwrap();

        let verifier = make_verifier();
        let result = verifier
            .verify("smoke-test-circuit", &proof, &public_inputs)
            .await
            .expect("bb verify should run successfully against a valid fixture");
        assert!(result, "a genuine bb-generated proof against its matching VK must verify");
    }

    #[tokio::test]
    async fn rejects_a_proof_against_tampered_public_inputs() {
        let dir = fixtures_dir();
        let proof = tokio::fs::read(dir.join("proof")).await.unwrap();
        let tampered = tokio::fs::read(dir.join("tampered_public_inputs")).await.unwrap();

        let verifier = make_verifier();
        let result = verifier
            .verify("smoke-test-circuit", &proof, &tampered)
            .await
            .expect("bb verify should run and report a clean failure, not error out");
        assert!(!result, "tampered public inputs must not verify");
    }

    #[tokio::test]
    async fn unknown_circuit_id_is_rejected_before_ever_shelling_out() {
        let verifier = make_verifier();
        let result = verifier.verify("not-a-registered-circuit", b"junk", b"junk").await;
        assert!(matches!(result, Err(ZkVerifyError::UnknownCircuit(_))));
    }
}
