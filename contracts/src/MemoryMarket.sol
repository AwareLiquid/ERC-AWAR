// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @dev Minimal ERC-20 surface used for settlement (SPEC §10 reuses the
///      commerce layer + ERC-20). Kept inline to stay dependency-free.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @dev The subset of the registry the market needs to resolve space ownership.
interface IMemoryRegistry {
    function head(bytes32 spaceId)
        external
        view
        returns (bytes32 deltaId, bytes32 commitment, uint64 version);

    function deltaAgent(bytes32 deltaId) external view returns (address);
}

/// @title MemoryMarket — reference licensing market for Experience-Delta spaces.
/// @notice An asset is a Memory Space (SPEC §10). The space owner — the agent
///         who committed the current head delta — lists a time-bounded license
///         priced in an ERC-20. Buyers purchase access; settlement splits an
///         optional royalty to a recipient (e.g. an upstream memory author),
///         forming the "memory -> inference -> new memory" provenance chain.
contract MemoryMarket {
    error NotSpaceOwner();
    error SpaceNotCommitted();
    error NotListed();
    error ZeroDuration();
    error BadRoyalty();
    error TransferFailed();

    uint16 public constant BPS_DENOMINATOR = 10_000;

    struct Listing {
        address seller; // resolved space owner at list time
        address token; // ERC-20 settlement token
        uint256 price; // price per license period
        uint64 duration; // license length in seconds
        uint16 royaltyBps; // share routed to royaltyRecipient
        address royaltyRecipient;
        bool active;
    }

    IMemoryRegistry public immutable registry;

    mapping(bytes32 spaceId => Listing) private _listings;
    mapping(bytes32 spaceId => mapping(address licensee => uint64 expiry)) private _licenseExpiry;

    event Listed(
        bytes32 indexed spaceId,
        address indexed seller,
        address token,
        uint256 price,
        uint64 duration,
        uint16 royaltyBps,
        address royaltyRecipient
    );
    event Unlisted(bytes32 indexed spaceId, address indexed seller);
    event LicensePurchased(
        bytes32 indexed spaceId,
        address indexed licensee,
        uint256 paid,
        uint64 expiry
    );

    constructor(IMemoryRegistry registry_) {
        registry = registry_;
    }

    /// @notice Owner of a space = agent who committed its current head delta.
    function spaceOwner(bytes32 spaceId) public view returns (address) {
        (bytes32 deltaId,,) = registry.head(spaceId);
        if (deltaId == bytes32(0)) revert SpaceNotCommitted();
        return registry.deltaAgent(deltaId);
    }

    /// @notice List (or update) a space for time-bounded licensing.
    function list(
        bytes32 spaceId,
        address token,
        uint256 price,
        uint64 duration,
        uint16 royaltyBps,
        address royaltyRecipient
    ) external {
        if (duration == 0) revert ZeroDuration();
        if (royaltyBps > BPS_DENOMINATOR) revert BadRoyalty();
        if (msg.sender != spaceOwner(spaceId)) revert NotSpaceOwner();

        _listings[spaceId] = Listing({
            seller: msg.sender,
            token: token,
            price: price,
            duration: duration,
            royaltyBps: royaltyBps,
            royaltyRecipient: royaltyRecipient,
            active: true
        });

        emit Listed(spaceId, msg.sender, token, price, duration, royaltyBps, royaltyRecipient);
    }

    /// @notice Remove a listing (only the seller).
    function unlist(bytes32 spaceId) external {
        Listing storage l = _listings[spaceId];
        if (!l.active) revert NotListed();
        if (msg.sender != l.seller) revert NotSpaceOwner();
        l.active = false;
        emit Unlisted(spaceId, msg.sender);
    }

    /// @notice Purchase / extend a license. Caller must have approved `price`.
    /// @return expiry The licensee's new expiry timestamp.
    function purchase(bytes32 spaceId) external returns (uint64 expiry) {
        Listing storage l = _listings[spaceId];
        if (!l.active) revert NotListed();

        uint256 price = l.price;
        if (price > 0) {
            uint256 royalty = (price * l.royaltyBps) / BPS_DENOMINATOR;
            if (royalty > 0) {
                _pull(l.token, msg.sender, l.royaltyRecipient, royalty);
            }
            _pull(l.token, msg.sender, l.seller, price - royalty);
        }

        uint64 base =
            _licenseExpiry[spaceId][msg.sender] > block.timestamp
                ? _licenseExpiry[spaceId][msg.sender]
                : uint64(block.timestamp);
        expiry = base + l.duration;
        _licenseExpiry[spaceId][msg.sender] = expiry;

        emit LicensePurchased(spaceId, msg.sender, price, expiry);
    }

    function hasLicense(bytes32 spaceId, address who) external view returns (bool) {
        return _licenseExpiry[spaceId][who] > block.timestamp;
    }

    function licenseExpiresAt(bytes32 spaceId, address who) external view returns (uint64) {
        return _licenseExpiry[spaceId][who];
    }

    function getListing(bytes32 spaceId) external view returns (Listing memory) {
        return _listings[spaceId];
    }

    function _pull(address token, address from, address to, uint256 amount) private {
        bool ok = IERC20(token).transferFrom(from, to, amount);
        if (!ok) revert TransferFailed();
    }
}
