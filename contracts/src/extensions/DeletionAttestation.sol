// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IAgentMemoryState} from "../interfaces/IAgentMemoryState.sol";

/// @title DeletionAttestation
/// @notice Optional evidence registry. It does not claim universal data erasure.
/// @dev This contract accepts a commitment, never raw evidence. An earlier revision took
///      `bytes calldata evidence` and hashed it on chain, which permanently published the
///      evidence in transaction calldata — contradicting architecture invariant 9 and the
///      rule against exposing raw private payloads through a public wrapper. Callers must
///      hash off chain and keep the preimage as a private witness.
contract DeletionAttestation {
    error UnknownTransition();
    error WrongSpace();
    error NotSpaceController();
    error AlreadyAttested();
    error EmptyEvidenceCommitment();

    IAgentMemoryState public immutable registry;
    mapping(bytes32 transitionId => bytes32 evidenceCommitment) public evidenceOf;

    event DeletionAttested(
        bytes32 indexed spaceId,
        bytes32 indexed transitionId,
        bytes32 indexed evidenceCommitment,
        address controller
    );

    constructor(IAgentMemoryState registry_) {
        registry = registry_;
    }

    /// @param evidenceCommitment Salted commitment to the deletion evidence, computed off
    ///        chain. Passing an unsalted hash of low-entropy evidence is subject to the
    ///        same dictionary attacks described for payload commitments.
    function attest(bytes32 spaceId, bytes32 transitionId, bytes32 evidenceCommitment) external {
        if (evidenceCommitment == bytes32(0)) revert EmptyEvidenceCommitment();
        (bytes32 recordedSpace,,,) = registry.transition(transitionId);
        if (recordedSpace == bytes32(0)) revert UnknownTransition();
        if (recordedSpace != spaceId) revert WrongSpace();
        (address controller,,) = registry.spaceAuthorization(spaceId);
        if (msg.sender != controller) revert NotSpaceController();
        if (evidenceOf[transitionId] != bytes32(0)) revert AlreadyAttested();

        evidenceOf[transitionId] = evidenceCommitment;
        emit DeletionAttested(spaceId, transitionId, evidenceCommitment, controller);
    }
}
