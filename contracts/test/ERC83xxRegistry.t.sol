// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC83xxRegistry} from "../src/ERC83xxRegistry.sol";
import {IERC83xx} from "../src/IERC83xx.sol";

contract ERC83xxRegistryTest is Test {
    ERC83xxRegistry internal reg;

    uint256 internal agentPk = 0xA11CE;
    address internal agent;
    uint256 internal otherPk = 0xB0B;
    address internal other;

    bytes32 internal constant SPACE = bytes32(uint256(0x1111));
    bytes32 internal constant SCHEMA = bytes32(uint256(0x3333));

    event ExperienceCommitted(
        bytes32 indexed spaceId,
        bytes32 indexed deltaId,
        bytes32 previousDelta,
        IERC83xx.MemoryType memoryType,
        address indexed agent,
        string uri
    );
    event MemoryRevoked(bytes32 indexed spaceId, bytes32 indexed deltaId, address by);
    event DeletionProven(bytes32 indexed spaceId, bytes32 indexed deltaId, bytes32 evidence);

    function setUp() public {
        reg = new ERC83xxRegistry();
        agent = vm.addr(agentPk);
        other = vm.addr(otherPk);
    }

    // --- helpers ---

    function _delta(bytes32 prior, bytes32 newCommit, bytes32 prevDelta, uint64 ts, uint64 ver)
        internal
        pure
        returns (IERC83xx.ExperienceDelta memory d)
    {
        d = IERC83xx.ExperienceDelta({
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
    }

    function _sign(uint256 pk, bytes32 deltaId) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, reg.digest(deltaId));
        return abi.encodePacked(r, s, v);
    }

    /// @dev Precompute signature (does external view calls) so a following
    ///      `vm.expectRevert` targets `commitDelta` itself, not the helper.
    function _sigFor(uint256 pk, IERC83xx.ExperienceDelta memory d)
        internal
        view
        returns (bytes memory)
    {
        return _sign(pk, reg.hashDelta(d));
    }

    function _commit(uint256 pk, IERC83xx.ExperienceDelta memory d, string memory uri)
        internal
        returns (bytes32 deltaId)
    {
        deltaId = reg.hashDelta(d);
        reg.commitDelta(d, uri, _sign(pk, deltaId));
    }

    // --- tests ---

    function test_GenesisCommit() public {
        IERC83xx.ExperienceDelta memory d =
            _delta(bytes32(0), bytes32(uint256(0xAA)), bytes32(0), 100, 1);
        bytes32 expectedId = reg.hashDelta(d);

        vm.expectEmit(true, true, true, true);
        emit ExperienceCommitted(
            SPACE, expectedId, bytes32(0), IERC83xx.MemoryType.TEXT, agent, "ipfs://a"
        );
        bytes32 deltaId = _commit(agentPk, d, "ipfs://a");

        assertEq(deltaId, expectedId, "deltaId");
        assertEq(reg.deltaAgent(deltaId), agent, "agent recovered");
        (bytes32 hId, bytes32 hCommit, uint64 hVer) = reg.head(SPACE);
        assertEq(hId, deltaId);
        assertEq(hCommit, bytes32(uint256(0xAA)));
        assertEq(hVer, 1);
    }

    function test_ChainsDeltas() public {
        IERC83xx.ExperienceDelta memory d1 =
            _delta(bytes32(0), bytes32(uint256(0xAA)), bytes32(0), 100, 1);
        bytes32 id1 = _commit(agentPk, d1, "ipfs://a");

        IERC83xx.ExperienceDelta memory d2 =
            _delta(bytes32(uint256(0xAA)), bytes32(uint256(0xBB)), id1, 200, 2);
        bytes32 id2 = _commit(agentPk, d2, "ipfs://b");

        (bytes32 hId,, uint64 hVer) = reg.head(SPACE);
        assertEq(hId, id2);
        assertEq(hVer, 2);
        assertTrue(id1 != id2);
    }

    function test_RevertWhen_EmptyUri() public {
        IERC83xx.ExperienceDelta memory d =
            _delta(bytes32(0), bytes32(uint256(0xAA)), bytes32(0), 100, 1);
        bytes memory sig = _sigFor(agentPk, d);
        vm.expectRevert(ERC83xxRegistry.EmptyUri.selector);
        reg.commitDelta(d, "", sig);
    }

    function test_RevertWhen_BadGenesisVersion() public {
        IERC83xx.ExperienceDelta memory d =
            _delta(bytes32(0), bytes32(uint256(0xAA)), bytes32(0), 100, 2); // version must be 1
        bytes memory sig = _sigFor(agentPk, d);
        vm.expectRevert(ERC83xxRegistry.BadGenesis.selector);
        reg.commitDelta(d, "ipfs://a", sig);
    }

    function test_RevertWhen_BadGenesisPrev() public {
        IERC83xx.ExperienceDelta memory d =
            _delta(bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xDEAD)), 100, 1);
        bytes memory sig = _sigFor(agentPk, d);
        vm.expectRevert(ERC83xxRegistry.BadGenesis.selector);
        reg.commitDelta(d, "ipfs://a", sig);
    }

    function test_RevertWhen_GenesisNonzeroPriorCommitment() public {
        IERC83xx.ExperienceDelta memory d =
            _delta(bytes32(uint256(0xDEAD)), bytes32(uint256(0xAA)), bytes32(0), 100, 1);
        bytes memory sig = _sigFor(agentPk, d);
        vm.expectRevert(ERC83xxRegistry.BadGenesis.selector);
        reg.commitDelta(d, "ipfs://a", sig);
    }

    function test_RevertWhen_AppendByOtherAgent() public {
        // agent owns the space via genesis; a different signer tries to hijack
        // the chain by extending the publicly visible head.
        bytes32 id1 =
            _commit(agentPk, _delta(bytes32(0), bytes32(uint256(0xAA)), bytes32(0), 100, 1), "ipfs://a");
        IERC83xx.ExperienceDelta memory d2 =
            _delta(bytes32(uint256(0xAA)), bytes32(uint256(0xBB)), id1, 200, 2);
        bytes memory sig = _sigFor(otherPk, d2);
        vm.expectRevert(ERC83xxRegistry.NotSpaceAgent.selector);
        reg.commitDelta(d2, "ipfs://b", sig);

        // the rightful agent can still extend
        _commit(agentPk, d2, "ipfs://b");
        (bytes32 hId,, uint64 hVer) = reg.head(SPACE);
        assertEq(hId, reg.hashDelta(d2));
        assertEq(hVer, 2);
    }

    function test_RevertWhen_BadChainLink() public {
        _commit(agentPk, _delta(bytes32(0), bytes32(uint256(0xAA)), bytes32(0), 100, 1), "ipfs://a");
        // wrong previousDelta
        IERC83xx.ExperienceDelta memory d2 =
            _delta(bytes32(uint256(0xAA)), bytes32(uint256(0xBB)), bytes32(uint256(0xBAD)), 200, 2);
        bytes memory sig = _sigFor(agentPk, d2);
        vm.expectRevert(ERC83xxRegistry.BadChainLink.selector);
        reg.commitDelta(d2, "ipfs://b", sig);
    }

    function test_RevertWhen_NonMonotonicTimestamp() public {
        bytes32 id1 =
            _commit(agentPk, _delta(bytes32(0), bytes32(uint256(0xAA)), bytes32(0), 100, 1), "ipfs://a");
        IERC83xx.ExperienceDelta memory d2 =
            _delta(bytes32(uint256(0xAA)), bytes32(uint256(0xBB)), id1, 50, 2); // ts < prev
        bytes memory sig = _sigFor(agentPk, d2);
        vm.expectRevert(ERC83xxRegistry.NonMonotonicTimestamp.selector);
        reg.commitDelta(d2, "ipfs://b", sig);
    }

    function test_RevertWhen_DuplicateDelta() public {
        IERC83xx.ExperienceDelta memory d =
            _delta(bytes32(0), bytes32(uint256(0xAA)), bytes32(0), 100, 1);
        _commit(agentPk, d, "ipfs://a");
        bytes memory sig = _sigFor(agentPk, d);
        vm.expectRevert(ERC83xxRegistry.DeltaAlreadyExists.selector);
        reg.commitDelta(d, "ipfs://a", sig);
    }

    function test_RevokeByAgent() public {
        bytes32 id =
            _commit(agentPk, _delta(bytes32(0), bytes32(uint256(0xAA)), bytes32(0), 100, 1), "ipfs://a");

        vm.expectEmit(true, true, false, true);
        emit MemoryRevoked(SPACE, id, agent);
        vm.prank(agent);
        reg.revoke(SPACE, id);

        assertTrue(reg.isRevoked(id));
    }

    function test_RevertWhen_RevokeByOther() public {
        bytes32 id =
            _commit(agentPk, _delta(bytes32(0), bytes32(uint256(0xAA)), bytes32(0), 100, 1), "ipfs://a");
        vm.prank(other);
        vm.expectRevert(ERC83xxRegistry.NotAuthorized.selector);
        reg.revoke(SPACE, id);
    }

    function test_RevertWhen_RevokeTwice() public {
        bytes32 id =
            _commit(agentPk, _delta(bytes32(0), bytes32(uint256(0xAA)), bytes32(0), 100, 1), "ipfs://a");
        vm.startPrank(agent);
        reg.revoke(SPACE, id);
        vm.expectRevert(ERC83xxRegistry.AlreadyRevoked.selector);
        reg.revoke(SPACE, id);
        vm.stopPrank();
    }

    function test_ProveDeletionRequiresRevokeFirst() public {
        bytes32 id =
            _commit(agentPk, _delta(bytes32(0), bytes32(uint256(0xAA)), bytes32(0), 100, 1), "ipfs://a");

        vm.startPrank(agent);
        vm.expectRevert(ERC83xxRegistry.NotRevoked.selector);
        reg.proveDeletion(SPACE, id, hex"1234");

        reg.revoke(SPACE, id);

        vm.expectEmit(true, true, false, true);
        emit DeletionProven(SPACE, id, keccak256(hex"1234"));
        reg.proveDeletion(SPACE, id, hex"1234");
        vm.stopPrank();

        assertTrue(reg.isDeletionProven(id));
    }

    function test_RevertWhen_RevokeUnknown() public {
        vm.expectRevert(ERC83xxRegistry.UnknownDelta.selector);
        reg.revoke(SPACE, bytes32(uint256(0xDEAD)));
    }
}
