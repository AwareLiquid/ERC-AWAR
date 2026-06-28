// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ERC83xxRegistry} from "../src/ERC83xxRegistry.sol";
import {IERC83xx} from "../src/IERC83xx.sol";
import {MemoryMarket, IMemoryRegistry} from "../src/MemoryMarket.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @title Demo — on-chain end-to-end lifecycle of an ERC-83xx memory space.
/// @notice Walks: commit genesis -> chain a second delta -> list on the market
///         -> buyer purchases a license -> compliance revoke -> proveDeletion.
///         Run with: `forge script script/Demo.s.sol -vv`
contract Demo is Script {
    uint256 internal constant AGENT_PK = 0xA11CE;
    bytes32 internal constant SPACE = bytes32(uint256(0x83C));
    bytes32 internal constant SCHEMA = bytes32(uint256(0x5C));

    function run() external {
        ERC83xxRegistry reg = new ERC83xxRegistry();
        MemoryMarket market = new MemoryMarket(IMemoryRegistry(address(reg)));
        MockERC20 token = new MockERC20();
        address agent = vm.addr(AGENT_PK);
        address buyer = address(0xB0B);

        // 1) Genesis Experience Delta (commitment only; payload stays off-chain).
        bytes32 id1 = _commit(reg, bytes32(0), bytes32(uint256(0xAA)), bytes32(0), 100, 1);
        console.log("1) genesis committed; agent recovered =", reg.deltaAgent(id1));

        // 2) Chain a second delta onto the same space.
        bytes32 id2 = _commit(reg, bytes32(uint256(0xAA)), bytes32(uint256(0xBB)), id1, 200, 2);
        (, , uint64 ver) = reg.head(SPACE);
        console.log("2) chained delta; head version =", ver);

        // 3) Owner (head delta's agent) lists the space for licensing.
        vm.prank(agent);
        market.list(SPACE, address(token), 1000, 30 days, 1000 /*10%*/, address(0xF00D));
        console.log("3) listed space: price 1000, 30d, 10% royalty");

        // 4) Buyer purchases a time-bounded license (ERC-20 settlement).
        token.mint(buyer, 1000);
        vm.prank(buyer);
        token.approve(address(market), type(uint256).max);
        vm.prank(buyer);
        uint64 expiry = market.purchase(SPACE);
        console.log("4) license purchased; expiry =", expiry);
        console.log("   royalty recipient balance =", token.balanceOf(address(0xF00D)));
        console.log("   seller balance            =", token.balanceOf(agent));

        // 5) Compliance flow: revoke on-chain, then prove off-chain deletion.
        vm.prank(agent);
        reg.revoke(SPACE, id2);
        vm.prank(agent);
        reg.proveDeletion(SPACE, id2, hex"deadbeef");
        console.log("5) revoked =", reg.isRevoked(id2), "| deletion proven =", reg.isDeletionProven(id2));
    }

    function _commit(
        ERC83xxRegistry reg,
        bytes32 prior,
        bytes32 newCommit,
        bytes32 prevDelta,
        uint64 ts,
        uint64 ver
    ) internal returns (bytes32 deltaId) {
        IERC83xx.ExperienceDelta memory d = IERC83xx.ExperienceDelta({
            spaceId: SPACE,
            priorMemoryCommitment: prior,
            newContentCommitment: newCommit,
            memoryType: IERC83xx.MemoryType.TEXT,
            schemaHash: SCHEMA,
            inferenceAnchor: bytes32(0),
            inputHash: bytes32(0),
            previousDelta: prevDelta,
            timestamp: ts,
            version: ver
        });
        deltaId = reg.hashDelta(d);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(AGENT_PK, reg.digest(deltaId));
        reg.commitDelta(d, "ipfs://demo", abi.encodePacked(r, s, v));
    }
}
