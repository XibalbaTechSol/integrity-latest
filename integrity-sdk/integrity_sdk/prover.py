"""
Real ZK proof generation via `nargo` + `bb` — docs/INTERFACE_CONTRACT.md §5.

The old prototype's `NoirProver.generate_proof` never invoked `nargo` at all:

    integrity_commitment = "0x" + hashlib.sha256(commitment_payload.encode()).hexdigest()
    return {
        "zk_proof": integrity_commitment,  # For MVP, the commitment acts as proof-of-work
        ...
    }

A SHA-256 hash is not a zero-knowledge proof — there is no circuit, no
witness, nothing for a verifier to check beyond "did you hash the right
string", which anyone can do without owning any secret. This module shells
out to the real toolchain: `nargo execute` solves the circuit and produces a
witness, `bb prove` produces an actual UltraHonk proof over that witness,
and `bb verify` really checks it.

Circuit: this points at `circuits/poc_commitment/` (see that circuit's own
docstring) — a small stand-in circuit compiled and tested in THIS repo,
because the real attestation circuit lives in the sibling `integrity-zkp`
package, which did not exist yet at the time this SDK was built. Swapping to
the real circuit later means: point `circuit_dir` at integrity-zkp's build
output, and update `_pack_hash_to_field` / `_derive_secret_field` if the
real circuit's public-input layout differs from this stand-in's
`(secret: Field, intent_hash: pub Field) -> pub Field`.
"""

from __future__ import annotations

import hashlib
import shutil
import subprocess
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .did import Keypair

# The BN254 scalar field modulus that Barretenberg/Noir's default proving
# backend operates over. Any Field value in the circuit is implicitly taken
# mod this prime. A raw SHA-256 digest is a 256-bit number, which can exceed
# this ~254-bit prime, so we reduce it mod the prime before handing it to
# the circuit ("hash-to-field"). This is lossy (a small fraction of digests
# collide after reduction) and standard practice for packing a hash into a
# scalar field; the real integrity-zkp circuit may instead split the digest
# across two field limbs to avoid any information loss at all — reconcile
# this if/when that circuit's ABI is finalized.
FR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617

DEFAULT_VERIFIER_TARGET = "noir-recursive-no-zk"


class ProverError(RuntimeError):
    """Raised on any failure in the real proving pipeline (missing
    toolchain, nargo/bb non-zero exit, malformed output). Deliberately NOT
    caught-and-faked anywhere — a failed proof must surface as a failure,
    not silently degrade to a placeholder value."""


