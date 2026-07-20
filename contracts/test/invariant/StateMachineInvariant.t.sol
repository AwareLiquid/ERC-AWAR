// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {AgentMemoryStateRegistry} from "../../src/reference/AgentMemoryStateRegistry.sol";
import {IAgentMemoryState} from "../../src/interfaces/IAgentMemoryState.sol";

contract StateMachineHandler {
    AgentMemoryStateRegistry public immutable registry;
    bytes32 public constant SPACE_SALT = keccak256("invariant-space");
    bytes32 public constant PROFILE = keccak256("invariant-profile");
    bytes32 public immutable SPACE;
    bytes32 public modelStateRoot;
    bytes32 public modelTransitionId;
    uint64 public modelSequence;

    constructor(AgentMemoryStateRegistry registry_) {
        registry = registry_;
        SPACE = registry.deriveSpaceId(address(this), SPACE_SALT);
        registry.registerSpace(SPACE, address(this), address(this), SPACE_SALT, "");
    }

    function step(bytes32 deltaCommitment, bytes32 provenanceCommitment, bytes32 locatorCommitment)
        external
    {
        if (modelSequence == type(uint64).max) return;
        IAgentMemoryState.ExperienceDelta memory delta = IAgentMemoryState.ExperienceDelta({
            spaceId: SPACE,
            sequence: modelSequence + 1,
            prevStateRoot: modelStateRoot,
            deltaCommitment: deltaCommitment,
            provenanceCommitment: provenanceCommitment,
            profileId: PROFILE,
            locatorCommitment: locatorCommitment
        });
        (modelTransitionId, modelStateRoot) = registry.commitTransition(delta, "");
        modelSequence++;
    }
}

contract StateMachineInvariantTest is StdInvariant, Test {
    AgentMemoryStateRegistry internal registry;
    StateMachineHandler internal handler;

    function setUp() public {
        registry = new AgentMemoryStateRegistry();
        handler = new StateMachineHandler(registry);
        targetContract(address(handler));
    }

    function invariant_RegistryHeadMatchesModel() public view {
        (bytes32 transitionId, bytes32 stateRoot, uint64 sequence) = registry.head(handler.SPACE());
        assertEq(transitionId, handler.modelTransitionId());
        assertEq(stateRoot, handler.modelStateRoot());
        assertEq(sequence, handler.modelSequence());
    }
}
