// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IAgentMemoryState} from "../interfaces/IAgentMemoryState.sol";

/// @title DeletionAttestation
/// @notice Optional evidence registry. It does not claim universal data erasure.
contract DeletionAttestation {
    error UnknownTransition();
    error WrongSpace();
    error NotSpaceController();
    error AlreadyAttested();
    error EmptyEvidence();

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

    function attest(bytes32 spaceId, bytes32 transitionId, bytes calldata evidence) external {
        if (evidence.length == 0) revert EmptyEvidence();
        (bytes32 recordedSpace,,,) = registry.transition(transitionId);
        if (recordedSpace == bytes32(0)) revert UnknownTransition();
        if (recordedSpace != spaceId) revert WrongSpace();
        (address controller,,) = registry.spaceAuthorization(spaceId);
        if (msg.sender != controller) revert NotSpaceController();
        if (evidenceOf[transitionId] != bytes32(0)) revert AlreadyAttested();

        bytes32 evidenceCommitment = keccak256(evidence);
        evidenceOf[transitionId] = evidenceCommitment;
        emit DeletionAttested(spaceId, transitionId, evidenceCommitment, controller);
    }
}
