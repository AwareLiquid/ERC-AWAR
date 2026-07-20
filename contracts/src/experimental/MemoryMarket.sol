// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IAgentMemoryState} from "../interfaces/IAgentMemoryState.sol";

interface IERC20Settlement {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title ExperimentalMemoryMarket
/// @notice Non-normative licensing experiment intentionally separated from protocol core.
contract ExperimentalMemoryMarket {
    error NotSpaceController();
    error SpaceHasNoTransitions();
    error NotListed();
    error StaleListing();
    error ZeroDuration();
    error ZeroToken();
    error BadRoyalty();
    error TransferFailed();
    error ReentrantCall();

    uint16 public constant BPS_DENOMINATOR = 10_000;

    struct Listing {
        address seller;
        address token;
        uint256 price;
        uint64 duration;
        uint16 royaltyBps;
        address royaltyRecipient;
        bytes32 expectedStateRoot;
        bool active;
    }

    IAgentMemoryState public immutable registry;
    mapping(bytes32 spaceId => Listing) private _listings;
    mapping(bytes32 spaceId => mapping(address licensee => uint64 expiry)) private _licenseExpiry;
    uint256 private _locked = 1;

    event Listed(
        bytes32 indexed spaceId,
        address indexed seller,
        bytes32 indexed expectedStateRoot,
        address token,
        uint256 price,
        uint64 duration,
        uint16 royaltyBps,
        address royaltyRecipient
    );
    event Unlisted(bytes32 indexed spaceId, address indexed seller);
    event LicensePurchased(
        bytes32 indexed spaceId, address indexed licensee, uint256 paid, uint64 expiry
    );

    constructor(IAgentMemoryState registry_) {
        registry = registry_;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert ReentrantCall();
        _locked = 2;
        _;
        _locked = 1;
    }

    function list(
        bytes32 spaceId,
        address token,
        uint256 price,
        uint64 duration,
        uint16 royaltyBps,
        address royaltyRecipient
    ) external {
        if (duration == 0) revert ZeroDuration();
        if (price > 0 && token == address(0)) revert ZeroToken();
        if (royaltyBps > BPS_DENOMINATOR || (royaltyBps > 0 && royaltyRecipient == address(0))) {
            revert BadRoyalty();
        }
        (address controller,,) = registry.spaceAuthorization(spaceId);
        if (msg.sender != controller) revert NotSpaceController();
        (, bytes32 stateRoot, uint64 sequence) = registry.head(spaceId);
        if (sequence == 0) revert SpaceHasNoTransitions();

        _listings[spaceId] = Listing({
            seller: controller,
            token: token,
            price: price,
            duration: duration,
            royaltyBps: royaltyBps,
            royaltyRecipient: royaltyRecipient,
            expectedStateRoot: stateRoot,
            active: true
        });
        emit Listed(
            spaceId, controller, stateRoot, token, price, duration, royaltyBps, royaltyRecipient
        );
    }

    function unlist(bytes32 spaceId) external {
        Listing storage listing = _listings[spaceId];
        if (!listing.active) revert NotListed();
        if (msg.sender != listing.seller) revert NotSpaceController();
        listing.active = false;
        emit Unlisted(spaceId, msg.sender);
    }

    function purchase(bytes32 spaceId) external nonReentrant returns (uint64 expiry) {
        Listing storage listing = _listings[spaceId];
        if (!listing.active) revert NotListed();
        (address controller,,) = registry.spaceAuthorization(spaceId);
        (, bytes32 currentStateRoot,) = registry.head(spaceId);
        if (controller != listing.seller || currentStateRoot != listing.expectedStateRoot) {
            revert StaleListing();
        }

        uint256 price = listing.price;
        if (price > 0) {
            uint256 royalty = (price * listing.royaltyBps) / BPS_DENOMINATOR;
            if (royalty > 0) {
                _pull(listing.token, msg.sender, listing.royaltyRecipient, royalty);
            }
            _pull(listing.token, msg.sender, listing.seller, price - royalty);
        }

        uint64 currentExpiry = _licenseExpiry[spaceId][msg.sender];
        uint64 base = currentExpiry > block.timestamp ? currentExpiry : uint64(block.timestamp);
        expiry = base + listing.duration;
        _licenseExpiry[spaceId][msg.sender] = expiry;
        emit LicensePurchased(spaceId, msg.sender, price, expiry);
    }

    function hasLicense(bytes32 spaceId, address account) external view returns (bool) {
        return _licenseExpiry[spaceId][account] > block.timestamp;
    }

    function licenseExpiresAt(bytes32 spaceId, address account) external view returns (uint64) {
        return _licenseExpiry[spaceId][account];
    }

    function getListing(bytes32 spaceId) external view returns (Listing memory) {
        return _listings[spaceId];
    }

    function _pull(address token, address from, address to, uint256 amount) private {
        (bool success, bytes memory result) =
            token.call(abi.encodeCall(IERC20Settlement.transferFrom, (from, to, amount)));
        if (!success || (result.length != 0 && !abi.decode(result, (bool)))) {
            revert TransferFailed();
        }
    }
}
