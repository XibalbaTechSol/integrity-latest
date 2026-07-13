// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IZkVerifier} from "./IZkVerifier.sol";

/// =============================================================================
///  PLACEHOLDER — THIS FILE WILL BE REPLACED WHOLESALE, NOT EDITED.
/// =============================================================================
/// @title UltraPlonkVerifier (placeholder)
/// @notice Stand-in for the real UltraPlonk/Honk verifier that `bb write_solidity_verifier`
/// generates from the compiled `integrity-zkp/src/main.nr` circuit (see §5 of
/// docs/INTERFACE_CONTRACT.md and script/GenerateVerifier.sh in this package).
///
/// @dev THIS IS NOT THE OLD PROTOTYPE'S MOCK. The previous version of this file
/// (`/INTEGRITY/contracts/src/oracle/UltraPlonkVerifier.sol`) had `verify()` return
/// `true` for any non-empty proof — i.e. it failed OPEN: a caller who did nothing but
/// pass non-empty garbage bytes got treated as a valid ZK proof. That is exactly the
/// "silent mock" the interface contract's ground rule (docs/INTERFACE_CONTRACT.md, the
/// "no silent mocks" paragraph) forbids.
///
/// This placeholder instead fails CLOSED: every call to `verify` reverts, unconditionally.
/// That means:
///   1. It is IMPOSSIBLE for any transaction depending on ZK verification (see
///      ReputationRegistry.submitZkAttestation) to be silently treated as "proof
///      accepted" or "proof rejected but let's proceed anyway" — it simply cannot be
///      exercised end-to-end until the real verifier is generated and swapped in.
///   2. Tests that need to exercise the *rest* of the ZK-attestation code path (the
///      Merkle-anchor check, the AIS boost bookkeeping) do so honestly, by pointing
///      ReputationRegistry at a `vm.mockCall`-controlled stand-in for IZkVerifier in the
///      test file, not at this contract — see test/ReputationRegistry.t.sol. That mock
///      call lives in test code, which is expected and inspectable, not hidden inside a
///      "production" contract.
///
/// To replace this file for real: run `make generate-verifier` from this package (see
/// script/GenerateVerifier.sh), which compiles the Noir circuit in ../integrity-zkp,
/// runs `bb write_vk` + `bb write_solidity_verifier`, and overwrites this exact file
/// with the generated contract. The generated contract must keep implementing
/// IZkVerifier so ReputationRegistry needs no changes.
contract UltraPlonkVerifier is IZkVerifier {
    /// @notice Always reverts. See contract-level NatSpec for why this fails closed
    /// instead of returning a hardcoded boolean.
    error PlaceholderVerifierNotYetGenerated();

    function verify(bytes calldata, /* proof */ bytes32[] calldata /* publicInputs */ )
        external
        pure
        override
        returns (bool)
    {
        revert PlaceholderVerifierNotYetGenerated();
    }
}
