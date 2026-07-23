// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "../../src/ECDSA.sol";
import {AgentMemoryStateRegistry} from "../../src/reference/AgentMemoryStateRegistry.sol";
import {IAgentMemoryState} from "../../src/interfaces/IAgentMemoryState.sol";
import {IERC1271} from "../../src/interfaces/IERC1271.sol";

contract Mock1271Wallet is IERC1271 {
    mapping(bytes32 digest => bool approved) public approved;

    function approve(bytes32 digest) external {
        approved[digest] = true;
    }

    function isValidSignature(bytes32 digest, bytes calldata) external view returns (bytes4) {
        return approved[digest] ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }
}

contract Reverting1271Wallet is IERC1271 {
    function isValidSignature(bytes32, bytes calldata) external pure returns (bytes4) {
        revert("rejected");
    }
}

contract Malformed1271Wallet {
    fallback() external {
        assembly {
            mstore(0, shl(224, 0x1626ba7e))
            return(0, 4)
        }
    }
}

/// @dev Stand-in for the many EIP-7702 delegates that implement no signature policy
///      (batch executors, session-key managers, and so on).
contract NoPolicyDelegate {
    uint256 public value;
}

contract AgentMemoryStateRegistryTest is Test {
    AgentMemoryStateRegistry internal registry;

    uint256 internal controllerPk = 0xA11CE;
    uint256 internal otherPk = 0xB0B;
    address internal controller;
    address internal other;

    bytes32 internal constant SPACE_SALT = keccak256("space-salt");
    bytes32 internal constant OTHER_SPACE_SALT = keccak256("other-space-salt");
    bytes32 internal constant PROFILE = keccak256("example/profile/v1");
    bytes32 internal SPACE;
    bytes32 internal OTHER_SPACE;

    function setUp() public {
        registry = new AgentMemoryStateRegistry();
        controller = vm.addr(controllerPk);
        other = vm.addr(otherPk);
        SPACE = registry.deriveSpaceId(controller, SPACE_SALT);
        OTHER_SPACE = registry.deriveSpaceId(other, OTHER_SPACE_SALT);
        vm.prank(controller);
        registry.registerSpace(SPACE, controller, controller, SPACE_SALT, "");
    }

    function _delta(
        bytes32 spaceId,
        uint64 sequence,
        bytes32 prevStateRoot,
        bytes32 deltaCommitment,
        bytes32 locatorCommitment
    ) internal pure returns (IAgentMemoryState.ExperienceDelta memory) {
        return IAgentMemoryState.ExperienceDelta({
            spaceId: spaceId,
            sequence: sequence,
            prevStateRoot: prevStateRoot,
            deltaCommitment: deltaCommitment,
            provenanceCommitment: bytes32(0),
            profileId: PROFILE,
            locatorCommitment: locatorCommitment
        });
    }

    function _sign(uint256 privateKey, bytes32 structHash) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, registry.signingDigest(structHash));
        return abi.encodePacked(r, s, v);
    }

    function _commit(uint256 privateKey, IAgentMemoryState.ExperienceDelta memory delta)
        internal
        returns (bytes32 transitionId, bytes32 nextStateRoot)
    {
        transitionId = registry.hashExperienceDelta(delta);
        return registry.commitTransition(delta, _sign(privateKey, transitionId));
    }

    function test_GenesisAdvancesStateRoot() public {
        IAgentMemoryState.ExperienceDelta memory delta =
            _delta(SPACE, 1, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)));
        (bytes32 transitionId, bytes32 nextStateRoot) = _commit(controllerPk, delta);

        assertEq(transitionId, registry.hashExperienceDelta(delta));
        assertEq(nextStateRoot, registry.computeNextStateRoot(bytes32(0), transitionId));
        (bytes32 headId, bytes32 stateRoot, uint64 sequence) = registry.head(SPACE);
        assertEq(headId, transitionId);
        assertEq(stateRoot, nextStateRoot);
        assertEq(sequence, 1);
    }

    function test_ChainsUsingPreviousStateRoot() public {
        (, bytes32 root1) = _commit(
            controllerPk,
            _delta(SPACE, 1, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)))
        );
        (, bytes32 root2) = _commit(
            controllerPk, _delta(SPACE, 2, root1, bytes32(uint256(0xCC)), bytes32(uint256(0xDD)))
        );
        assertTrue(root2 != root1);
        (, bytes32 stateRoot, uint64 sequence) = registry.head(SPACE);
        assertEq(stateRoot, root2);
        assertEq(sequence, 2);
    }

    function test_RevertWhen_PreviousStateRootIsWrong() public {
        (, bytes32 currentRoot) = _commit(
            controllerPk,
            _delta(SPACE, 1, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)))
        );
        IAgentMemoryState.ExperienceDelta memory bad = _delta(
            SPACE, 2, bytes32(uint256(0xDEAD)), bytes32(uint256(0xCC)), bytes32(uint256(0xDD))
        );
        bytes memory signature = _sign(controllerPk, registry.hashExperienceDelta(bad));
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentMemoryStateRegistry.BadPreviousState.selector,
                currentRoot,
                bytes32(uint256(0xDEAD))
            )
        );
        registry.commitTransition(bad, signature);
    }

    function test_RevertWhen_SequenceSkips() public {
        IAgentMemoryState.ExperienceDelta memory bad =
            _delta(SPACE, 2, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)));
        bytes memory signature = _sign(controllerPk, registry.hashExperienceDelta(bad));
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentMemoryStateRegistry.BadSequence.selector, uint64(1), uint64(2)
            )
        );
        registry.commitTransition(bad, signature);
    }

    function test_RevertWhen_RequiredCommitmentsAreZero() public {
        IAgentMemoryState.ExperienceDelta memory delta =
            _delta(SPACE, 1, bytes32(0), bytes32(0), bytes32(uint256(0xBB)));
        vm.prank(controller);
        vm.expectRevert(AgentMemoryStateRegistry.ZeroDeltaCommitment.selector);
        registry.commitTransition(delta, "");

        delta.deltaCommitment = bytes32(uint256(1));
        delta.profileId = bytes32(0);
        vm.prank(controller);
        vm.expectRevert(AgentMemoryStateRegistry.ZeroProfileId.selector);
        registry.commitTransition(delta, "");
    }

    function test_RevertWhen_OtherSignerAttemptsSpaceTakeover() public {
        IAgentMemoryState.ExperienceDelta memory delta =
            _delta(SPACE, 1, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)));
        bytes32 transitionId = registry.hashExperienceDelta(delta);
        bytes memory signature = _sign(otherPk, transitionId);
        vm.expectRevert(AgentMemoryStateRegistry.InvalidAuthorization.selector);
        registry.commitTransition(delta, signature);
    }

    function test_RevertWhen_RelayerMutatesLocatorCommitment() public {
        IAgentMemoryState.ExperienceDelta memory signedDelta =
            _delta(SPACE, 1, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)));
        bytes memory signature = _sign(controllerPk, registry.hashExperienceDelta(signedDelta));
        signedDelta.locatorCommitment = bytes32(uint256(0xBAD));

        vm.expectRevert(AgentMemoryStateRegistry.InvalidAuthorization.selector);
        registry.commitTransition(signedDelta, signature);
    }

    function test_ControllerCanRotateAuthorizer() public {
        vm.prank(controller);
        registry.updateSpaceAuthorization(SPACE, controller, other, "");
        (, address authorizer, uint64 nonce) = registry.spaceAuthorization(SPACE);
        assertEq(authorizer, other);
        assertEq(nonce, 1);

        IAgentMemoryState.ExperienceDelta memory delta =
            _delta(SPACE, 1, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)));
        bytes32 transitionId = registry.hashExperienceDelta(delta);
        bytes memory oldSignature = _sign(controllerPk, transitionId);
        vm.expectRevert(AgentMemoryStateRegistry.InvalidAuthorization.selector);
        registry.commitTransition(delta, oldSignature);
        registry.commitTransition(delta, _sign(otherPk, transitionId));
    }

    function test_RelayedRegistrationRequiresControllerSignature() public {
        bytes32 registrationId = registry.hashSpaceRegistration(OTHER_SPACE, other, other);
        registry.registerSpace(
            OTHER_SPACE, other, other, OTHER_SPACE_SALT, _sign(otherPk, registrationId)
        );
        (address storedController, address authorizer,) = registry.spaceAuthorization(OTHER_SPACE);
        assertEq(storedController, other);
        assertEq(authorizer, other);
    }

    function test_ERC1271AuthorizerCanRegisterAndCommit() public {
        Mock1271Wallet wallet = new Mock1271Wallet();
        bytes32 walletSalt = keccak256("wallet-space-salt");
        bytes32 walletSpace = registry.deriveSpaceId(address(wallet), walletSalt);
        bytes32 registrationId =
            registry.hashSpaceRegistration(walletSpace, address(wallet), address(wallet));
        wallet.approve(registry.signingDigest(registrationId));
        registry.registerSpace(walletSpace, address(wallet), address(wallet), walletSalt, hex"01");

        IAgentMemoryState.ExperienceDelta memory delta =
            _delta(walletSpace, 1, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)));
        bytes32 transitionId = registry.hashExperienceDelta(delta);
        wallet.approve(registry.signingDigest(transitionId));
        registry.commitTransition(delta, hex"02");

        (bytes32 headId,, uint64 sequence) = registry.head(walletSpace);
        assertEq(headId, transitionId);
        assertEq(sequence, 1);
    }

    function test_RevertWhen_ERC1271ValidationFails() public {
        Mock1271Wallet wrongMagic = new Mock1271Wallet();
        Reverting1271Wallet revertingWallet = new Reverting1271Wallet();
        Malformed1271Wallet malformedWallet = new Malformed1271Wallet();

        _expectInvalidContractRegistration(address(wrongMagic), keccak256("wrong-magic"));
        _expectInvalidContractRegistration(address(revertingWallet), keccak256("reverting"));
        _expectInvalidContractRegistration(address(malformedWallet), keccak256("malformed"));
    }

    function test_RevertWhen_ECDSASignatureHasHighS() public {
        IAgentMemoryState.ExperienceDelta memory delta =
            _delta(SPACE, 1, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)));
        bytes32 digest = registry.signingDigest(registry.hashExperienceDelta(delta));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(controllerPk, digest);
        uint256 curveOrder = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes32 highS = bytes32(curveOrder - uint256(s));
        uint8 flippedV = v == 27 ? 28 : 27;

        vm.expectRevert(ECDSA.InvalidSignatureS.selector);
        registry.commitTransition(delta, abi.encodePacked(r, highS, flippedV));
    }

    function test_RevertWhen_SignatureIsReplayedToAnotherRegistry() public {
        AgentMemoryStateRegistry secondRegistry = new AgentMemoryStateRegistry();
        vm.prank(controller);
        secondRegistry.registerSpace(SPACE, controller, controller, SPACE_SALT, "");

        IAgentMemoryState.ExperienceDelta memory delta =
            _delta(SPACE, 1, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)));
        bytes memory firstRegistrySignature =
            _sign(controllerPk, registry.hashExperienceDelta(delta));

        vm.expectRevert(AgentMemoryStateRegistry.InvalidAuthorization.selector);
        secondRegistry.commitTransition(delta, firstRegistrySignature);
    }

    function test_ConfigNoncePreventsAuthorizationReplay() public {
        bytes32 authorizationId = registry.hashSpaceAuthorization(SPACE, controller, other, 1);
        bytes memory signature = _sign(controllerPk, authorizationId);
        registry.updateSpaceAuthorization(SPACE, controller, other, signature);

        vm.expectRevert(AgentMemoryStateRegistry.InvalidAuthorization.selector);
        registry.updateSpaceAuthorization(SPACE, controller, other, signature);
    }

    function test_RecordsChainObservationTime() public {
        vm.warp(1_700_000_000);
        IAgentMemoryState.ExperienceDelta memory delta =
            _delta(SPACE, 1, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)));
        (bytes32 transitionId,) = _commit(controllerPk, delta);
        (bytes32 spaceId,, uint64 sequence, uint64 committedAt) = registry.transition(transitionId);
        assertEq(spaceId, SPACE);
        assertEq(sequence, 1);
        assertEq(committedAt, 1_700_000_000);
    }

    function test_RevertWhen_DuplicateTransition() public {
        IAgentMemoryState.ExperienceDelta memory delta =
            _delta(SPACE, 1, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)));
        _commit(controllerPk, delta);

        // Different space changes the id, so a true duplicate can only replay in the original
        // position; that replay is rejected by sequence before storage can be overwritten.
        IAgentMemoryState.ExperienceDelta memory replay =
            _delta(SPACE, 1, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)));
        bytes memory signature = _sign(controllerPk, registry.hashExperienceDelta(replay));
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentMemoryStateRegistry.BadSequence.selector, uint64(2), uint64(1)
            )
        );
        registry.commitTransition(replay, signature);
    }

    function test_RevertWhen_SpaceIdIsNotControllerDerived() public {
        bytes32 expected = registry.deriveSpaceId(other, OTHER_SPACE_SALT);
        vm.prank(other);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentMemoryStateRegistry.InvalidSpaceId.selector, expected, bytes32(uint256(0xBAD))
            )
        );
        registry.registerSpace(bytes32(uint256(0xBAD)), other, other, OTHER_SPACE_SALT, "");
    }

    /// An EOA delegated under EIP-7702 carries code (`0xef0100 || delegate`). Branching on
    /// code presence alone would route it into ERC-1271 and revert whenever the delegate
    /// implements no signature policy, locking such users out entirely.
    function test_EIP7702DelegatedEOAWithoutPolicyFallsBackToECDSA() public {
        uint256 pk = 0x77021;
        address delegated = vm.addr(pk);

        NoPolicyDelegate delegate = new NoPolicyDelegate();
        vm.etch(delegated, abi.encodePacked(hex"ef0100", address(delegate)));
        assertGt(delegated.code.length, 0, "delegated account must carry code");

        bytes32 salt = keccak256("7702-no-policy");
        bytes32 spaceId = registry.deriveSpaceId(delegated, salt);
        vm.prank(delegated);
        registry.registerSpace(spaceId, delegated, delegated, salt, "");

        IAgentMemoryState.ExperienceDelta memory delta =
            _delta(spaceId, 1, bytes32(0), bytes32(uint256(0xAA)), bytes32(uint256(0xBB)));
        bytes32 expectedId = registry.hashExperienceDelta(delta);

        // Relayed by a third party, authorized by the delegated account's key.
        (bytes32 transitionId,) = registry.commitTransition(delta, _sign(pk, expectedId));
        assertEq(transitionId, expectedId);
    }

    /// A delegate that *does* implement a policy still gets to enforce it: an opaque,
    /// non-ECDSA signature is accepted only through ERC-1271.
    function test_EIP7702DelegatedEOAWithPolicyUsesERC1271() public {
        uint256 pk = 0x77022;
        address delegated = vm.addr(pk);

        Mock1271Wallet wallet = new Mock1271Wallet();
        vm.etch(delegated, address(wallet).code);

        bytes32 salt = keccak256("7702-with-policy");
        bytes32 spaceId = registry.deriveSpaceId(delegated, salt);
        vm.prank(delegated);
        registry.registerSpace(spaceId, delegated, delegated, salt, "");

        IAgentMemoryState.ExperienceDelta memory delta =
            _delta(spaceId, 1, bytes32(0), bytes32(uint256(0xCC)), bytes32(uint256(0xDD)));
        bytes32 expectedId = registry.hashExperienceDelta(delta);

        Mock1271Wallet(delegated).approve(registry.signingDigest(expectedId));

        (bytes32 transitionId,) = registry.commitTransition(delta, hex"c0ffee");
        assertEq(transitionId, expectedId);
    }

    function _expectInvalidContractRegistration(address wallet, bytes32 salt) internal {
        bytes32 spaceId = registry.deriveSpaceId(wallet, salt);
        vm.expectRevert(AgentMemoryStateRegistry.InvalidAuthorization.selector);
        registry.registerSpace(spaceId, wallet, wallet, salt, hex"01");
    }
}
