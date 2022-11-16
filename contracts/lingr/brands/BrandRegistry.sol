// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./IBrandRegistry.sol";
import "../IMetaverse.sol";
import "../IMetaverseOwned.sol";
import "../economy/IEconomy.sol";
import "../../NativePayable.sol";
import "../DelegableContext.sol";

/**
 * A Brand registry will keep track of the brands being registered.
 * Those brands will hold the metadata, and this trait will hold
 * the mean to register such brand with its metadata.
 */
contract BrandRegistry is Context, NativePayable, IBrandRegistry, IMetaverseOwned, ERC165, DelegableContext {
    /**
     * Addresses can check for ERC165 compliance by using this
     * embeddable library.
     */
    using ERC165Checker for address;

    /**
     * The metaverse that will own this brand registry.
     */
    address public metaverse;

    /**
     * The address that will receive the earnings of the brand
     * registration process (when triggered by the public mean).
     */
    address public brandEarningsReceiver;

    /**
     * The cost to register a new brand. This can be changed in
     * the future and must be able to be known in the ABI for the
     * users to be aware of the statistic. By default, defining
     * a brand is disabled by the public mean, until a price is
     * set by the administration.
     */
    uint256 public brandRegistrationCost = 0;

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
         * The URL of the brand image. It matches the "image"
         * field of the metadata. This field is mutable.
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
     * Permission: Superuser (all the permissions are considered
     * given to a superuser which is registered in a respective
     * non-zero brand). The only things that superuser per-se
     * cannot do in a brand are to transfer it via ERC-1155 and
     * add more superusers.
     */
    bytes32 constant SUPERUSER = bytes32(uint256((1 << 256) - 1));

    /**
     * (Metaverse-scope) Permission: The user is allowed to set
     * the brand registration cost.
     */
    bytes32 constant METAVERSE_MANAGE_REGISTRATION_SETTINGS = keccak256("BrandRegistry::Settings::Manage");

    /**
     * (Metaverse-scope) Permission: The user is allowed to set
     * the brand social commitment to a brand, or not. Brands with
     * that flag set are (1) non-commercial and (2) aligned to this
     * metaverse's social commitment views.
     */
    bytes32 constant METAVERSE_SET_BRAND_COMMITMENT = keccak256("BrandRegistry::SetBrandCommitment");

    /**
     * (Metaverse-scope) Permission: The user is allowed to mint
     * and brand, for an owner, for free.
     */
    bytes32 constant METAVERSE_MINT_BRAND_FOR = keccak256("BrandRegistry::Brands::MintFor");

    /**
     * Permission: The user is allowed to edit a brand's aesthetic.
     */
    bytes32 constant BRAND_AESTHETICS_EDITION = keccak256("BrandRegistry::Brand::Edit");

    /**
     * Maintains the permissions assigned to all the brands
     * (the brand must always be != 0).
     */
    mapping(address => mapping(bytes32 => mapping(address => bool))) brandPermissions;

    /**
     * The count of registered brands.
     */
    uint256 brandsCount;

    // ********** Brand management goes here **********

    /**
     * An event for when the brand registration cost is updated.
     */
    event BrandRegistrationCostUpdated(address indexed updatedBy, uint256 newCost);

    /**
     * An event for when the brand registration earnings receiver is changed.
     */
    event BrandRegistrationEarningsReceiverUpdated(address indexed updatedBy, address newReceiver);

    /**
     * Creating a brand registry requires a valid metaverse
     * registrar as its owner.
     */
    constructor(address _metaverse, address _brandEarningsReceiver) {
        require(_brandEarningsReceiver != address(0), "BrandRegistry: the earnings receiver must not be 0");
        require(_metaverse != address(0), "BrandRegistry: the owner contract must not be 0");
        require(
            _metaverse.supportsInterface(type(IMetaverse).interfaceId),
            "BrandRegistry: the owner contract must implement IMetaverse"
        );
        metaverse = _metaverse;
        brandEarningsReceiver = _brandEarningsReceiver;
    }

    /**
     * This modifier restricts function to be only invoked by the metaverse.
     */
    modifier onlyMetaverse() {
        require(msg.sender == metaverse, "BrandRegistry: the only allowed sender is the metaverse system");
        _;
    }

    /**
     * Sets the new brand registration cost.
     */
    function setBrandRegistrationCost(uint256 _newCost) public
        nonDelegable onlyMetaverseAllowed(METAVERSE_MANAGE_REGISTRATION_SETTINGS)
    {
        require(
            _newCost == 0 || _newCost >= (1 ether) / 100,
            "BrandRegistry: the brand registry cost must not be less than 0.01 native tokens"
        );
        brandRegistrationCost = _newCost;
        emit BrandRegistrationCostUpdated(_msgSender(), _newCost);
    }

    /**
     * Set the new brand registration earnings receiver.
     */
    function setBrandRegistrationEarningsReceiver(address _newReceiver) public
        nonDelegable onlyMetaverseAllowed(METAVERSE_MANAGE_REGISTRATION_SETTINGS)
    {
        require(
            _newReceiver != address(0),
            "BrandRegistry: the brand registry earnings receiver must not be the 0 address"
        );
        brandEarningsReceiver = _newReceiver;
        emit BrandRegistrationEarningsReceiverUpdated(_msgSender(), _newReceiver);
    }

    // ********** Brand registration & management goes here **********

    /**
     * Tells whether a particular user is the owner of the brand id.
     */
    function _isBrandOwnerApproved(address _brandOwner, address _sender) internal view returns (bool) {
        return IEconomy(IMetaverse(metaverse).economy()).isApprovedForAll(_brandOwner, _sender);
    }

    /**
     * This event is triggered when a brand is registered. The new
     * address is also included, along some reference data.
     */
    event BrandRegistered(
        address indexed registeredBy, address indexed brandId, string name, string description,
        uint256 price, address indexed mintedBy
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
        address _sender, address _mintedBy,
        string memory _name, string memory _description, string memory _image,
        string memory _icon16x16, string memory _icon32x32, string memory _icon64x64,
        bool _committed
    ) internal {
        require(bytes(_name).length != 0, "BrandRegistry: use a non-empty name");
        require(bytes(_description).length != 0, "BrandRegistry: use a non-empty description");
        require(bytes(_image).length != 0, "BrandRegistry: use a non-empty image url");

        // 1. Increment the counter and generate the new brand address.
        //    In the extremely unlikely case that the brand id is 0, this
        //    call will revert.
        brandsCount += 1;
        address brandId = address(uint160(uint256(keccak256(
            abi.encodePacked(
                bytes1(0xd6), bytes1(0x94), address(this), _sender,
                bytes32(brandsCount)
            )
        ))));
        require(
            brandId != address(0),
            "BrandRegistry: this brand cannot be minted now - try again later"
        );

        // 2. Register the brand.
        brands[brandId] = BrandMetadata({
            name: _name, description: _description, challengeUrl: "about:blank",
            image: _image, icon16x16: _icon16x16, icon32x32: _icon32x32,
            icon64x64: _icon64x64, owner: _sender, committed: _committed
        });

        // 3. Mint the brand into the economic system for the sender.
        IMetaverse(metaverse).mintBrandFor(_sender, brandId);

        // 4. Trigger the event.
        emit BrandRegistered(_sender, brandId, _name, _description, msg.value, _mintedBy);
    }

    /**
     * Registers a new brand, when the appropriate price is paid for it.
     * For more details on how this method works, check _registerBrand's
     * inline documentation.
     */
    function registerBrand(
        bytes memory _delegation,
        string memory _name, string memory _description, string memory _image,
        string memory _icon16x16, string memory _icon32x32, string memory _icon64x64
    ) public payable delegable(_delegation, _delegation.length == 0 ? bytes32(0) : keccak256(abi.encodePacked(_name, _description, _image)))  {
        address sender = msg.sender;
        if (IMetaverse(metaverse).isAllowed(METAVERSE_MINT_BRAND_FOR, msg.sender)) {
            _requireNoPrice("BrandRegistry: brand registration");
        } else {
            _requireNativeTokenPrice("BrandRegistry: brand registration", brandRegistrationCost, 1);
        }
        require(
            brandEarningsReceiver != address(0),
            "BrandRegistry: brand registration is disabled since no setup is done for the earnings receiver"
        );
        _registerBrand(
            _msgSender(), address(0), _name, _description, _image, _icon16x16, _icon32x32, _icon64x64, false
        );
        payable(brandEarningsReceiver).transfer(msg.value);
    }

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
    function updateBrandSocialCommitment(address _brandId, bool _committed) public
        nonDelegable onlyMetaverseAllowed(METAVERSE_SET_BRAND_COMMITMENT)
    {
        // Require the flag to exist.
        address owner = brands[_brandId].owner;
        require(owner != address(0), "BrandRegistry: non-existing brand");

        // Require the sender to be allowed to set brands' commitment.
        address sender = _msgSender();

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
    function onBrandOwnerChanged(address _brandId, address _newOwner) external nonDelegable onlyMetaverse {
        if (brands[_brandId].owner != address(0)) brands[_brandId].owner = _newOwner;
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
    function updateBrandImage(
        bytes memory _delegation,
        address _brandId, string memory _image
    ) public delegable(_delegation, _delegation.length == 0 ? bytes32(0) : keccak256(abi.encodePacked(_brandId, _image)))
      onlyBrandAllowed(_brandId, BRAND_AESTHETICS_EDITION)
    {
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
        bytes memory _delegation,
        address _brandId, string memory _challengeUrl
    ) public delegable(_delegation, _delegation.length == 0 ? bytes32(0) : keccak256(abi.encodePacked(_brandId, _challengeUrl)))
      onlyBrandAllowed(_brandId, BRAND_AESTHETICS_EDITION) {
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
        bytes memory _delegation,
        address _brandId, string memory _icon
    ) public delegable(_delegation, _delegation.length == 0 ? bytes32(0) : keccak256(abi.encodePacked(_brandId, _icon))) onlyBrandAllowed(_brandId, BRAND_AESTHETICS_EDITION) {
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
        bytes memory _delegation,
        address _brandId, string memory _icon
    ) public delegable(_delegation, _delegation.length == 0 ? bytes32(0) : keccak256(abi.encodePacked(_brandId, _icon))) onlyBrandAllowed(_brandId, BRAND_AESTHETICS_EDITION) {
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
        bytes memory _delegation,
        address _brandId, string memory _icon
    ) public delegable(_delegation, _delegation.length == 0 ? bytes32(0) : keccak256(abi.encodePacked(_brandId, _icon)))
      onlyBrandAllowed(_brandId, BRAND_AESTHETICS_EDITION) {
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
            brand.committed ? 'true' : 'false',',"type":"brand"}}'
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
     * A brand registry satisfies the IBrandRegistry and IERC165.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC165).interfaceId ||
               interfaceId == type(IBrandRegistry).interfaceId ||
               interfaceId == type(IMetaverseOwned).interfaceId;
    }

    // Brand permissions management start here.

    /**
     * Restricts an action to senders that are considered to have
     * certain permission in the (non-zero) brand.
     */
    modifier onlyBrandAllowed(address _brandId, bytes32 _permission) {
        require(
            isBrandAllowed(_brandId, _permission, _msgSender()),
            "BrandRegistry: caller is not brand owner nor approved, and does not have the required permission"
        );
        _;
    }

    /**
     * Restricts an action to senders that are considered to have
     * certain metaverse-scoped permissions.
     */
    modifier onlyMetaverseAllowed(bytes32 _permission) {
        require(
            IMetaverse(metaverse).isAllowed(_permission, _msgSender()),
            "BrandRegistry: caller is not metaverse owner, and does not have the required permission"
        );
        _;
    }

    /**
     * Tells whether a user has a specific permission on a specific brand
     * or it is allowed by the brand's ownership.
     */
    function isBrandAllowed(address _brandId, bytes32 _permission, address _sender) public view returns (bool) {
        address owner = brands[_brandId].owner;
        return owner != address(0) && (_sender == owner || _isBrandOwnerApproved(owner, _sender) ||
                                       brandPermissions[_brandId][SUPERUSER][_sender] ||
                                       brandPermissions[_brandId][_permission][_sender]);
    }

    /**
     * Tells whether the address is a committed brand, or not
     * (this may also be caused by the address not being a brand).
     */
    function isCommitted(address _brandId) external view returns (bool) {
        return brands[_brandId].committed;
    }

    /**
     * This event is triggered when a brand permission is set or revoked
     * for a given user in a given brand.
     */
    event BrandPermissionChanged(address indexed brandId, bytes32 indexed permission, address indexed user,
                                 bool set, address sender);

    /**
     * Grants a permission to a user. This action is reserved to owners,
     * approved operators, or allowed superusers. However, superuser cannot
     * set, in particular, the SUPERUSER permission itself.
     */
    function brandSetPermission(
        bytes memory _delegation,
        address _brandId, bytes32 _permission, address _user, bool _allowed
    ) public nonDelegable onlyBrandAllowed(_brandId, SUPERUSER) {
        address owner = brands[_brandId].owner;
        address sender = _msgSender();
        require(_user != address(0), "BrandRegistry: cannot grant a permission to address 0");
        require(
            sender == owner || _isBrandOwnerApproved(owner, sender) || _permission != SUPERUSER,
            "BrandRegistry: SUPERUSER permission cannot be added by this user"
        );
        brandPermissions[_brandId][_permission][_user] = _allowed;
        emit BrandPermissionChanged(_brandId, _permission, _user, _allowed, sender);
    }

    /**
     * Implements the way for the delegable context to return a metaverse.
     */
    function _metaverse() internal view override returns (address) {
        return metaverse;
    }
}
