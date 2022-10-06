// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "../../IMetaverse.sol";
import "../../economy/IEconomy.sol";
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
         * The market this invoice belongs to.
         */
        uint256 marketId;

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

    /**
     * The (yet unpaid) invoices.
     */
    mapping(uint256 => Invoice) public invoices;

    /**
     * The market minting price. 0 means the market
     * minting is disabled by this public mean, until
     * the administration sets a price.
     */
    uint256 public marketMintingCost;

    /**
     * This permission allows users to set the market
     * minting costs for brands or accounts to define
     * new real-world markets.
     */
    bytes32 constant METAVERSE_MANAGE_REAL_WORLD_MARKETPLACE_SETTINGS =
        keccak256("Plugins::RealWorldMarketplace::Settings::Manage");

    /**
     * This permission allows users to mint (for free)
     * a market for certain account (or brand). When
     * doing this, only the title will be set, but then
     * it is up to the account, an ERC1155 operator of
     * it (including the owner, in the case of a brand),
     * or an account having BRAND_MARKETS_OVERSEER in
     * the brand, the responsibility to set the market
     * up (manager, emitter(s), operator(s), title).
     */
    bytes32 constant METAVERSE_GIVE_MARKETPLACES = keccak256("Plugins::RealWorldMarketplace::Markets::Give");

    /**
     * This is a permission that may be granted by brands
     * to users to grant them owner-like permissions when
     * interacting with the markets associated to it. This
     * permission allows everything that owners do, save
     * for the ability to ERC1155-transfer the market as
     * a standard ERC1155 asset is allowed to.
     */
    bytes32 constant BRAND_MARKETS_OVERSEER = keccak256("Plugins::RealWorldMarketplace::Brand::Markets::Overseer");

    constructor(
        address _metaverse, string memory _marketImage, uint256 _marketMintingPrice
    ) MetaversePlugin(_metaverse) {
        marketImage = _marketImage;
        marketMintingCost = _marketMintingPrice;
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
     * An event for when the market minting cost
     * is updated. Updating it to 0 disables it
     * completely.
     */
    event MarketMintingCostUpdated(uint256 newCost);

    /**
     * Sets the currency definition cost.
     */
    function setMarketMintingCost(uint256 newCost) public
        onlyMetaverseAllowed(METAVERSE_MANAGE_REAL_WORLD_MARKETPLACE_SETTINGS)
    {
        marketMintingCost = newCost;
        emit MarketMintingCostUpdated(newCost);
    }

    /**
     * Invoices being paid trigger these events, which only reference:
     * - (market id, operator address) : To allow the operator tracking
     *   their managed invoices.
     * - customer address : To allow the customer tracking their purchases.
     * - concept & external id : Details of the invoice, just for human
     *   readability and matching.
     * The payment and reward will NOT be specified here, because this
     * system is meant to track well-known costs for recurring services
     * or back the operation against a real-world document referenced
     * by its external id.
     */
    event InvoicePaid(uint256 indexed marketId, string externalId, string concept,
                      address indexed operator, address indexed customer);

    /**
     * What to do when a payment is received.
     */
    function _paid(address operator, address from, uint256 channelId, uint256 units) internal override {
        require(units == 1, "RealWorldMarketplacePlugin: Only one unit is allowed per external invoice");
        Invoice storage invoice = invoices[channelId];

        // 1. If there is a reward, batch-transfer it to the from address.
        if (invoice.rewardTokenIds.length > 0) {
            IEconomy(IMetaverse(metaverse).economy()).safeBatchTransferFrom(
                address(this), from, invoice.rewardTokenIds, invoice.rewardTokenAmounts, ""
            );
        }
        // 2. Trigger the event of the paid invoice (tracking data only).
        // 3. Destroy the payment channel and the invoice.
        emit InvoicePaid(
            invoice.marketId, invoice.externalId, invoice.description,
            invoice.operator, invoice.customer
        );
        _removePaymentChannel(channelId);
        delete invoices[channelId];
        //    The invoice (event) is anyway indexed by: customer, market,
        //    or operator, but the record will not exist anymore and the
        //    gas will be refunded to the payer.
    }

    // TODO methods to mint marketplaces:

    // TODO onlyInitialized operations:
    // TODO   mint directly, for the sender (it costs)
    // TODO   brandPermission(brand, BRAND_MARKETS_OVERSEER)
    // TODO     mint indirectly, for a brand (it costs)
    // TODO   metaversePermission(METAVERSE_GIVE_MARKETPLACES)
    // TODO     directly, for a user (it does not cost)
    // TODO     indirectly, for a brand (it does not cost; the user is only tracked)
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
