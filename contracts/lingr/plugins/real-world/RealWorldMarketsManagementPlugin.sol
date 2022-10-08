// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../economy/IEconomy.sol";
import "../base/NFTMintingPlugin.sol";
import "../base/NFTDefiningPlugin.sol";
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
contract RealWorldMarketsManagementPlugin is NFTDefiningPlugin, NFTMintingPlugin, NFTTransferWatcherPlugin {
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
        uint256 manager;

        /**
         * The signers allowed by this market. Typically, each signer
         * is a cashier operator. Only the hash of the cashier is kept
         * here, in order to give the appearance of decoupling the
         * operations to set / remove the signer of the operation to
         * signature-verify and retrieve that address.
         */
        mapping(uint256 => bool) signers;

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
    bytes32 constant BRAND_MANAGE_CURRENCIES = keccak256("Plugins::RealWorldMarkets::Brand::Markets::Manage");

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
    mapping(uint256 => Market) markets;

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
        bytes4 interfaceId
    ) public view virtual override(MetaversePlugin, NFTTransferWatcherPlugin) returns (bool) {
        return MetaversePlugin.supportsInterface(interfaceId) ||
               NFTTransferWatcherPlugin.supportsInterface(interfaceId);
    }

    /**
     * The title of the current plug-in is "Real-World Marketplace".
     */
    function title() public view override returns (string memory) {
        return "Real-World Payments";
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

        Market storage market = markets[_marketId];
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
            require(_newOwner == address(0), "RealWorldPaymentsPlugin: colliding markets can only be burned");
            delete collidingMarkets[_nftId];
        } else {
            // The market will have a metadata.
            require(
                canGiveMarketsTo(markets[_nftId].owner, _newOwner),
                "RealWorldPaymentsPlugin: the market owner is not allowed to transfer it to the new owner"
            );
            markets[_nftId].owner = _newOwner;
        }
    }

    /**
     * Tells whether an account can transfer a market to another
     * account. This is by a redundant transfer, a transfer from
     * an allowed ERC1155 operator, or a transfer from an allowed
     * user when the target is the brand they're allowed into
     * (this involves a special permission).
     */
    function canGiveMarketsTo(address from, address to) public view returns (bool) {
        if (from == to) return true;

        IMetaverse _metaverse = IMetaverse(metaverse);
        if (IEconomy(_metaverse.economy()).isApprovedForAll(to, from)) return true;

        IBrandRegistry _brandRegistry = IBrandRegistry(IMetaverse(metaverse).brandRegistry());
        return _brandRegistry.brandExists(to) && _brandRegistry.isBrandAllowed(to, BRAND_MANAGE_CURRENCIES, from);
    }

    // TODO (all of them public methods - the callbacks have to restrict by onlyEconomy):
    // - changeManager(marketIdHash, managerAddressHash) onlyMarketOwner(marketIdHash) {}
    // - setMarketTitle(marketIdHash, title) onlyMarketOwnerOrManager(marketIdHash) {}
    // - setMarketSigner(marketIdHash, marketSignerHash, bool permitted) onlyMarketOwnerOrManager(marketIdHash) {}
    // - onERC1155Received and onERC1155BatchReceived:
    //   - Burn any market received this way. Complain by any other asset type received this way.
    // - mintMarket(marketTitle) {}:
    //   - Mints a new market. The owner will be the sender.
    //   - The notification will be done through a standard trackable Transfer(to=sender) event.
    // - mintMarketFor(owner, marketTitle) {}:
    //   - Mints a new market for another user. canGiveMarketsTo(msg.sender, owner) must be satisfied.
    //   - The notification will be done through a standard trackable Transfer(to=sender) event.
}
