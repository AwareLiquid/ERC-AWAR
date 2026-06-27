// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IERC83xx — Agent Experience Delta and Verifiable Memory Commitment
/// @notice Append-only registry of *commitments* to agent memory state
///         transitions. Only commitments / events / references / proofs go
///         on-chain; raw memory (prompts, embeddings, latent state) stays
///         encrypted off-chain. See SPEC §6.
interface IERC83xx {
    /// @dev Canonical typed memory categories (SPEC §5). Order is normative:
    ///      the enum value is the on-chain `memoryType` code.
    enum MemoryType {
        TEXT,
        EMBEDDING,
        LATENT,
        TOOL_TRACE,
        EPISODIC,
        POLICY,
        SHARED_WORKING,
        PROOF
    }

    /// @dev One verifiable memory state transition (SPEC §4.1).
    struct ExperienceDelta {
        bytes32 spaceId; // memory subject / namespace (ERC-8264 subject)
        bytes32 priorMemoryCommitment; // prior commitment (genesis = 0)
        bytes32 newContentCommitment; // new off-chain payload commitment
        MemoryType memoryType;
        bytes32 schemaHash; // how to interpret the commitment
        bytes32 inferenceAnchor; // ERC-8263 (optional, 0 if absent)
        bytes32 inputHash; // ERC-8299 / WYRIWE (optional, 0 if absent)
        bytes32 previousDelta; // evolution-chain pointer
        uint64 timestamp; // unix seconds
        uint64 version; // monotonic per space
    }

    /// @notice Emitted on every accepted commitment.
    event ExperienceCommitted(
        bytes32 indexed spaceId,
        bytes32 indexed deltaId,
        bytes32 previousDelta,
        MemoryType memoryType,
        address indexed agent, // ERC-8004 identity (recovered signer)
        string uri // ipfs:// | ethstorage:// | ar://
    );

    /// @notice Emitted when a committed delta is revoked (SPEC §9.1).
    event MemoryRevoked(bytes32 indexed spaceId, bytes32 indexed deltaId, address by);

    /// @notice Emitted when a storage system proves payload deletion (SPEC §9.4).
    event DeletionProven(bytes32 indexed spaceId, bytes32 indexed deltaId, bytes32 evidence);

    /// @notice Commit one experience delta (commitment only).
    /// @param d The delta record.
    /// @param uri Pointer to the (encrypted) off-chain payload.
    /// @param signature ERC-8004 agent signature over the EIP-712 digest.
    /// @return deltaId keccak256 EIP-712 struct hash of `d`.
    function commitDelta(ExperienceDelta calldata d, string calldata uri, bytes calldata signature)
        external
        returns (bytes32 deltaId);

    /// @notice Latest commitment for a space.
    function head(bytes32 spaceId)
        external
        view
        returns (bytes32 deltaId, bytes32 commitment, uint64 version);

    /// @notice Revoke a committed delta (subject to ERC-8264 rights / ERC-8312 mandate).
    function revoke(bytes32 spaceId, bytes32 deltaId) external;

    /// @notice Submit cryptographic evidence that an off-chain payload / key was removed.
    function proveDeletion(bytes32 spaceId, bytes32 deltaId, bytes calldata evidence) external;
}
