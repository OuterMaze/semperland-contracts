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
abstract contract RealWorldPaymentsAddressBoxes is Context {
    /**
     * Native and ERC1155 balances for a given address.
     */
    struct Box {
        /**
         * Balances of ERC1155 tokens in the related
         * economy contract.
         */
        mapping(uint256 => uint256) tokens;

        /**
         * Balance of native tokens in this contract.
         */
        uint256 native;
    }

    /**
     * Balances for each address.
     */
    mapping(address => Box) public balances;

    /**
     * The Economy contract this trait is related to.
     */
    function _economy() internal view virtual returns (address);

    /**
     * Adds native balance to the local balances of the sender address.
     */
    function fundNative() external payable {
        balances[_msgSender()].native += msg.value;
    }

    /**
     * Adds token balance to the local balances of the source address.
     */
    function _fundToken(address _from, uint256 _id, uint256 _value) internal {
        balances[_from].tokens[_id] += _value;
    }

    /**
     * Adds tokens balances to the local balances of the source address.
     */
    function _fundTokens(address _from, uint256[] calldata _ids, uint256[] calldata _values) internal {
        uint256 length = _ids.length;
        require(
            length == _values.length,
            "token ids and amounts length mismatch or 0"
        );
        for(uint256 index = 0; index < length; index++) {
            balances[_from].tokens[_ids[index]] += _values[index];
        }
    }

    /**
     * Withdraws native balance from the local balances of the sender address.
     */
    function withdrawNative(uint256 _balance) external {
        address sender = _msgSender();
        balances[sender].native -= _balance;
        (bool sent,) = sender.call{value: _balance}("");
        require(sent, "RealWorldPaymentsPlugin: native withdraw failed");
    }

    /**
     * Withdraws token balance from the local balances of the sender address.
     */
    function withdrawToken(uint256 _id, uint256 _value) external {
        address sender = _msgSender();
        balances[sender].tokens[_id] -= _value;
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
            balances[sender].tokens[_ids[index]] -= _values[index];
        }
        IERC1155(_economy()).safeBatchTransferFrom(
            address(this), sender, _ids, _values, "RealWorldPaymentsPlugin: withdraw"
        );
    }
}
