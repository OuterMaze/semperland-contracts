// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./IEconomy.sol";
import "../IMetaverse.sol";
import "../../SafeExchange.sol";

/**
 * An economy system is a regular ERC1155, but the url will
 * not be stated, and also this contract will belong to a
 * particular metaverse.
 */
contract Economy is ERC1155, IEconomy, SafeExchange {
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
        address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data
    ) internal override {
        if (from != address(0)) {
            if (to == address(0)) {
                // A burn. Brands cannot be burned. All the other
                // assets can be burned.
                IMetaverse(metaverse).onTokensBurned(operator, from, ids, amounts);
            } else {
                // A transfer. Brands will be transfer-processed.
                // I could perhaps think about other watches over
                // assets and destinations, but I'll think them later.
                for(uint256 index = 0; index < amounts.length; index++) {
                    if (ids[index] < (1 << 160) && amounts[index] != 0) {
                        IMetaverse(metaverse).onBrandOwnerChanged(address(uint160(ids[index])), to);
                    }
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
               interfaceId == type(IERC1155).interfaceId;
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
     * This modifier restricts function to be only invoked by the metaverse.
     */
    modifier onlyMetaverse() {
        require(msg.sender == metaverse, "Economy: only the owning metaverse can invoke this method");
        _;
    }
}
