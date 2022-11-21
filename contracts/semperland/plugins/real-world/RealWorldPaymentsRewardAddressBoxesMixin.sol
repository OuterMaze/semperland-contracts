// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * This contract provides a way to access some funds that
 * actually belong to this contract but can easily be handled
 * without the complexity of more ERC1155 or native calls.
 * Users can call functions on their own behalf (there is no
 * place for operators / approved users) to add or remove
 * funds (both or native) from this contract.
 */
abstract contract RealWorldPaymentsRewardAddressBoxesMixin is Context {
    /**
     * Balances for each address.
     */
    mapping(address => mapping(uint256 => uint256)) public balances;

    /**
     * The Economy contract this trait is related to.
     */
    function _economy() internal view virtual returns (address);

    /**
     * Adds token balance to the local balances of the source address.
     */
    function _fundToken(address _from, uint256 _id, uint256 _value) internal {
        balances[_from][_id] += _value;
    }

    /**
     * Adds tokens balances to the local balances of the source address.
     */
    function _fundTokens(address _from, uint256[] calldata _ids, uint256[] calldata _values) internal {
        uint256 length = _ids.length;
        for(uint256 index = 0; index < length; index++) {
            balances[_from][_ids[index]] += _values[index];
        }
    }

    /**
     * Removes tokens balances from the local balances of the source address.
     */
    function _defundTokens(address _from, uint256[] memory _ids, uint256[] memory _values) internal {
        uint256 length = _ids.length;
        for(uint256 index = 0; index < length; index++) {
            balances[_from][_ids[index]] -= _values[index];
        }
    }

    /**
     * Withdraws token balance from the local balances of the sender address.
     */
    function withdrawToken(uint256 _id, uint256 _value) external {
        address sender = _msgSender();
        balances[sender][_id] -= _value;
        IERC1155(_economy()).safeTransferFrom(
            address(this), sender, _id, _value, "RealWorldPaymentsPlugin: withdraw"
        );
    }

    /**
     * Withdraws tokens balances from the local balances of the sender address.
     */
    function withdrawTokens(uint256[] calldata _ids, uint256[] calldata _values) external {
        uint256 length = _ids.length;
        require(
            length == _values.length,
            "token ids and amounts length mismatch or 0"
        );
        address sender = _msgSender();
        for(uint256 index = 0; index < length; index++) {
            balances[sender][_ids[index]] -= _values[index];
        }
        IERC1155(_economy()).safeBatchTransferFrom(
            address(this), sender, _ids, _values, "RealWorldPaymentsPlugin: withdraw"
        );
    }
}
