// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {AgentMemoryStateRegistry} from "../src/reference/AgentMemoryStateRegistry.sol";
import {IAgentMemoryState} from "../src/interfaces/IAgentMemoryState.sol";
import {AuditGrant} from "../src/extensions/AuditGrant.sol";
import {DeletionAttestation} from "../src/extensions/DeletionAttestation.sol";
import {SpaceDescriptor} from "../src/extensions/SpaceDescriptor.sol";

/// @notice Deploys the core registry and the opt-in extensions.
/// @dev Experimental contracts (`MemoryMarket`) are intentionally excluded — they carry a
///      different trust model and should not sit behind the same published address as the
///      normative core.
///
///      The signer is supplied by the forge command line (`--account`, `--private-key`, or
///      a hardware-wallet flag). No key material lives in this repository, and none should
///      be added: see `docs/deployment.md`.
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        AgentMemoryStateRegistry registry = new AgentMemoryStateRegistry();
        IAgentMemoryState registryRef = IAgentMemoryState(address(registry));

        DeletionAttestation deletion = new DeletionAttestation(registryRef);
        SpaceDescriptor descriptor = new SpaceDescriptor(registryRef);
        AuditGrant auditGrant = new AuditGrant(registryRef);

        vm.stopBroadcast();

        console.log("chain id                :", block.chainid);
        console.log("AgentMemoryStateRegistry:", address(registry));
        console.log("DeletionAttestation     :", address(deletion));
        console.log("SpaceDescriptor         :", address(descriptor));
        console.log("AuditGrant              :", address(auditGrant));
        console.log("");
        console.log("domainSeparator (binds signatures to this chain + address):");
        console.logBytes32(registry.domainSeparator());
        console.log("");
        console.log("Golden typehashes, for comparison against test-vectors/v1.json:");
        console.logBytes32(registry.EXPERIENCE_DELTA_TYPEHASH());
        console.logBytes32(registry.MEMORY_STATE_TYPEHASH());
        console.logBytes32(registry.MEMORY_SPACE_TYPEHASH());
    }
}
