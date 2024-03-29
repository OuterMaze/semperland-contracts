// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./IEconomy.sol";
import "../IMetaverse.sol";
import "../IMetaverseOwned.sol";
import "./SafeExchange.sol";

/**
 * An economy system is a regular ERC1155, but the url will
 * not be stated, and also this contract will belong to a
 * particular metaverse.
 */
contract Economy is ERC1155, IEconomy, IMetaverseOwned, SafeExchange {
    /**
     * Addresses can check for ERC165 compliance by using this
     * embeddable library.
     */
    using ERC165Checker for address;

    /**
     * The metaverse that will own this economy system.
     */
    address public metaverse;

    /**
     * Creating an economy system requires a valid metaverse
     * registrar as its owner.
     */
    constructor(address _metaverse) ERC1155("") {
        require(_metaverse != address(0), "Economy: the owner contract must not be 0");
        require(
            _metaverse.supportsInterface(type(IMetaverse).interfaceId),
            "Economy: the owner contract must implement IMetaverse"
        );
        metaverse = _metaverse;
    }

    /**
     * For the deals: This hook invokes a parent batch transfer involving deals.
     */
    function _batchTransfer(
        uint256 _dealIndex, address _from, address _to, uint256[] memory _tokenIds, uint256[] memory _tokenAmounts
    ) internal override {
        _safeBatchTransferFrom(_from, _to, _tokenIds, _tokenAmounts, abi.encodePacked(
            "Economy: executing deal ", Strings.toString(_dealIndex)
        ));
    }

    /**
     * For the deals: This hook tells whether a sender is allowed for a party in a deal.
     */
    function _isApproved(address _party, address _sender) internal override view returns (bool) {
        return isApprovedForAll(_party, _sender);
    }

    /**
     * Processes a token transfer or burn appropriately. Burns are
     * forwarded using the metaverse.
     */
    function _afterTokenTransfer(
        address, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory
    ) internal override {
        uint256 length = amounts.length;
        if (from != address(0)) {
            // Process transfer:
            if (to != address(0)) {
                // Brands will be transfer-processed.
                for(uint256 index = 0; index < length; index++) {
                    if (ids[index] < (1 << 160) && amounts[index] != 0) {
                        address brandId = address(uint160(ids[index]));
                        _setApprovalForAll(brandId, from, false);
                        _setApprovalForAll(brandId, to, true);
                        IMetaverse(metaverse).onBrandOwnerChanged(brandId, to);
                    }
                }
            }
            // Process transfer or a burn.
            // NFTs will be transfer/burn processed.
            for(uint256 index = 0; index < length; index++) {
                // Other NFT types will have their own process
                // to be notified - all of them through the
                // metaverse instance they live into.
                if (ids[index] < (1 << 255) && ids[index] >= (1 << 160)) {
                    IMetaverse(metaverse).onNFTOwnerChanged(ids[index], to);
                }
            }
        }
        else
        {
            // Minting brands will be processed here, but
            // there is no need of actually sending the
            // onBrandOwnerChanged() event, since brand
            // registry will be aware of the creation.
            // Other assets will not be processed here.
            for(uint256 index = 0; index < length; index++) {
                if (ids[index] < (1 << 160) && amounts[index] != 0) {
                    address brandId = address(uint160(ids[index]));
                    _setApprovalForAll(brandId, to, true);
                }
            }
        }
    }

    /**
     * This brand registry satisfies the IERC1155, the IBrandRegistry and IERC165 interfaces.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, IERC165) returns (bool) {
        return interfaceId == type(IERC165).interfaceId ||
               interfaceId == type(IEconomy).interfaceId ||
               interfaceId == type(IERC1155).interfaceId ||
               interfaceId == type(IMetaverseOwned).interfaceId;
    }

    /**
     * Querying the url is now defined depending on the metaverse.
     */
    function uri(uint256 _tokenId) public view override returns (string memory) {
        return IMetaverse(metaverse).tokenURI(_tokenId);
    }

    /**
     * Mints a token for a particular account.
     */
    function mintFor(address _to, uint256 _tokenId, uint256 _amount, bytes memory _data) public onlyMetaverse {
        _mint(_to, _tokenId, _amount, _data);
    }

    /**
     * Any token ID may be burned, except brands.
     */
    function _requireNonBrandTokenToBurn(uint256 _id) private {
        require(
            _id >= (1 << 160),
            "Economy: only non-brand tokens can be burned this way"
        );
    }

    /**
     * Burns any token from the metaverse (actually: from plugins).
     */
    function burn(address _from, uint256 _tokenId, uint256 _amount) external onlyMetaverse {
        _requireNonBrandTokenToBurn(_tokenId);
        _burn(_from, _tokenId, _amount);
    }

    /**
     * Burns many tokens from the metaverse (actually: from plugins).
     */
    function burnBatch(address _from, uint256[] memory _tokenIds, uint256[] memory _amounts) external onlyMetaverse {
        for(uint256 i = 0; i < _tokenIds.length; i++) {
            _requireNonBrandTokenToBurn(_tokenIds[i]);
        }
        _burnBatch(_from, _tokenIds, _amounts);
    }

    /**
     * This modifier restricts function to be only invoked by the metaverse.
     */
    modifier onlyMetaverse() {
        require(msg.sender == metaverse, "Economy: the only allowed sender is the metaverse system");
        _;
    }

    /**
     * Requires only FTs.
     */
    function _requireFTsOnly(uint256[] memory _tokenIds) private {
        for(uint256 i = 0; i < _tokenIds.length; i++) {
            require(_tokenIds[i] >= (2 ** 255), "Economy: only FTs are allowed in deal exchanges");
        }
    }

    /**
     * Deal start: checks whether the ids are of FTs only.
     */
    function _checkDealStart(
        address _emitter, address _receiver, uint256[] memory _tokenIds, uint256[] memory _tokenAmounts
    ) internal override {
        _requireFTsOnly(_tokenIds);
    }

    /**
     * Deal acceptance: checks whether the ids are of FTs only.
     */
    function _checkDealAccept(
        uint256 _dealIndex, uint256[] memory _tokenIds, uint256[] memory _tokenAmounts
    ) internal override {
        _requireFTsOnly(_tokenIds);
    }
}
