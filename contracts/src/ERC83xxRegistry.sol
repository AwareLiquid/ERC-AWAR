// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IERC83xx} from "./IERC83xx.sol";
import {ECDSA} from "./ECDSA.sol";

/// @title ERC83xxRegistry — reference registry for Agent Experience Deltas.
/// @notice Append-only commitment log of agent memory state transitions.
///         Identity is bound via an EIP-712 signature (ERC-8004); the signing
///         agent is recovered from `signature`, so relayers can submit on an
///         agent's behalf. The EIP-712 domain pins `chainId` and the struct
///         pins `spaceId` + `previousDelta`, preventing cross-space and
///         cross-chain replay (SPEC §14).
contract ERC83xxRegistry is IERC83xx {
    // --- errors ---
    error EmptyUri();
    error DeltaAlreadyExists();
    error BadGenesis();
    error NotSpaceAgent();
    error BadChainLink();
    error NonMonotonicTimestamp();
    error UnknownDelta();
    error WrongSpace();
    error AlreadyRevoked();
    error NotRevoked();
    error NotAuthorized();

    // --- EIP-712 ---
    string private constant _NAME = "ERC83xx";
    string private constant _VERSION = "1";

    bytes32 private constant _EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    /// @dev Field order MUST match the ExperienceDelta struct order.
    bytes32 public constant EXPERIENCE_DELTA_TYPEHASH = keccak256(
        "ExperienceDelta(bytes32 spaceId,bytes32 priorMemoryCommitment,bytes32 newContentCommitment,uint8 memoryType,bytes32 schemaHash,bytes32 inferenceAnchor,bytes32 inputHash,bytes32 previousDelta,uint64 timestamp,uint64 version)"
    );

    uint256 private immutable _cachedChainId;
    bytes32 private immutable _cachedDomainSeparator;

    // --- storage ---
    struct Head {
        bytes32 deltaId;
        bytes32 commitment;
        uint64 version;
        uint64 timestamp;
    }

    struct DeltaRecord {
        bytes32 spaceId;
        address agent;
        uint64 timestamp;
        bool exists;
        bool revoked;
        bool deletionProven;
    }

    mapping(bytes32 spaceId => Head) private _heads;
    mapping(bytes32 deltaId => DeltaRecord) private _deltas;

    constructor() {
        _cachedChainId = block.chainid;
        _cachedDomainSeparator = _buildDomainSeparator();
    }

    // --- IERC83xx ---

    /// @inheritdoc IERC83xx
    function commitDelta(IERC83xx.ExperienceDelta calldata d, string calldata uri, bytes calldata signature)
        external
        returns (bytes32 deltaId)
    {
        if (bytes(uri).length == 0) revert EmptyUri();

        deltaId = hashDelta(d);
        if (_deltas[deltaId].exists) revert DeltaAlreadyExists();

        // Recover the ERC-8004 agent identity from the EIP-712 signature.
        address agent = ECDSA.recover(_digest(deltaId), signature);

        Head storage h = _heads[d.spaceId];
        if (h.version == 0) {
            // genesis: no prior delta, no prior commitment, version starts at 1
            if (d.previousDelta != bytes32(0) || d.version != 1 || d.priorMemoryCommitment != bytes32(0)) {
                revert BadGenesis();
            }
        } else {
            // linear append-only chain
            if (d.previousDelta != h.deltaId || d.version != h.version + 1) revert BadChainLink();
            if (d.timestamp < h.timestamp) revert NonMonotonicTimestamp();
            // append authorization: only the space's recorded agent may extend
            // the chain. Without this, anyone observing the public head could
            // hijack the space (and its market ownership) with a valid
            // signature of their own. Delegation / agent rotation is left to
            // an ERC-8264 rights / ERC-8312 mandate policy extension.
            if (agent != _deltas[h.deltaId].agent) revert NotSpaceAgent();
        }

        _deltas[deltaId] = DeltaRecord({
            spaceId: d.spaceId,
            agent: agent,
            timestamp: d.timestamp,
            exists: true,
            revoked: false,
            deletionProven: false
        });

        _heads[d.spaceId] = Head({
            deltaId: deltaId,
            commitment: d.newContentCommitment,
            version: d.version,
            timestamp: d.timestamp
        });

        emit ExperienceCommitted(d.spaceId, deltaId, d.previousDelta, d.memoryType, agent, uri);
    }

    /// @inheritdoc IERC83xx
    function head(bytes32 spaceId)
        external
        view
        returns (bytes32 deltaId, bytes32 commitment, uint64 version)
    {
        Head storage h = _heads[spaceId];
        return (h.deltaId, h.commitment, h.version);
    }

    /// @inheritdoc IERC83xx
    /// @dev Reference policy: only the recorded agent may revoke. A production
    ///      deployment would delegate this to an ERC-8264 rights / ERC-8312
    ///      mandate authority module.
    function revoke(bytes32 spaceId, bytes32 deltaId) external {
        DeltaRecord storage rec = _deltas[deltaId];
        if (!rec.exists) revert UnknownDelta();
        if (rec.spaceId != spaceId) revert WrongSpace();
        if (rec.revoked) revert AlreadyRevoked();
        if (msg.sender != rec.agent) revert NotAuthorized();

        rec.revoked = true;
        emit MemoryRevoked(spaceId, deltaId, msg.sender);
    }

    /// @inheritdoc IERC83xx
    /// @dev Compliance ordering (SPEC §9): a delta must be revoked on-chain
    ///      before a storage system attests off-chain payload / key removal.
    function proveDeletion(bytes32 spaceId, bytes32 deltaId, bytes calldata evidence) external {
        DeltaRecord storage rec = _deltas[deltaId];
        if (!rec.exists) revert UnknownDelta();
        if (rec.spaceId != spaceId) revert WrongSpace();
        if (!rec.revoked) revert NotRevoked();
        if (msg.sender != rec.agent) revert NotAuthorized();

        rec.deletionProven = true;
        emit DeletionProven(spaceId, deltaId, keccak256(evidence));
    }

    // --- views ---

    function deltaAgent(bytes32 deltaId) external view returns (address) {
        return _deltas[deltaId].agent;
    }

    function isRevoked(bytes32 deltaId) external view returns (bool) {
        return _deltas[deltaId].revoked;
    }

    function isDeletionProven(bytes32 deltaId) external view returns (bool) {
        return _deltas[deltaId].deletionProven;
    }

    function exists(bytes32 deltaId) external view returns (bool) {
        return _deltas[deltaId].exists;
    }

    // --- EIP-712 helpers ---

    /// @notice Content-addressed delta id = EIP-712 hashStruct(ExperienceDelta).
    function hashDelta(IERC83xx.ExperienceDelta calldata d) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                EXPERIENCE_DELTA_TYPEHASH,
                d.spaceId,
                d.priorMemoryCommitment,
                d.newContentCommitment,
                uint8(d.memoryType),
                d.schemaHash,
                d.inferenceAnchor,
                d.inputHash,
                d.previousDelta,
                d.timestamp,
                d.version
            )
        );
    }

    /// @notice EIP-712 signing digest for a given delta id.
    function digest(bytes32 deltaId) external view returns (bytes32) {
        return _digest(deltaId);
    }

    function domainSeparator() public view returns (bytes32) {
        return block.chainid == _cachedChainId ? _cachedDomainSeparator : _buildDomainSeparator();
    }

    function _digest(bytes32 structHash) private view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(
            abi.encode(
                _EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(_NAME)),
                keccak256(bytes(_VERSION)),
                block.chainid,
                address(this)
            )
        );
    }
}
