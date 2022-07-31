// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "../NativePayable.sol";

/**
 * A Brand registry will keep track of the brands being registered.
 * Those brands will hold the metadata, and this trait will hold
 * the mean to register such brand with its metadata.
 */
abstract contract BrandRegistry is Context, NativePayable {
    /**
     * The cost to register a new brand. This can be changed in
     * the future and must be able to be known in the ABI for the
     * users to be aware of the statistic.
     */
    uint256 public brandRegistrationCost;

    /**
     * This is the whole brand metadata. It only has aesthetics,
     * name and descriptions.
     */
    struct BrandMetadata {
        /**
         * The owner of the brand (cached).
         */
        address owner;

        /**
         * The name of the brand. It matches the "name" field
         * of the metadata. This field is immutable.
         */
        string name;

        /**
         * The description of the brand. It matches the
         * "description" field of the metadata. This field
         * is immutable.
         */
        string description;

        /**
         * The challenge URL of the brand. It matches the
         * "properties.challengeUrl" field. This field is
         * optional and mutable.
         */
        string challengeUrl;

        /**
         * The URL of the brand. It matches the "image" field
         * of the metadata. This field is mutable.
         */
        string image;

        /**
         * The icon of the brand (16x16). It matches the
         * "properties.icon16x16" field of the metadata.
         * This field is optional and mutable.
         */
        string icon16x16;

        /**
         * The icon of the brand (32x32). It matches the
         * "properties.icon32x32" field of the metadata.
         * This field is optional and mutable.
         */
        string icon32x32;

        /**
         * The icon of the brand (64x64). It matches the
         * "properties.icon64x64" field of the metadata.
         * This field is optional and mutable.
         */
        string icon64x64;

        /**
         * Whether this brand is a regarded non-government
         * organization or not. Those brands receive another
         * kind of treatment, as they're recognized by the
         * management to be socially committed brands, in
         * accordance to the management guidelines for such
         * commitment recognition.
         */
        bool committed;
    }

    /**
     * All the registered brands are here. Each brand will have
     * a non-empty name and non-empty description. Brands can
     * only be added - never deleted / unregistered.
     */
    mapping(address => BrandMetadata) brands;

    /**
     * The count of registered brands.
     */
    uint256 brandsCount;

    /**
     * Tells the current earnings, not yet withdrawn, from brand
     * registrations.
     */
    uint256 public brandRegistrationCurrentEarnings;

    // ********** Brand management goes here **********

    /**
     * Tells whether the specified user can set the registration
     * cost, or not.
     */
    function _canSetBrandRegistrationCost(address _sender) internal virtual view returns (bool);

    /**
     * An event for when the brand registration cost is updated.
     */
    event BrandRegistrationCostUpdated(uint256 newCost);

    /**
     * Sets the new brand registration cost.
     */
    function setBrandRegistrationCost(uint256 _newCost) public {
        require(
            _canSetBrandRegistrationCost(_msgSender()),
            "BrandRegistry: not allowed to set the brand registration cost"
        );
        require(
            _newCost >= (1 ether) / 100,
            "BrandRegistry: the brand registry cost must not be less than 0.01 native tokens"
        );
        brandRegistrationCost = _newCost;
        emit BrandRegistrationCostUpdated(_newCost);
    }

    // ********** Brand registration & management goes here **********

    /**
     * Mints the new brand id, giving it to a particular address as owner.
     */
    function _mintBrandFor(address _brandId, address _owner) internal virtual;

    /**
     * Tells whether a particular user is the owner of the brand id.
     */
    function _isBrandOwnerApprovedEditor(address _brandOwner, address _sender) internal view virtual returns (bool);

    /**
     * This event is triggered when a brand is registered. The new
     * address is also included, along some reference data.
     */
    event BrandRegistered(
        address indexed registeredBy, address indexed brandId, string name, string description,
        uint256 price
    );

    /**
     * Given the appropriate metadata, mints a new brand. The image url
     * is mandatory, but about:blank may be used if it is missing or one
     * image is not yet ready. The icons are optional. An empty string
     * or about:blank should be used if not needed. Ensure all the urls
     * are empty (as permitted) or valid urls, and the name and description
     * have only json-string-friendly character, no backslash, and no double
     * quotes or the metadata might fail to be assembled into valid JSON,
     * also taking special care with the name and description, since they
     * cannot be changed later.
     */
    function _registerBrand(
        string memory _name, string memory _description, string memory _image,
        string memory _icon16x16, string memory _icon32x32, string memory _icon64x64,
        bool committed
    ) internal {
        address sender = _msgSender();
        require(bytes(_name).length != 0, "BrandRegistry: use a non-empty name");
        require(bytes(_description).length != 0, "BrandRegistry: use a non-empty description");
        require(bytes(_image).length != 0, "BrandRegistry: use a non-empty image url");

        // 1. Annotate the non-withdrawn earnings with the new amount.
        brandRegistrationCurrentEarnings += msg.value;

        // 2. Increment the counter and generate the new brand address.
        brandsCount += 1;
        address brandId = address(uint160(uint256(keccak256(
            abi.encodePacked(
                bytes1(0xd6), bytes1(0x94), address(this), sender,
                bytes32(brandsCount)
            )
        ))));

        // 3. Register the brand.
        brands[brandId] = BrandMetadata({
            name: _name, description: _description, challengeUrl: "about:blank",
            image: _image, icon16x16: _icon16x16, icon32x32: _icon32x32,
            icon64x64: _icon64x64, owner: sender, committed: committed
        });

        // 4. Mint the brand into the economic system for the sender.
        _mintBrandFor(brandId, sender);

        // 5. Trigger the event.
        emit BrandRegistered(sender, brandId, _name, _description, msg.value);
    }

    /**
     * Registers a new brand, when the appropriate price is paid for it.
     * For more details on how this method works, check _registerBrand's
     * inline documentation.
     */
    function registerBrand(
        string memory _name, string memory _description, string memory _image,
        string memory _icon16x16, string memory _icon32x32, string memory _icon64x64
    ) public payable hasNativeTokenPrice("BrandRegistry: brand registration", brandRegistrationCost) {
        _registerBrand(_name, _description, _image, _icon16x16, _icon32x32, _icon64x64, false);
    }

    /**
     * Tells whether the specified user can set the brand social
     * commitment to a brand, or not. Brands with that flag set
     * are (1) non-commercial and (2) aligned to this metaverse's
     * social commitment views.
     */
    function _canSetBrandCommitment(address _sender) internal virtual view returns (bool);

    /**
     * This event is triggered when a brand is updated with respect
     * to its social commitment (this is: to tell a brand is socially
     * committed according to the metaverse's views or not). Special
     * benefits (in particular, with respect to assets loading on
     * customers) are given in clients to socially committed brands.
     */
    event BrandSocialCommitmentUpdated(address indexed updatedBy, address indexed brand, bool committed);

    /**
     * Updates whether a brand is socially committed or not.
     */
    function updateBrandSocialCommitment(address _brandId, bool _committed) public {
        // Require the flag to exist.
        address owner = brands[_brandId].owner;
        require(owner != address(0), "BrandRegistry: non-existing brand");

        // Require the sender to be allowed to set brands' commitment.
        address sender = _msgSender();
        require(
            _canSetBrandCommitment(sender),
            "BrandRegistry: not allowed to set brands' social commitment"
        );

        // Update the commitment flag.
        brands[_brandId].committed = _committed;

        // Emit the related event.
        emit BrandSocialCommitmentUpdated(sender, _brandId, _committed);
    }

    /**
     * Sets the owner of a brand. This method is meant to be called
     * internally, when the actual brand transfer is done (brands
     * can only be transferred, but never burnt).
     */
    function _setBrandOwner(address _brandId, address _newOwner) internal {
        if (brands[_brandId].owner != address(0)) brands[_brandId].owner = _newOwner;
    }

    /**
     * This modifiers limits the action so that only owners or
     * approved operators can invoke it (it also implies that
     * the brand itself must exist).
     */
    modifier _onlyBrandOwnerOrApprovedEditor(address _brandId) {
        address owner = brands[_brandId].owner;
        address sender = _msgSender();
        require(
            owner != address(0) && (sender == owner || _isBrandOwnerApprovedEditor(owner, sender)),
            "BrandRegistry: caller is not brand owner nor approved"
        );
        _;
    }

    /**
     * This event is triggered when a brand is registered. The new
     * address is also included, along some reference data.
     */
    event BrandUpdated(address indexed updatedBy, address indexed brandId);

    /**
     * Updates the brand image. Only the owner of the brand or an
     * approved account can invoke this method. Ensure the _image is
     * empty or a valid URL, or metadata might fail to be assembled
     * into valid JSON.
     */
    function updateBrandImage(address _brandId, string memory _image) public _onlyBrandOwnerOrApprovedEditor(_brandId) {
        require(bytes(_image).length != 0, "BrandRegistry: use a non-empty image url");
        brands[_brandId].image = _image;
        emit BrandUpdated(_msgSender(), _brandId);
    }

    /**
     * Updates the brand's challenge url. Only the owner of the brand
     * or an approved account can invoke this method. Ensure the url
     * is empty or a valid URL, or metadata might fail to be assembled
     * into valid JSON.
     */
    function updateBrandChallengeUrl(
        address _brandId, string memory _challengeUrl
    ) public _onlyBrandOwnerOrApprovedEditor(_brandId) {
        brands[_brandId].challengeUrl = _challengeUrl;
        emit BrandUpdated(_msgSender(), _brandId);
    }

    /**
     * Updates the brand's 16x16 icon url. Only the owner of the brand
     * or an approved account can invoke this method. Ensure the _icon
     * is empty or a valid URL, or metadata might fail to be assembled
     * into valid JSON.
     */
    function updateBrandIcon16x16Url(
        address _brandId, string memory _icon
    ) public _onlyBrandOwnerOrApprovedEditor(_brandId) {
        brands[_brandId].icon16x16 = _icon;
        emit BrandUpdated(_msgSender(), _brandId);
    }

    /**
     * Updates the brand's 32x32 icon url. Only the owner of the brand
     * or an approved account can invoke this method. Ensure the _icon
     * is empty or a valid URL, or metadata might fail to be assembled
     * into valid JSON.
     */
    function updateBrandIcon32x32Url(
        address _brandId, string memory _icon
    ) public _onlyBrandOwnerOrApprovedEditor(_brandId) {
        brands[_brandId].icon32x32 = _icon;
        emit BrandUpdated(_msgSender(), _brandId);
    }

    /**
     * Updates the brand's 64x64 icon url. Only the owner of the brand
     * or an approved account can invoke this method. Ensure the _icon
     * is empty or a valid URL, or metadata might fail to be assembled
     * into valid JSON.
     */
    function updateBrandIcon64x64Url(
        address _brandId, string memory _icon
    ) public _onlyBrandOwnerOrApprovedEditor(_brandId) {
        brands[_brandId].icon64x64 = _icon;
        emit BrandUpdated(_msgSender(), _brandId);
    }

    /**
     * Assembles the whole metadata for a brand. WARNING: This method
     * will consume a lot of gas if invoked inside a transaction, so
     * it is recommended to invoke this method in the context of a
     * CALL, and never in the context of a SEND (even as part of other
     * contract's code).
     */
    function brandMetadataURI(address _brandId) public view returns (string memory) {
        BrandMetadata storage brand = brands[_brandId];
        if (brand.owner == address(0)) return "";

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(abi.encodePacked(
            '{"name":"', brand.name, '","description":"', brand.description, '","image":"', brand.image,
            '","properties":{"challengeUrl":"',brand.challengeUrl,'","icon16x16":"', brand.icon16x16,
            '","icon32x32":"', brand.icon32x32, '","icon64x64":"', brand.icon64x64, '","committed":',
            brand.committed ? 'true' : 'false','}}'
        ))));
    }

    /**
     * Tells whether an address corresponds to a registered brand or not.
     */
    function brandExists(address _brandId) public view returns (bool) {
        return brands[_brandId].owner != address(0);
    }

    // ********** Brand registration earnings management goes here **********

    /**
     * Tells whether the sender can withdraw the earnings from brand registration.
     */
    function _canWithdrawBrandRegistrationEarnings(address _sender) internal view virtual returns (bool);

    /**
     * This event is triggered when brand earnings were withdrawn successfully.
     */
    event BrandEarningsWithdrawn(address indexed withdrawnBy, uint256 amount);

    /**
     * Allows the sender to withdraw brand registration earnings.
     */
    function withdrawBrandRegistrationEarnings(uint256 amount) public {
        address sender = _msgSender();
        require(
            _canWithdrawBrandRegistrationEarnings(sender),
            "BrandRegistry: earnings cannot be withdrawn by this sender"
        );
        require(
            amount > 0,
            "BrandRegistry: earnings amount must not be 0"
        );
        require(
            brandRegistrationCurrentEarnings >= amount,
            "BrandRegistry: earnings amount is less than the requested amount"
        );
        brandRegistrationCurrentEarnings -= amount;
        payable(sender).transfer(amount);
    }
}
