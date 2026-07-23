// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IAgentMemoryState} from "../interfaces/IAgentMemoryState.sol";

/// @title SpaceDescriptor
/// @notice Optional, controller-published description of what a Space *is*.
/// @dev It never describes what a Space contains. Publishing is voluntary: a Space that
///      never publishes remains exactly as opaque as the core registry leaves it. The
///      descriptor is public by construction, so controllers must not reference private
///      payloads, locators, salts, or keys from it.
///
///      The descriptor document is expected to carry the domain and purpose of the Space
///      and the profile vocabulary needed to interpret its `profileId` values. The
///      contract stores only a URI and a content hash; it does not fetch, validate, or
///      guarantee availability of the document.
contract SpaceDescriptor {
    error UnknownSpace();
    error NotSpaceController();
    error EmptyUri();
    error EmptyContentHash();
    error NoDescriptor();

    struct Descriptor {
        string uri;
        bytes32 contentHash;
        uint64 updatedAt;
    }

    IAgentMemoryState public immutable registry;

    mapping(bytes32 spaceId => Descriptor descriptor) private _descriptors;

    event DescriptorPublished(
        bytes32 indexed spaceId, address indexed controller, bytes32 indexed contentHash, string uri
    );

    event DescriptorCleared(bytes32 indexed spaceId, address indexed controller);

    constructor(IAgentMemoryState registry_) {
        registry = registry_;
    }

    /// @notice Publish or replace the public descriptor for a Space.
    /// @param contentHash Hash of the descriptor document, so a reader can detect
    ///        substitution at the URI. It is not verified on chain.
    function publish(bytes32 spaceId, string calldata uri, bytes32 contentHash) external {
        if (bytes(uri).length == 0) revert EmptyUri();
        if (contentHash == bytes32(0)) revert EmptyContentHash();

        address controller = _controllerOf(spaceId);
        if (msg.sender != controller) revert NotSpaceController();

        _descriptors[spaceId] =
            Descriptor({uri: uri, contentHash: contentHash, updatedAt: uint64(block.timestamp)});

        emit DescriptorPublished(spaceId, controller, contentHash, uri);
    }

    /// @notice Withdraw a previously published descriptor.
    /// @dev Clearing removes the pointer, not the history: prior events remain on chain.
    function clear(bytes32 spaceId) external {
        address controller = _controllerOf(spaceId);
        if (msg.sender != controller) revert NotSpaceController();
        if (_descriptors[spaceId].contentHash == bytes32(0)) revert NoDescriptor();

        delete _descriptors[spaceId];

        emit DescriptorCleared(spaceId, controller);
    }

    function descriptorOf(bytes32 spaceId)
        external
        view
        returns (string memory uri, bytes32 contentHash, uint64 updatedAt)
    {
        Descriptor storage d = _descriptors[spaceId];
        return (d.uri, d.contentHash, d.updatedAt);
    }

    function _controllerOf(bytes32 spaceId) internal view returns (address controller) {
        (controller,,) = registry.spaceAuthorization(spaceId);
        if (controller == address(0)) revert UnknownSpace();
    }
}
