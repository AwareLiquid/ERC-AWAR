// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentMemoryStateRegistry} from "../../src/reference/AgentMemoryStateRegistry.sol";
import {DeletionAttestation} from "../../src/extensions/DeletionAttestation.sol";
import {IAgentMemoryState} from "../../src/interfaces/IAgentMemoryState.sol";

contract DeletionAttestationTest is Test {
    AgentMemoryStateRegistry internal registry;
    DeletionAttestation internal extension;
    address internal controller = address(0xA11CE);
    bytes32 internal constant SPACE_SALT = keccak256("space");
    bytes32 internal SPACE;
    bytes32 internal transitionId;

    function setUp() public {
        registry = new AgentMemoryStateRegistry();
        SPACE = registry.deriveSpaceId(controller, SPACE_SALT);
        extension = new DeletionAttestation(IAgentMemoryState(address(registry)));
        vm.startPrank(controller);
        registry.registerSpace(SPACE, controller, controller, SPACE_SALT, "");
        IAgentMemoryState.ExperienceDelta memory delta = IAgentMemoryState.ExperienceDelta({
            spaceId: SPACE,
            sequence: 1,
            prevStateRoot: bytes32(0),
            deltaCommitment: bytes32(uint256(1)),
            provenanceCommitment: bytes32(0),
            profileId: bytes32(uint256(2)),
            locatorCommitment: bytes32(uint256(3))
        });
        (transitionId,) = registry.commitTransition(delta, "");
        vm.stopPrank();
    }

    function test_ControllerCanAttestOnce() public {
        vm.prank(controller);
        extension.attest(SPACE, transitionId, hex"1234");
        assertEq(extension.evidenceOf(transitionId), keccak256(hex"1234"));

        vm.prank(controller);
        vm.expectRevert(DeletionAttestation.AlreadyAttested.selector);
        extension.attest(SPACE, transitionId, hex"5678");
    }

    function test_RevertWhen_UnauthorizedOrUnknown() public {
        vm.expectRevert(DeletionAttestation.NotSpaceController.selector);
        extension.attest(SPACE, transitionId, hex"1234");

        vm.prank(controller);
        vm.expectRevert(DeletionAttestation.UnknownTransition.selector);
        extension.attest(SPACE, bytes32(uint256(0xDEAD)), hex"1234");
    }
}