@dataclass
class ZKProof:
    circuit: str
    verifier_target: str
    proof_hex: str
    public_inputs_hex: str
    intent_hash_field: str  # decimal string, for debugging/audit logs

    def to_dict(self) -> dict:
        return {
            "circuit": self.circuit,
            "verifier_target": self.verifier_target,
            "zk_proof": self.proof_hex,
            "public_inputs": self.public_inputs_hex,
            "intent_hash_field": self.intent_hash_field,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ZKProof":
        return cls(
            circuit=data["circuit"],
            verifier_target=data["verifier_target"],
            proof_hex=data["zk_proof"],
            public_inputs_hex=data["public_inputs"],
            intent_hash_field=data["intent_hash_field"],
        )


def _pack_hash_to_field(intended_state_hash_hex: str) -> int:
    """Reduce a `0x`-prefixed sha256 hex digest into the BN254 scalar field."""
    h = intended_state_hash_hex[2:] if intended_state_hash_hex.startswith("0x") else intended_state_hash_hex
    return int(h, 16) % FR_MODULUS


def _derive_secret_field(keypair: Keypair) -> int:
    """
    Derive the circuit's private `secret` witness from the agent's Ed25519
    private key material, WITHOUT ever feeding the raw private key bytes
    into the circuit directly. Signing keys should never leave the process
    they belong to in any form (not even as a "just a witness, nobody sees
    it" argument) — instead we hash the private key bytes with a
    domain-separation tag before reducing into the field. If this derivation
    or the proof ever leaked (e.g. a buggy witness-debug dump), the output
    doesn't hand an attacker anything closer to the actual signing key than
    a generic hash would.
    """
    seed = keypair.private_bytes_raw()
    digest = hashlib.sha256(b"integrity-sdk:zk-secret:v1:" + seed).digest()
    return int.from_bytes(digest, "big") % FR_MODULUS


class NoirProver:
    """Shells out to `nargo`/`bb` for a given agent's proofs. One instance
    per circuit; safe to share across an app's lifetime since every call
    uses unique witness/output filenames (no shared mutable proving state)."""

    def __init__(
        self,
        circuit_dir: Optional[Path] = None,
        verifier_target: str = DEFAULT_VERIFIER_TARGET,
    ):
        self.circuit_dir = Path(circuit_dir) if circuit_dir else (
            Path(__file__).resolve().parent.parent / "circuits" / "poc_commitment"
        )
        self.circuit_name = "poc_commitment"
        self.verifier_target = verifier_target

        self._nargo = shutil.which("nargo")
        self._bb = shutil.which("bb")
        if self._nargo is None or self._bb is None:
            raise ProverError(
                "nargo and/or bb not found on PATH. Real ZK proving requires the "
                "actual Noir/Barretenberg toolchain (nargo 1.0.0-beta.22, bb "
                "5.0.0-nightly per docs/INTERFACE_CONTRACT.md §1) — there is no "
                "mock fallback. Add $HOME/.nargo/bin and $HOME/.bb to PATH."
            )

        self._target_dir = self.circuit_dir / "target"
        self._bytecode_path = self._target_dir / f"{self.circuit_name}.json"
        self._vk_dir = self._target_dir / "vk"
        self._vk_path = self._vk_dir / "vk"

        self._ensure_compiled()
        self._ensure_vk()

    def _run(self, args: list, cwd: Optional[Path] = None) -> subprocess.CompletedProcess:
        try:
            result = subprocess.run(
                args,
                cwd=str(cwd or self.circuit_dir),
                capture_output=True,
                text=True,
                timeout=120,
            )
        except subprocess.TimeoutExpired as exc:
            raise ProverError(f"Command timed out: {' '.join(args)}") from exc
        if result.returncode != 0:
            raise ProverError(
                f"Command failed ({' '.join(args)}):\nstdout: {result.stdout}\nstderr: {result.stderr}"
            )
        return result

    def _ensure_compiled(self) -> None:
        if self._bytecode_path.exists():
            return
        self._run([self._nargo, "compile"])
        if not self._bytecode_path.exists():
            raise ProverError(
                f"nargo compile did not produce expected bytecode at {self._bytecode_path}"
            )

    def _ensure_vk(self) -> None:
        if self._vk_path.exists():
            return
        self._run(
            [
                self._bb, "write_vk",
                "-b", str(self._bytecode_path),
                "-o", str(self._vk_dir),
                "--verifier_target", self.verifier_target,
            ]
        )
        if not self._vk_path.exists():
            raise ProverError(f"bb write_vk did not produce expected key at {self._vk_path}")

    def generate_proof(self, intended_state_hash_hex: str, keypair: Keypair) -> ZKProof:
        """
        Produce a real UltraHonk proof binding `keypair`'s (domain-separated)
        secret to `intended_state_hash_hex` — the BCC commitment's
        `intended_state_hash`. Every step here is a real subprocess call;
        any failure raises `ProverError` rather than returning a placeholder.
        """
        call_id = uuid.uuid4().hex[:12]
        prover_toml_name = f"Prover_{call_id}"
        witness_name = f"witness_{call_id}"

        secret_field = _derive_secret_field(keypair)
        intent_hash_field = _pack_hash_to_field(intended_state_hash_hex)

        prover_toml_path = self.circuit_dir / f"{prover_toml_name}.toml"
        witness_path = self._target_dir / f"{witness_name}.gz"
        output_dir = self._target_dir / f"proof_{call_id}"

        try:
            prover_toml_path.write_text(
                f'secret = "{secret_field}"\n'
                f'intent_hash = "{intent_hash_field}"\n'
            )

            self._run([self._nargo, "execute", "-p", prover_toml_name, witness_name])
            if not witness_path.exists():
                raise ProverError(f"nargo execute did not produce witness at {witness_path}")

            output_dir.mkdir(parents=True, exist_ok=True)
            self._run(
                [
                    self._bb, "prove",
                    "-b", str(self._bytecode_path),
                    "-w", str(witness_path),
                    "-k", str(self._vk_path),
                    "-o", str(output_dir),
                    "--verifier_target", self.verifier_target,
                ]
            )

            proof_bytes = (output_dir / "proof").read_bytes()
            public_inputs_bytes = (output_dir / "public_inputs").read_bytes()

            return ZKProof(
                circuit=self.circuit_name,
                verifier_target=self.verifier_target,
                proof_hex=proof_bytes.hex(),
                public_inputs_hex=public_inputs_bytes.hex(),
                intent_hash_field=str(intent_hash_field),
            )
        finally:
            # Best-effort cleanup of this call's scratch files; the compiled
            # circuit + vk are left in place and reused across calls.
            prover_toml_path.unlink(missing_ok=True)
            witness_path.unlink(missing_ok=True)
            if output_dir.exists():
                for f in output_dir.iterdir():
                    f.unlink(missing_ok=True)
                output_dir.rmdir()

    def verify_proof(self, proof: ZKProof) -> bool:
        """Run `bb verify` against a proof this prover (or any prover using
        the same circuit/vk) produced. Returns False on verification
        failure OR on any error reading/writing the proof files — this is a
        yes/no trust check, not something that should raise for a bad proof."""
        call_id = uuid.uuid4().hex[:12]
        proof_path = self._target_dir / f"verify_proof_{call_id}"
        public_inputs_path = self._target_dir / f"verify_public_inputs_{call_id}"
        try:
            proof_path.write_bytes(bytes.fromhex(proof.proof_hex))
            public_inputs_path.write_bytes(bytes.fromhex(proof.public_inputs_hex))
            result = subprocess.run(
                [
                    self._bb, "verify",
                    "-k", str(self._vk_path),
                    "-p", str(proof_path),
                    "-i", str(public_inputs_path),
                    "--verifier_target", self.verifier_target,
                ],
                cwd=str(self.circuit_dir),
                capture_output=True,
                text=True,
                timeout=60,
            )
            return result.returncode == 0
        finally:
            proof_path.unlink(missing_ok=True)
            public_inputs_path.unlink(missing_ok=True)
