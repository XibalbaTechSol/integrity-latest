# integrity-zkp

The zero-knowledge circuit for the Integrity Protocol. It proves that an AI
agent's action matches a previously-committed intent, and that the prover
holds the agent's real key material — without revealing the secret key or
the full intent payload. Implements `docs/INTERFACE_CONTRACT.md` §5.

Written in [Noir](https://noir-lang.org/) (`nargo` 1.0.0-beta.22), proven
with [Barretenberg](https://github.com/AztecProtocol/barretenberg) (`bb`
5.0.0-nightly.20260522). Both were actually run to produce everything under
`target/` and `generated/` in this repo — nothing here is a description of
a circuit that hasn't been compiled and proven; see "Exact commands run"
below for the real transcript.

## What the circuit proves

Given:
- a private `secret_key` (a Field element KDF'd, off-circuit, from the
  agent's real Ed25519 secret seed — see "Scope limitation" below),
- a private `intent_payload_hash` (the SHA-256 `intended_state_hash` from
  the agent's BCC commitment object, §4.2, reduced to a Field — see "Hash
  function choice"),
- a public `nonce` (the same per-agent monotonic nonce from that BCC
  object — already public on the wire, not a secret),
- a public `agent_id_commitment` (the agent's long-lived ZK identity
  commitment, published once at DID-creation time), and
- a public `intent_commitment` (the specific, per-action public commitment
  this proof must reproduce),

the circuit asserts:

1. `pedersen_hash([DOMAIN_IDENTITY, secret_key]) == agent_id_commitment`
   — the prover holds the exact secret behind this agent's published
   identity, not just anyone who saw a public commitment. Prevents
   proof-of-identity spoofing.
2. `pedersen_hash([DOMAIN_INTENT, secret_key, intent_payload_hash, nonce]) == intent_commitment`
   — the prover actually knows the intent payload that was locked in for
   *this specific* nonce/action, not a fabricated or substituted one.
   Binding the nonce in prevents a valid proof for one action being
   replayed as if it covered a different action.
3. `nonce != 0` — defensive rejection of an uninitialized/sentinel nonce.

Both `assert`s are real constraints on real Pedersen hash gates — not
`assert(true)`. See `src/main.nr` for the fully commented source (the
comments explain the *why* — what attack each constraint stops — per
INTERFACE_CONTRACT.md §10).

Four `#[test]` functions in `src/main.nr` exercise this: one valid binding,
and three invalid ones (wrong secret / substituted payload / zero nonce)
that must each fail to satisfy the constraints — run with `nargo test`
(output pasted below; all four pass, including the three `should_fail`
cases correctly failing).

## Hash function choice — the one thing sibling packages MUST match

**We use Pedersen hash (`std::hash::pedersen_hash`) inside the circuit, not
SHA-256.**

The outer BCC wire object's `intended_state_hash` (§4.2) stays SHA-256 —
that's fixed by the interface contract and is used outside this circuit,
for the Ed25519 signature over the BCC JSON object. It does not change and
this package does not touch it.

Inside the circuit, SHA-256 would be very expensive: it's a bitwise hash
(rotations/XORs/ANDs over 32-bit words) and costs thousands of gates per
call in an arithmetic circuit. Pedersen hash is:
- a **native gate** in Barretenberg's UltraPlonk/UltraHonk backend (a
  handful of constraints instead of thousands), and
- already the convention the *other* Noir circuits in this protocol use
  (`integrity-oracle/circuits/telemetry` and `.../reputation` both commit
  private data with `std::hash::pedersen_hash`), so this keeps one ZK-hash
  convention across the whole protocol instead of introducing a third
  scheme (we considered Poseidon, but it isn't a native Barretenberg gate
  and would cost more constraints for no benefit here).

This means there are now **two distinct hashes** for the same logical
action, and every sibling package needs to keep them straight:

| Value | Hash | Computed by | Purpose |
|---|---|---|---|
| `intended_state_hash` | SHA-256 | integrity-sdk / integrity-cli | Signed BCC JSON object (§4.2), audit trail |
| `intent_commitment` | Pedersen | integrity-zkp circuit / integrity-sdk's `prover.py` | ZK-only, feeds this circuit and the oracle's `ZK_boost` (§4.3) check |

**Exact definition** (this is the load-bearing part — reproduce this
*exactly*, including array order and the domain tag, or your Pedersen
output will differ and every proof will fail to verify even though the
underlying data is "the same"):

```
agent_id_commitment = pedersen_hash([DOMAIN_IDENTITY, secret_key])            // DOMAIN_IDENTITY = 1
intent_commitment   = pedersen_hash([DOMAIN_INTENT, secret_key,
                                      intent_payload_hash, nonce])             // DOMAIN_INTENT = 2
```

**Converting bytes to a Field** (needed for both `secret_key` and
`intent_payload_hash`, which start life as byte strings): take the
big-endian byte string, interpret it as an unsigned integer, and reduce it
mod the BN254 scalar field prime
`21888242871839275222246405745257275088548364400416034343698204186575808495617`.
Reference Python (what `integrity-sdk/prover.py` and `integrity-oracle`
must both use):

```python
BN254_FR = 21888242871839275222246405745257275088548364400416034343698204186575808495617

def bytes_be_to_field_mod_r(b: bytes) -> int:
    return int.from_bytes(b, "big") % BN254_FR

# secret_key: KDF'd from the raw 32-byte Ed25519 seed
secret_key_field = bytes_be_to_field_mod_r(blake2s(ed25519_seed).digest())

# intent_payload_hash: the BCC object's own intended_state_hash bytes
intent_payload_hash_field = bytes_be_to_field_mod_r(bytes.fromhex(intended_state_hash[2:]))
```

**Domain separation** (`DOMAIN_IDENTITY = 1`, `DOMAIN_INTENT = 2`): both
hashes start with the same `secret_key` element; without a domain tag, a
Field that is "some Pedersen commitment" elsewhere in the protocol could in
principle be confused for one of these two commitment *kinds*. Tagging the
domain removes that ambiguity for one extra constraint. If a third
sibling introduces another Pedersen commitment over `secret_key`, it must
pick a new, unused domain tag.

## Scope limitation — honest, not silently mocked

A *full* Ed25519 signature-verification circuit (elliptic-curve scalar
multiplication and point addition over Curve25519, expressed as
non-native field arithmetic inside a BN254/Grumpkin proving system) is a
substantial undertaking on its own — it needs a bignum/foreign-field
gadget library and is typically its own audited circuit in production ZK
stacks. This package does not reimplement that from scratch.

Instead — and this is a real, checked cryptographic binding, not a mock —
`secret_key` is a Field element that `integrity-sdk` derives from the
agent's real Ed25519 seed via a KDF (`derive_circuit_secret()`, see the
Python snippet above) at DID-creation time. `agent_id_commitment =
pedersen_hash([DOMAIN_IDENTITY, secret_key])` is published once, alongside
the DID Document (§4.1), as the agent's long-lived ZK identity commitment.
This circuit proves "the prover holds the exact preimage of that published
commitment," which is a real proof-of-possession — it is just not itself
an Ed25519 signature check on an arbitrary message. This mirrors the
honesty rule the interface contract sets for TEE attestation (§8): say
plainly what's real and what's out of scope, rather than silently
pretending the boundary isn't there.

## Fixture values (`Prover.toml`)

The checked-in `Prover.toml` fixture uses `secret_key = 0xf00d`,
`intent_payload_hash = 0xc0ffee`, `nonce = 7` (as 32-byte hex strings), with
`agent_id_commitment` / `intent_commitment` precomputed to match via
Pedersen hash. These were derived by adding a temporary `#[test]` that
called `std::hash::pedersen_hash` on the fixture inputs and printed the
results with `std::println` (via `nargo test --show-output`), then
transcribing the printed Field values into `Prover.toml`. To regenerate for
different inputs, do the same: temporarily add a test that prints
`pedersen_hash([DOMAIN_IDENTITY, secret_key])` and
`pedersen_hash([DOMAIN_INTENT, secret_key, intent_payload_hash, nonce])`
for your chosen values, run `nargo test --show-output <name>`, copy the
output into `Prover.toml`, then delete the temporary test.

## Exact commands run (real output)

All commands below were actually executed against `nargo` 1.0.0-beta.22
and `bb` 5.0.0-nightly.20260522 in this environment. `-t evm` targets the
Ethereum/Solidity-compatible proving configuration (Keccak transcript) so
the same circuit's proof/vk can be verified both natively via `bb verify`
and, once contracts/ consumes `generated/UltraPlonkVerifier.sol`, on-chain.

### 1. `nargo test` — constraint unit tests

```
$ nargo test
[integrity_zkp] Running 4 test functions
[integrity_zkp] Testing test_invalid_binding_wrong_secret ... ok
[integrity_zkp] Testing test_valid_binding ... ok
[integrity_zkp] Testing test_invalid_binding_zero_nonce ... ok
[integrity_zkp] Testing test_invalid_binding_wrong_payload ... ok
[integrity_zkp] 4 tests passed
```

All three `should_fail` tests (wrong secret, substituted payload, zero
nonce) correctly fail to satisfy the circuit's constraints; the valid
binding correctly succeeds.

### 2. `nargo compile` — produce ACIR bytecode

```
$ nargo compile
$ ls target/
integrity_zkp.json
```

(No stdout on success — `nargo compile` is silent when it succeeds.)

### 3. `nargo execute witness` — generate the witness for the `Prover.toml` fixture

```
$ nargo execute witness
[integrity_zkp] Circuit witness successfully solved
[integrity_zkp] Witness saved to target/witness.gz
```

### 4. `bb write_vk` — verification key

```
$ bb write_vk -b target/integrity_zkp.json -o target/vk -t evm
Scheme is: ultra_honk, num threads: 4 (mem: 5.05 MiB)
CircuitProve: Proving key computed in 40 ms (mem: 24.55 MiB)
VK saved to "target/vk/vk" (mem: 25.10 MiB)
VK Hash saved to "target/vk/vk_hash" (mem: 25.10 MiB)
```

### 5. `bb prove` — generate the proof

```
$ bb prove -b target/integrity_zkp.json -w target/witness.gz -o target/proof -k target/vk/vk -t evm
Scheme is: ultra_honk, num threads: 4 (mem: 5.11 MiB)
CircuitProve: Proving key computed in 42 ms (mem: 24.37 MiB)
Public inputs saved to "target/proof/public_inputs" (mem: 31.30 MiB)
Proof saved to "target/proof/proof" (mem: 31.30 MiB)
```

### 6. `bb verify` — verify the real proof

```
$ bb verify -k target/vk/vk -p target/proof/proof -i target/proof/public_inputs -t evm
Scheme is: ultra_honk, num threads: 4 (mem: 5.05 MiB)
Proof verified successfully (mem: 7.65 MiB)
```

Exit code `0`. As a negative-control sanity check, flipping a single byte
in `public_inputs` and re-running `bb verify` against the same proof
produces:

```
Scheme is: ultra_honk, num threads: 4 (mem: 7.65 MiB)
UltraVerifier: verification failed at reduction step (mem: 7.65 MiB)
Proof verification failed
```

Exit code `1` — confirming the verifier is actually checking the proof
against the public inputs, not returning a hardcoded success.

### 7. `bb write_solidity_verifier` — the on-chain verifier hand-off

```
$ bb write_solidity_verifier -k target/vk/vk -o generated/UltraPlonkVerifier.sol -t evm
Scheme is: ultra_honk, num threads: 4 (mem: 5.38 MiB)
ZK Honk solidity verifier saved to "generated/UltraPlonkVerifier.sol" (mem: 6.30 MiB)
```

Produces `generated/UltraPlonkVerifier.sol` — **2465 lines**, a real
generated Solidity verifier contract (not a stub), keyed to the exact
verification key computed above (`VK_HASH` constant in the file equals the
contents of `target/vk/vk_hash`,
`29631cc6d55f5411f83b65121192f9f932a6b66067848cc8f8cc1ad191ab8394`).

**Naming note for `contracts/`:** the file is named
`UltraPlonkVerifier.sol` to match the placeholder path
`contracts/src/oracle/UltraPlonkVerifier.sol` expected by
INTERFACE_CONTRACT.md §5.3/§9, but `bb`'s printed scheme is
`ultra_honk` — Barretenberg 5.0.0-nightly's current default proving
system is **UltraHonk**, not the older UltraPlonk. The generated contract
is a real Honk verifier; treat "UltraPlonkVerifier.sol" as the *filename
contracts/ is expecting*, not a claim about the underlying proof system.
The contract also declares `NUMBER_OF_PUBLIC_INPUTS = 11`, not 3 — Honk
verifiers append internal protocol accumulator/pairing-point public inputs
after this circuit's own 3 (`agent_id_commitment`, `nonce`,
`intent_commitment`); `contracts/` must pass through whatever `bb`'s
`public_inputs` output contains verbatim to the verifier's `verify()`
call rather than assuming a 3-element array.

