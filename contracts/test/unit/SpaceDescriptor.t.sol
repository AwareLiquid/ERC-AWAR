// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentMemoryStateRegistry} from "../../src/reference/AgentMemoryStateRegistry.sol";
import {SpaceDescriptor} from "../../src/extensions/SpaceDescriptor.sol";
import {IAgentMemoryState} from "../../src/interfaces/IAgentMemoryState.sol";

contract SpaceDescriptorTest is Test {
    AgentMemoryStateRegistry internal registry;
    SpaceDescriptor internal extension;

    address internal controller = address(0xA11CE);
    address internal stranger = address(0xBEEF);

    bytes32 internal constant SPACE_SALT = keccak256("space");
    string internal constant URI = "https://awareness.market/spaces/demo/descriptor.json";
    bytes32 internal constant CONTENT_HASH = keccak256("descriptor-document");

    bytes32 internal SPACE;

    function setUp() public {
        registry = new AgentMemoryStateRegistry();
        SPACE = registry.deriveSpaceId(controller, SPACE_SALT);
        extension = new SpaceDescriptor(IAgentMemoryState(address(registry)));

        vm.prank(controller);
        registry.registerSpace(SPACE, controller, controller, SPACE_SALT, "");
    }

    function test_ControllerPublishesAndReplaces() public {
        vm.prank(controller);
        extension.publish(SPACE, URI, CONTENT_HASH);

        (string memory uri, bytes32 hash_, uint64 updatedAt) = extension.descriptorOf(SPACE);
        assertEq(uri, URI);
        assertEq(hash_, CONTENT_HASH);
        assertGt(updatedAt, 0);

        string memory nextUri = "https://awareness.market/spaces/demo/v2.json";
        bytes32 nextHash = keccak256("descriptor-document-v2");

        vm.prank(controller);
        extension.publish(SPACE, nextUri, nextHash);

        (uri, hash_,) = extension.descriptorOf(SPACE);
        assertEq(uri, nextUri);
        assertEq(hash_, nextHash);
    }

    /// A Space that never publishes stays exactly as opaque as core leaves it.
    function test_UnpublishedSpaceReadsEmpty() public view {
        (string memory uri, bytes32 hash_, uint64 updatedAt) = extension.descriptorOf(SPACE);
        assertEq(bytes(uri).length, 0);
        assertEq(hash_, bytes32(0));
        assertEq(updatedAt, 0);
    }

    function test_ControllerClears() public {
        vm.startPrank(controller);
        extension.publish(SPACE, URI, CONTENT_HASH);
        extension.clear(SPACE);
        vm.stopPrank();

        (string memory uri, bytes32 hash_,) = extension.descriptorOf(SPACE);
        assertEq(bytes(uri).length, 0);
        assertEq(hash_, bytes32(0));
    }

    function test_RevertWhen_NotController() public {
        vm.prank(stranger);
        vm.expectRevert(SpaceDescriptor.NotSpaceController.selector);
        extension.publish(SPACE, URI, CONTENT_HASH);
    }

    function test_RevertWhen_UnknownSpace() public {
        bytes32 unknown = keccak256("nope");
        vm.prank(controller);
        vm.expectRevert(SpaceDescriptor.UnknownSpace.selector);
        extension.publish(unknown, URI, CONTENT_HASH);
    }

    function test_RevertWhen_EmptyInputs() public {
        vm.startPrank(controller);
        vm.expectRevert(SpaceDescriptor.EmptyUri.selector);
        extension.publish(SPACE, "", CONTENT_HASH);

        vm.expectRevert(SpaceDescriptor.EmptyContentHash.selector);
        extension.publish(SPACE, URI, bytes32(0));
        vm.stopPrank();
    }

    function test_RevertWhen_ClearingNothing() public {
        vm.prank(controller);
        vm.expectRevert(SpaceDescriptor.NoDescriptor.selector);
        extension.clear(SPACE);
    }
}
