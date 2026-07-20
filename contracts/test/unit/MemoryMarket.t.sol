// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentMemoryStateRegistry} from "../../src/reference/AgentMemoryStateRegistry.sol";
import {IAgentMemoryState} from "../../src/interfaces/IAgentMemoryState.sol";
import {ExperimentalMemoryMarket} from "../../src/experimental/MemoryMarket.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract ExperimentalMemoryMarketTest is Test {
    AgentMemoryStateRegistry internal registry;
    ExperimentalMemoryMarket internal market;
    MockERC20 internal token;
    address internal controller = address(0xA11CE);
    address internal buyer = address(0xB0B);
    address internal royaltyRecipient = address(0xF00D);
    bytes32 internal constant SPACE_SALT = keccak256("market-space");
    bytes32 internal SPACE;

    function setUp() public {
        registry = new AgentMemoryStateRegistry();
        SPACE = registry.deriveSpaceId(controller, SPACE_SALT);
        market = new ExperimentalMemoryMarket(IAgentMemoryState(address(registry)));
        token = new MockERC20();

        vm.startPrank(controller);
        registry.registerSpace(SPACE, controller, controller, SPACE_SALT, "");
        registry.commitTransition(_delta(1, bytes32(0), bytes32(uint256(1))), "");
        vm.stopPrank();

        token.mint(buyer, 1_000_000);
        vm.prank(buyer);
        token.approve(address(market), type(uint256).max);
    }

    function _delta(uint64 sequence, bytes32 prevStateRoot, bytes32 commitment)
        internal
        view
        returns (IAgentMemoryState.ExperienceDelta memory)
    {
        return IAgentMemoryState.ExperienceDelta({
            spaceId: SPACE,
            sequence: sequence,
            prevStateRoot: prevStateRoot,
            deltaCommitment: commitment,
            provenanceCommitment: bytes32(0),
            profileId: bytes32(uint256(2)),
            locatorCommitment: bytes32(uint256(3))
        });
    }

    function _list(uint256 price) internal {
        vm.prank(controller);
        market.list(SPACE, address(token), price, 30 days, 1000, royaltyRecipient);
    }

    function test_ControllerListsAndBuyerPurchases() public {
        _list(1000);
        vm.prank(buyer);
        uint64 expiry = market.purchase(SPACE);
        assertEq(token.balanceOf(royaltyRecipient), 100);
        assertEq(token.balanceOf(controller), 900);
        assertEq(expiry, uint64(block.timestamp + 30 days));
        assertTrue(market.hasLicense(SPACE, buyer));
    }

    function test_RevertWhen_NonControllerLists() public {
        vm.prank(buyer);
        vm.expectRevert(ExperimentalMemoryMarket.NotSpaceController.selector);
        market.list(SPACE, address(token), 1000, 30 days, 0, address(0));
    }

    function test_RevertWhen_StateChangedAfterListing() public {
        _list(1000);
        (, bytes32 stateRoot,) = registry.head(SPACE);
        vm.prank(controller);
        registry.commitTransition(_delta(2, stateRoot, bytes32(uint256(4))), "");

        vm.prank(buyer);
        vm.expectRevert(ExperimentalMemoryMarket.StaleListing.selector);
        market.purchase(SPACE);
    }

    function test_RevertWhen_ControllerChangedAfterListing() public {
        _list(1000);
        vm.prank(controller);
        registry.updateSpaceAuthorization(SPACE, address(0xCAFE), controller, "");

        vm.prank(buyer);
        vm.expectRevert(ExperimentalMemoryMarket.StaleListing.selector);
        market.purchase(SPACE);
    }

    function test_FreeLicenseExtendsAndExpires() public {
        _list(0);
        vm.startPrank(buyer);
        uint64 first = market.purchase(SPACE);
        uint64 second = market.purchase(SPACE);
        vm.stopPrank();
        assertEq(second, first + uint64(30 days));
        vm.warp(uint256(second) + 1);
        assertFalse(market.hasLicense(SPACE, buyer));
    }
}
