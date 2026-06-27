// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC83xxRegistry} from "../src/ERC83xxRegistry.sol";
import {IERC83xx} from "../src/IERC83xx.sol";
import {MemoryMarket, IMemoryRegistry} from "../src/MemoryMarket.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract MemoryMarketTest is Test {
    ERC83xxRegistry internal reg;
    MemoryMarket internal market;
    MockERC20 internal token;

    uint256 internal agentPk = 0xA11CE;
    address internal agent;
    address internal buyer = address(0xB0B);
    address internal royaltyRecipient = address(0xF00D);

    bytes32 internal constant SPACE = bytes32(uint256(0x1111));
    bytes32 internal constant SCHEMA = bytes32(uint256(0x3333));
    bytes32 internal constant EMPTY_SPACE = bytes32(uint256(0x9999));

    function setUp() public {
        reg = new ERC83xxRegistry();
        market = new MemoryMarket(IMemoryRegistry(address(reg)));
        token = new MockERC20();
        agent = vm.addr(agentPk);

        // agent commits a genesis delta -> becomes owner of SPACE
        IERC83xx.ExperienceDelta memory d = IERC83xx.ExperienceDelta({
            spaceId: SPACE,
            priorMemoryCommitment: bytes32(0),
            newContentCommitment: bytes32(uint256(0xAA)),
            memoryType: IERC83xx.MemoryType.TEXT,
            schemaHash: SCHEMA,
            inferenceAnchor: bytes32(0),
            inputHash: bytes32(0),
            previousDelta: bytes32(0),
            timestamp: 100,
            version: 1
        });
        bytes32 id = reg.hashDelta(d);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(agentPk, reg.digest(id));
        reg.commitDelta(d, "ipfs://a", abi.encodePacked(r, s, v));

        token.mint(buyer, 1_000_000 ether);
        vm.prank(buyer);
        token.approve(address(market), type(uint256).max);
    }

    function test_OwnerIsHeadAgent() public view {
        assertEq(market.spaceOwner(SPACE), agent);
    }

    function test_ListByOwner() public {
        vm.prank(agent);
        market.list(SPACE, address(token), 1000, 30 days, 1000, royaltyRecipient);

        MemoryMarket.Listing memory l = market.getListing(SPACE);
        assertEq(l.seller, agent);
        assertEq(l.price, 1000);
        assertEq(l.duration, uint64(30 days));
        assertEq(l.royaltyBps, 1000);
        assertTrue(l.active);
    }

    function test_RevertWhen_ListByNonOwner() public {
        vm.prank(buyer);
        vm.expectRevert(MemoryMarket.NotSpaceOwner.selector);
        market.list(SPACE, address(token), 1000, 30 days, 0, address(0));
    }

    function test_RevertWhen_ListUncommittedSpace() public {
        vm.prank(agent);
        vm.expectRevert(MemoryMarket.SpaceNotCommitted.selector);
        market.list(EMPTY_SPACE, address(token), 1000, 30 days, 0, address(0));
    }

    function test_RevertWhen_ZeroDuration() public {
        vm.prank(agent);
        vm.expectRevert(MemoryMarket.ZeroDuration.selector);
        market.list(SPACE, address(token), 1000, 0, 0, address(0));
    }

    function test_RevertWhen_BadRoyalty() public {
        vm.prank(agent);
        vm.expectRevert(MemoryMarket.BadRoyalty.selector);
        market.list(SPACE, address(token), 1000, 30 days, 10_001, royaltyRecipient);
    }

    function test_PurchaseSplitsRoyalty() public {
        vm.prank(agent);
        market.list(SPACE, address(token), 1000, 30 days, 1000, royaltyRecipient); // 10%

        vm.prank(buyer);
        uint64 expiry = market.purchase(SPACE);

        assertEq(token.balanceOf(royaltyRecipient), 100);
        assertEq(token.balanceOf(agent), 900);
        assertEq(expiry, uint64(block.timestamp + 30 days));
        assertTrue(market.hasLicense(SPACE, buyer));
    }

    function test_PurchaseExtendsLicense() public {
        vm.prank(agent);
        market.list(SPACE, address(token), 0, 10 days, 0, address(0));

        vm.startPrank(buyer);
        uint64 e1 = market.purchase(SPACE);
        uint64 e2 = market.purchase(SPACE); // stacks on unexpired license
        vm.stopPrank();

        assertEq(e2, e1 + uint64(10 days));
    }

    function test_LicenseExpires() public {
        vm.prank(agent);
        market.list(SPACE, address(token), 0, 10 days, 0, address(0));
        vm.prank(buyer);
        market.purchase(SPACE);

        assertTrue(market.hasLicense(SPACE, buyer));
        vm.warp(block.timestamp + 11 days);
        assertFalse(market.hasLicense(SPACE, buyer));
    }

    function test_RevertWhen_PurchaseUnlisted() public {
        vm.prank(agent);
        market.list(SPACE, address(token), 1000, 30 days, 0, address(0));
        vm.prank(agent);
        market.unlist(SPACE);

        vm.prank(buyer);
        vm.expectRevert(MemoryMarket.NotListed.selector);
        market.purchase(SPACE);
    }
}
