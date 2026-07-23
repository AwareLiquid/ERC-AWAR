// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {AgentMemoryStateRegistry} from "../src/reference/AgentMemoryStateRegistry.sol";
import {IAgentMemoryState} from "../src/interfaces/IAgentMemoryState.sol";
import {DeletionAttestation} from "../src/extensions/DeletionAttestation.sol";
import {ExperimentalMemoryMarket} from "../src/experimental/MemoryMarket.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice Non-production walkthrough of core, extension, and experimental layers.
contract Demo is Script {
    uint256 internal constant CONTROLLER_PK = 0xA11CE;
    bytes32 internal constant SPACE_SALT = keccak256("demo-space");

    function run() external {
        AgentMemoryStateRegistry registry = new AgentMemoryStateRegistry();
        DeletionAttestation deletion = new DeletionAttestation(IAgentMemoryState(address(registry)));
        ExperimentalMemoryMarket market =
            new ExperimentalMemoryMarket(IAgentMemoryState(address(registry)));
        MockERC20 token = new MockERC20();
        address controller = vm.addr(CONTROLLER_PK);
        address buyer = address(0xB0B);
        bytes32 spaceId = registry.deriveSpaceId(controller, SPACE_SALT);

        vm.prank(controller);
        registry.registerSpace(spaceId, controller, controller, SPACE_SALT, "");

        vm.prank(controller);
        (bytes32 firstId, bytes32 firstRoot) =
            registry.commitTransition(_delta(spaceId, 1, bytes32(0), 0xAA), "");
        vm.prank(controller);
        (bytes32 secondId,) = registry.commitTransition(_delta(spaceId, 2, firstRoot, 0xBB), "");
        console.log("core sequence committed", uint256(2));

        vm.prank(controller);
        market.list(spaceId, address(token), 1000, 30 days, 0, address(0));
        token.mint(buyer, 1000);
        vm.prank(buyer);
        token.approve(address(market), type(uint256).max);
        vm.prank(buyer);
        market.purchase(spaceId);
        console.log("experimental license purchased");

        vm.prank(controller);
        deletion.attest(spaceId, secondId, keccak256(hex"deadbeef"));
        console.log("deletion evidence committed");
        assert(firstId != secondId);
    }

    function _delta(bytes32 spaceId, uint64 sequence, bytes32 prevStateRoot, uint256 marker)
        internal
        pure
        returns (IAgentMemoryState.ExperienceDelta memory)
    {
        return IAgentMemoryState.ExperienceDelta({
            spaceId: spaceId,
            sequence: sequence,
            prevStateRoot: prevStateRoot,
            deltaCommitment: bytes32(marker),
            provenanceCommitment: bytes32(0),
            profileId: keccak256("demo-profile"),
            locatorCommitment: keccak256(abi.encode("private-locator", marker))
        });
    }
}
