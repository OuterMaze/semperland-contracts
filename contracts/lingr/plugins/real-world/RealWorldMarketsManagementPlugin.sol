// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../../economy/IEconomy.sol";
import "../base/NFTDefiningPlugin.sol";
import "../base/NFTMintingPlugin.sol";
import "../base/NFTBurningPlugin.sol";
import "../base/NFTTransferWatcherPlugin.sol";

/**
 * This plug-in provides features to mint markets and
 * maintain them. Markets are maintained by their key
 * and their hashed key, depending on the need. The
 * same applies to the addresses that are used: they
 * are hashed. It is of total responsibility of the
 * users to remember which actual addresses are used,
 * since they'll not be recoverable from this contract.
 */
contract RealWorldMarketsManagementPlugin is NFTDefiningPlugin, NFTMintingPlugin, NFTBurningPlugin,
                                             NFTTransferWatcherPlugin {
    /**
     * A market is defined by this structure (this
     * one is subject to changes and improvements).
     */
    struct Market {
        /**
         * Having an owner also serves to marks the market as existing.
         * Aside from owning the market itself, it can do anything the
         * managers can do (Also: ERC1155 operators can operate on the
         * market instances as their owners could).
         */
        address owner;

        /**
         * The manager of this market. It can perform management
         * operations on the market.
         */
        bytes32 manager;

        /**
         * A description for the market.
         */
        string title;
    }

    /**
     * Markets are defined by this type.
     */
    uint256 public marketType;

    /**
     * The image used for markets' metadata.
     */
    string public marketImage;

    /**
     * This permission allows accounts to transfer markets to
     * (and mint markets for) a brand. It also allows them to
     * manage the markets' metadata, per-market manager, and
     * per-market signers (market managers can only manage
     * the signers in this contract).
     */
    bytes32 constant BRAND_MANAGE_MARKETS = keccak256("Plugins::RealWorldMarkets::Brand::Markets::Manage");

    /**
     * The hash of the 0 address.
     */
    bytes32 constant ZERO_ADDRESS_HASH = keccak256(abi.encodePacked(address(0)));

    /**
     * The image used for colliding markets' metadata.
     */
    string public collidingMarketImage;

    /**
     * The mapping of markets is maintained here,
     * but the key for this mapping is *NOT* the
     * id. Instead, it is keccak256(id). This, to
     * give the appearance of "decoupling" the
     * calls to manage the market from the calls
     * to own or transfer the market (this means:
     * the market ownership is of public knowledge
     * but the market management should be more
     * difficult to track).
     */
    mapping(bytes32 => Market) markets;

    /**
     * A colliding market is a market with different
     * id of another market (and not colliding in the
     * NFTs domain) but whose hash is nevertheless
     * finding a collision in the markets mapping
     * (this, since the mapping do their job hashing
     * the hashed id again). Colliding markets will
     * not own data and will be marked as invalid
     * or colliding in the metadata.
     */
    mapping(uint256 => bool) collidingMarkets;

    constructor(address _metaverse) MetaversePlugin(_metaverse) {}

    /**
     * The only thing initialization does is to define the market type.
     */
    function _initialize() internal override {
        marketType = _defineNextNFTType();
    }

    /**
     * Merging interfaces support from both ancestors.
     */
    function supportsInterface(
        bytes4 _interfaceId
    ) public view virtual override(MetaversePlugin, NFTTransferWatcherPlugin) returns (bool) {
        return MetaversePlugin.supportsInterface(_interfaceId) ||
               NFTTransferWatcherPlugin.supportsInterface(_interfaceId);
    }

    /**
     * The title of the current plug-in is "Real-World Marketplace".
     */
    function title() public view override returns (string memory) {
        return "Real-World Markets";
    }

    /**
     * The markets metadata is appropriately defined here,
     * both for colliding markets or working ones (i.e.
     * "defined first" in terms of the underling hash).
     */
    function _tokenMetadata(uint256 _marketId) internal view override returns (bytes memory) {
        if (collidingMarkets[_marketId]) {
            return abi.encodePacked(
                '{"name":"', "~Invalid Market~", '","description":"","image":"', collidingMarketImage,
                '","decimals":0,"properties":{}}'
            );
        }

        Market storage market = markets[keccak256(abi.encodePacked(_marketId))];
        if (market.owner == address(0)) {
            return abi.encodePacked("");
        } else {
            return abi.encodePacked(
                '{"name":"',market.title, '","description":"","image":"', marketImage,
                '","decimals":0,"properties":{}}'
            );
        }
    }

    /**
     * This callback receives the NFT, but not without performing
     * appropriate checks. One of the following conditions must
     * be satisfied at least:
     * - The owner who transfers the market to the new owner
     *   is actually an ERC1155-approved of the new owner (this
     *   includes, for example, a brand owner transferring the
     *   market instance to the brand itself).
     * - If the new owner is a brand, then the current (previous)
     *   owner of this market (if not also owner of the brand
     *   itself) must have the in-brand BRAND_MANAGE_MARKETS
     *   permission.
     * Burning the markets is allowed, specially if the market
     * itself is deemed "invalid" or "colliding".
     */
    function onNFTOwnerChanged(
        uint256 _nftId, address _newOwner
    ) external override(NFTTransferWatcherPlugin) onlyMetaverse {
        if (collidingMarkets[_nftId]) {
            require(_newOwner == address(0), "RealWorldMarketsPlugin: colliding markets can only be burned");
            delete collidingMarkets[_nftId];
        } else {
            // The market will have a metadata.
            if (_newOwner != address(0)) {
                Market storage market = markets[keccak256(abi.encodePacked(_nftId))];
                require(
                    canGiveMarketsTo(market.owner, _newOwner),
                    "RealWorldMarketsPlugin: the market owner is not allowed to transfer it to the new owner"
                );
                market.owner = _newOwner;
            } else {
                delete markets[keccak256(abi.encodePacked(_nftId))];
            }
        }
    }

    /**
     * Tells whether an account can transfer a market to another
     * account. This is by a redundant transfer, a transfer from
     * an allowed ERC1155 operator, or a transfer from an allowed
     * user when the target is the brand they're allowed into
     * (this involves a special permission).
     */
    function canGiveMarketsTo(address _from, address _to) public view returns (bool) {
        if (_from == _to) return true;

        IMetaverse _metaverse = IMetaverse(metaverse);
        if (IEconomy(_metaverse.economy()).isApprovedForAll(_to, _from)) return true;

        IBrandRegistry _brandRegistry = IBrandRegistry(IMetaverse(metaverse).brandRegistry());
        return _brandRegistry.brandExists(_to) && _brandRegistry.isBrandAllowed(_to, BRAND_MANAGE_MARKETS, _from);
    }

    /**
     * Tells whether the owner ERC1155-approves the sender.
     */
    function _isOwnerOrApproved(address _owner, address _sender) internal view returns (bool) {
        return _owner == _sender || IEconomy(IMetaverse(metaverse).economy()).isApprovedForAll(_owner, _sender);
    }

    /**
     * Sets the title for one market. Only the market owner
     * (or one of its ERC-1155 approved operators) can do this.
     */
    function setMarketTitle(uint256 _marketId, string memory _title) external {
        Market storage market = markets[keccak256(abi.encodePacked(_marketId))];
        require(
            _isOwnerOrApproved(market.owner, _msgSender()),
            "RealWorldMarketsPlugin: only the market owner or an ERC-1155 approved operator can invoke this operation"
        );
        market.title = _title;
    }

    /**
     * Sets a manager for this market. Only the market owner
     * (or one of its ERC-1155 approved operators) can do this.
     * The market is specified by its hash in this method.
     */
    function setMarketManager(bytes32 _marketIdHash, bytes32 _managerAddressHash) external {
        Market storage market = markets[_marketIdHash];
        require(
            _isOwnerOrApproved(market.owner, _msgSender()),
            "RealWorldMarketsPlugin: only the market owner or an ERC-1155 approved operator can invoke this operation"
        );
        market.manager = _managerAddressHash;
    }

    /**
     * Tells whether a market allows an address as its manager.
     */
    function isMarketManager(bytes32 _marketIdHash, bytes32 _managerAddressHash) external view returns (bool) {
        return markets[_marketIdHash].manager == _managerAddressHash;
    }

    /**
     * Tells whether a market has an owner being a committed brand.
     * The market is given by its hash instead of its id.
     */
    function isMarketOwnedByCommittedBrand(bytes32 _marketIdHash) external view returns (bool) {
        Market storage market = markets[_marketIdHash];
        return IBrandRegistry(IMetaverse(metaverse).brandRegistry()).isCommitted(market.owner);
    }

    /**
     * Mints a market for a specific owner. The new market
     * is instantiated appropriately and, with extremely low
     * probability, it has a collision conflict with another
     * minted market. The user account that mints it will be
     * able to get notified by checking the appropriate
     * ERC1155 event.
     */
    function _mintMarket(address _owner, string memory _title) private {
        uint256 marketId = _mintNFTFor(_owner, marketType, "");
        bytes32 marketHash = keccak256(abi.encodePacked(marketId));
        if (markets[marketHash].owner != address(0)) {
            collidingMarkets[marketId] = true;
        } else {
            markets[marketHash].owner = _owner;
            markets[marketHash].title = _title;
        }
    }

    /**
     * Mints a market for the sender. The market is instantiated
     * appropriately and, with extremely low probability, it has
     * a collision conflict with another minted market. The user
     * account that mints it will be able to get notified by
     * checking the appropriate ERC1155 event.
     */
    function mintMarket(string memory _title) external {
        _mintMarket(_msgSender(), _title);
    }

    /**
     * Mints a market for a specific owner. The market is instantiated
     * appropriately and, with extremely low probability, it has a
     * collision conflict with another minted market. The user account
     * that mints it will be able to get notified by checking the
     * appropriate ERC1155 event.
     */
    function mintMarketFor(address _owner, string memory _title) external {
        require(
            canGiveMarketsTo(_msgSender(), _owner),
            "RealWorldMarketsPlugin: the sender is not allowed to create a market for the new owner"
        );
        _mintMarket(_owner, _title);
    }

    /**
     * Receives tokens. The token markets are burned. Other tokens are rejected
     * and the transaction is reverted.
     */
    function onERC1155Received(
        address, address, uint256 _id, uint256 _values, bytes calldata
    ) external onlyEconomy returns (bytes4) {
        if (_values > 0) {
            require(
                IMetaverse(metaverse).nftTypes(_id) != marketType,
                "RealWorldMarketsPlugin: only markets can be sent to the plug-in (and will be burned)"
            );
            _burnNFT(_id);
        }
        return 0xf23a6e61;
    }

    /**
     * Receives many tokens. The token markets are burned. Other tokens are rejected
     * and the transaction is reverted.
     */
    function onERC1155BatchReceived(
        address, address, uint256[] calldata _ids, uint256[] calldata _values,
        bytes calldata
    ) external onlyEconomy returns (bytes4) {
        for(uint256 index = 0; index < _ids.length; index++) {
            if (_values[index] > 0) {
                uint256 _id = _ids[index];
                require(
                    IMetaverse(metaverse).nftTypes(_id) != marketType,
                    "RealWorldMarketsPlugin: only markets can be sent to the plug-in (and will be burned)"
                );
                _burnNFT(_id);
            }
        }
        return 0xbc197c81;
    }
}
