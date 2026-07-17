// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @notice Pure v1 commitment helpers used by conformance tests and local tooling.
/// @dev Do not expose raw private payloads through a public transaction wrapper.
library PrivateCommitment {
    bytes32 internal constant DELTA_DOMAIN = keccak256("AgentMemoryState.deltaCommitment.v1");
    bytes32 internal constant PROVENANCE_DOMAIN =
        keccak256("AgentMemoryState.provenanceCommitment.v1");
    bytes32 internal constant LOCATOR_DOMAIN = keccak256("AgentMemoryState.locatorCommitment.v1");

    function computeDelta(bytes memory payload, bytes32 salt, bytes32 profileId)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(DELTA_DOMAIN, profileId, salt, keccak256(payload)));
    }

    function computeProvenance(bytes memory provenance, bytes32 salt)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(PROVENANCE_DOMAIN, salt, keccak256(provenance)));
    }

    function computeLocator(bytes memory locator, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encode(LOCATOR_DOMAIN, salt, keccak256(locator)));
    }
}
