// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "../IMetaverse.sol";
import "../IMetaverseOwned.sol";
import "../brands/IBrandRegistry.sol";
import "./ISponsorRegistry.sol";

/**
 * This component manages the sponsoring system. It essentially
 * defines two things:
 * - Who is considered a sponsor (sponsors are typically external accounts operated by servers).
 * - Which brand is a sponsor actually sponsoring (two or more sponsors can sponsor a same brand).
 */
contract SponsorRegistry is ERC165, ISponsorRegistry, IMetaverseOwned {
    /**
     * Addresses can check for ERC165 compliance by using this
     * embeddable library.
     */
    using ERC165Checker for address;

    /**
     * The metaverse this sponsor registry was created for.
     */
    address public metaverse;

    /**
     * The sponsors currently registered.
     */
    mapping(address => bool) public sponsors;

    /**
     * A mapping [sponsor][brand] => true for a brand to be sponsored
     * by a given sponsor. Ony brands can be sponsored.
     */
    mapping(address => mapping(address => bool)) public sponsored;

    /**
     * Permission to manage the sponsors.
     */
    bytes32 constant METAVERSE_MANAGE_SPONSORS = keccak256("Metaverse::Sponsors::Manage");

    /**
     * The only requirement for a sponsor registry is the metaverse.
     */
    constructor(address _metaverse) {
        require(_metaverse != address(0), "SponsorRegistry: the owner contract must not be 0");
        require(
            _metaverse.supportsInterface(type(IMetaverse).interfaceId),
            "SponsorRegistry: the owner contract must implement IMetaverse"
        );
        metaverse = _metaverse;
    }

    /**
     * This event is triggered when a sponsoring setting changes.
     */
    event Sponsored(address indexed _sponsor, address indexed _brandId, bool _sponsored);

    /**
     * Changes a sponsoring setting on a brand.
     */
    function sponsor(address _brandId, bool _sponsored) external {
        require(sponsors[msg.sender] || !_sponsored, "SponsorRegistry: only actual sponsors can sponsor a brand");
        require(
            IBrandRegistry(IMetaverse(metaverse).brandRegistry()).brandExists(_brandId),
            "SponsorRegistry: only brands can be sponsored"
        );
        bool _oldSponsored = sponsored[msg.sender][_brandId];
        sponsored[msg.sender][_brandId] = _sponsored;
        if (_oldSponsored != _sponsored) emit Sponsored(msg.sender, _brandId, _sponsored);
    }

    /**
     * Enables or disables a sponsor.
     */
    function setSponsor(address _sponsor, bool _enabled) external {
        require(
            IMetaverse(metaverse).isAllowed(METAVERSE_MANAGE_SPONSORS, msg.sender),
            "SponsorRegistry: caller is not metaverse owner, and does not have the required permission"
        );
        sponsors[_sponsor] = _enabled;
    }

    /**
     * Extends the interface support to include ISponsorRegistry.
     */
    function supportsInterface(bytes4 _interfaceId) public view override returns (bool) {
        return ERC165.supportsInterface(_interfaceId) ||
               _interfaceId == type(ISponsorRegistry).interfaceId ||
               _interfaceId == type(IMetaverseOwned).interfaceId;
    }
}