## Handoff to `contracts/`

1. `contracts/src/oracle/UltraPlonkVerifier.sol` should be replaced
   **entirely** by `integrity-zkp/generated/UltraPlonkVerifier.sol` (copy
   it over — it's a generated artifact, don't hand-edit either copy).
2. Whenever this circuit changes (new constraints, new public inputs),
   regenerate with `make solidity-verifier` (below) and re-copy — the
   verifier is coupled 1:1 to the verification key, which is coupled 1:1
   to the compiled circuit.
3. `contracts/`'s deployment script registers the deployed verifier's
   address as `UltraPlonkVerifier` in `deployments.local.json` (§6);
   `integrity-oracle` and `integrity-sdk` read that address when they need
   to submit/verify proofs against the chain rather than only locally via
   `bb verify`.

## `integrity-sdk` handoff (`prover.py`)

`integrity-sdk`'s `prover.py` is expected to shell out to this package's
toolchain per §5 item 4:
1. Compute `secret_key_field` and `intent_payload_hash_field` per the
   Python snippet above.
2. Write a `Prover.toml` with those two as private inputs and
   `agent_id_commitment` / `nonce` / `intent_commitment` as public inputs
   (computed the same way `Prover.toml`'s fixture was derived here).
3. Run `nargo execute <name>` (from this package's directory, or
   `nargo execute --program-dir <path-to-integrity-zkp>`), then `bb prove`
   / optionally `bb verify` locally before submitting the proof to
   `integrity-oracle` or on-chain, exactly as run above.

## Makefile targets (CI-runnable)

```
make test               # nargo test — fast, no bb, run on every CI build
make compile             # nargo compile
make execute             # nargo execute witness (uses checked-in Prover.toml)
make vk                  # bb write_vk
make prove               # bb prove
make verify              # bb verify (fails the build if verification fails)
make solidity-verifier   # bb write_solidity_verifier -> generated/UltraPlonkVerifier.sol
make build               # test + verify + solidity-verifier, i.e. the full pipeline above
make clean               # remove target/ and generated/
```

`make build` is what CI should run for this package — it is the exact
sequence of commands transcribed above, not a separate/looser check.

## Directory layout

```
integrity-zkp/
  Nargo.toml
  Prover.toml           # checked-in real fixture (see "Fixture values")
  Makefile
  src/main.nr           # the circuit + its #[test]s
  target/                # nargo/bb build artifacts (gitignored, regenerate with `make build`)
  generated/
    UltraPlonkVerifier.sol   # hand-off artifact for contracts/ (checked in)
```
