// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../base/PaymentChannelPlugin.sol";
import "../base/NFTDefiningPlugin.sol";

/**
 * A real-world marketplace allows brands or regular
 * accounts to create an in-chain instance of their
 * market (essentially, a market is just a group of
 * PoS entries / enabled users) and operate with it.
 */
contract RealWorldMarketplacePlugin is PaymentChannelPlugin, NFTDefiningPlugin {
    /**
     * This is the definition of a real-world market.
     * Markets are described and have their data kept
     * up to date by a complex set of roles. They are
     * defined as NFTs (although not usually meant to
     * be transferred), so their ownership will only
     * be known by ERC1155 means.
     */
    struct Market {
        /**
         * This flag will always be true.
         */
        bool exists;

        /**
         * The market title (e.g. a regional market instance).
         */
        string title;

        /**
         * The manager of the market.
         */
        address manager;

        /**
         * The "emitter" accounts in this market. They will
         * usually be automated software pieces.
         */
        mapping(address => bool) emitters;

        /**
         * The "operator" accounts in this market. They will
         * usually be client (human-used) software programs.
         */
        mapping(address => bool) operators;
    }

    /**
     * This is the definition of an invoice. Each
     * invoice will be related to the marketplace,
     * will have a concept, a reference, and also
     * a reward on fulfillment. It will have the
     * same identifier as the underlying payment.
     * Once it is paid, the invoice will be marked
     * as paid (using an event). The paid event
     * will track the invoice (all the data) and
     * also the payment, as a proof that it was
     * fulfilled appropriately.
     */
    struct Invoice {
        /**
         * The invoice description.
         */
        string description;

        /**
         * The invoice external reference (e.g. real-world number).
         */
        string externalId;

        /**
         * The invoice rewards (typically, promo coins) ERC1155 token ids.
         * This is optional. The token ids will typically exist and be unique.
         */
        uint256[] rewardTokenIds;

        /**
         * The invoice rewards ERC1155 token amounts.
         * Optional, but will match in length against rewardTokenIds.
         * Also: will never have zero values among its items.
         */
        uint256[] rewardTokenAmounts;

        /**
         * The invoice emitter. This is typically an automated software
         * which emitted the invoice and determined its costs and rewards
         * via regulated, per-business, means.
         */
        address emitter;

        /**
         * The invoice operator this invoice was emitted for. The operator
         * (or the emitter) can cancel the invoice if something is wrong.
         */
        address operator;

        /**
         * The customer this invoice is directed to. That customer can
         * reject the invoice if something is wrong.
         */
        address customer;
    }

    /**
     * The image to use to render markets as NFTs.
     */
    string private marketImage;

    /**
     * The marketplace type.
     */
    uint256 private marketplaceType;

    /**
     * The currently minted (and not burned) markets.
     */
    mapping(uint256 => Market) public markets;

    // TODO set the market minting settings:
    // TODO - variable (with initial cost in the constructor)
    // TODO - permission to change it
    // TODO - event of it being changed
    // TODO - function to change it (requiring permission and triggering the event)

    constructor(address _metaverse, string memory _marketImage) MetaversePlugin(_metaverse) {
        marketImage = _marketImage;
    }

    /**
     * The title of the current plug-in is "Real-World Marketplace".
     */
    function title() public view override returns (string memory) {
        return "Real-World Marketplace";
    }

    /**
     * No particular initialization is required by this plug-in.
     */
    function _initialize() internal override {
        marketplaceType = _defineNextNFTType();
    }

    /**
     * Metadata is not implemented in this plug-in.
     */
    function _tokenMetadata(uint256 _marketId) internal view override returns (bytes memory) {
        Market storage market = markets[_marketId];
        if (!market.exists) {
            return abi.encodePacked("");
        } else {
            return abi.encodePacked(
                '{"name":"',market.title, '","description":"","image":"', marketImage,
                '","decimals":0,"properties":{}}'
            );
        }
    }

    /**
     * What to do when a payment is received.
     */
    function _paid(address operator, address from, uint256 channelId, uint256 units) internal override {
        // TODO
    }

    // TODO methods to mint marketplaces:
    // TODO   directly, for the sender (it costs)
    // TODO   indirectly, for a brand (it costs)
    // TODO   admin-funded: directly, for a user (it does not cost)
    // TODO   admin-funded: indirectly, for a brand (it does not cost; the user is only tracked)

    // TODO onlyInitialized operations:
    // TODO   onlyMarketOwner:
    // TODO     change manager (trigger event)
    // TODO     change description (trigger event)
    // TODO   onlyMarketOwnerOrManager:
    // TODO     set/unset emitter (trigger event)
    // TODO     set/unset operator (trigger event)
    // TODO   onlyMarketEmitter:
    // TODO     createInvoice
    // TODO     updateInvoice* (several methods - discuss whether events will be triggered)
    // TODO   onlyMarketOwnerManagerEmitterOrOperator:
    // TODO     cancelInvoice
    // TODO   onlyTheDirectedCustomer(invoice):
    // TODO     rejectInvoice
}
