// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * This trait provides the functionality of quasi-opaque payment
 * boxes. Boxes can be paid to (it will be resolved elsewhere),
 * and the balances will be notified (this contract will track
 * the balances to keep them up to date when a payment is received
 * and will allow certain addresses to retrieve them from certain
 * boxes, under criteria that must be set later).
 */
abstract contract RealWorldPaymentsBoxesMixin is Context {
    /**
     * Tracks the box funds in terms of both native and tokens
     * (ERC1155 - the only related contract).
     */
    struct BoxFunds {
        /**
         * Flag for existing boxes.
         */
        bool exists;

        /**
         * The amount of native tokens in this box.
         */
        uint256 native;

        /**
         * The amount of ERC1155 tokens in this box.
         */
        mapping(uint256 => uint256) tokens;
    }

    /**
     * Tracks the existing boxes, but by the 3rd hash instead of the
     * box id directly.
     */
    mapping(bytes32 => BoxFunds) private boxes;

    /**
     * An existing, pending, payment.
     */
    struct Payment {
        /**
         * The payment maker this payment was created by.
         */
        address creator;

        /**
         * The box (3rd hash) this payment is created against.
         */
        bytes32 boxIdHash3;
    }

    /**
     * Tracks the existing payments, but by the 1st hash instead of
     * the box payment ids directly, and the 3rd hash instead of the
     * box ids directly.
     */
    mapping(bytes32 => Payment) private payments;

    /**
     * Account permissions associated to this box
     * (General management is not included here).
     */
    struct BoxPermissions {
        /**
         * Users that are allowed to create payment channels
         * for this box. Accounts who make payments also are
         * the valid signers for them.
         */
        mapping(bytes32 => bool) paymentMakeAllowed;

        /**
         * Users that are allowed to withdraw from this box.
         */
        mapping(bytes32 => bool) withdrawAllowed;
    }

    /**
     * Tracks the withdraw allowed accounts for a given box. The
     * accounts are specified by their hash.
     */
    mapping(bytes32 => BoxPermissions) private boxPermissions;

    /**
     * Computes a hash of a previous bytes32 value (hash o id).
     */
    function _hash(bytes32 _value) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_value));
    }

    /**
     * Makes a box. The box id's second hash must be specified
     * a priori, having the original box id appropriately kept
     * (as secret as possible).
     */
    function _makeBox(bytes32 _boxIdHash2) internal {
        bytes32 boxIdHash3 = _hash(_boxIdHash2);
        require(!boxes[boxIdHash3].exists, "RealWorldPaymentsPlugin: Colliding or already existing box");
        // Marks true to create a new box.
        boxes[boxIdHash3].exists = true;
    }

    /**
     * Funds a specific box. This method will be called only in
     * a consistent context: when receiving a batch-token payment,
     * a single-token payment, or a native payment.
     *
     * Boxes, in this method, are identified by their 2nd hash,
     * instead of directly. There are security concerns related
     * to using the box id directly.
     */
    function _fund(
        bytes32 _boxIdHash3, uint256 _native, uint256[] memory _ids, uint256[] memory _values
    ) internal {
        BoxFunds storage box = boxes[_boxIdHash3];
        require(box.exists, "RealWorldPaymentsPlugin: The box does not exist");
        box.native += _native;
        uint256 length = _ids.length;
        for(uint256 index = 0; index < length; index++) {
            box.tokens[_ids[index]] += _values[index];
        }
    }

    /**
     * Returns the native balance of a box. If the box does not
     * exist, it returns 0.
     */
    function balance(bytes32 _boxId) external view returns (uint256) {
        return boxes[_hash(_hash(_hash(_boxId)))].native;
    }

    /**
     * Returns the balance of a box for a given token. If the box
     * does not exist, it returns 0.
     */
    function balanceOf(bytes32 _boxId, uint256 _id) external view returns (uint256) {
        return boxes[_hash(_hash(_hash(_boxId)))].tokens[_id];
    }

    /**
     * Returns the balances of a box for given tokens. If the box
     * does not exist, it returns an array of zeros of the same
     * length of the input array.
     */
    function balanceOfBatch(bytes32 _boxId, uint256[] calldata _ids) external view returns (uint256[] memory) {
        BoxFunds storage box = boxes[_hash(_hash(_hash(_boxId)))];
        uint256 length = _ids.length;
        uint256[] memory values = new uint256[](length);
        for(uint256 index = 0; index < length; index++) {
            values[index] = box.tokens[_ids[index]];
        }
        return values;
    }

    /**
     * Returns whether a given sender can [un]set accounts to
     * withdraw funds from a given box. The box id is given
     * as a hash instead of directly.
     */
    function _canAllowAccounts(address _sender, bytes32 _boxIdHash) internal virtual view returns (bool);

    /**
     * Returns the contract being used as ERC1155 source of truth.
     */
    function _economy() internal virtual view returns (address);

    /**
     * Sets or clears a permission to withdraw funds from a box for
     * a given account. The account is specified by its hash.
     */
    function setWithdrawAllowance(bytes32 _boxIdHash, bytes32 _accountHash, bool _allow) external {
        bytes32 boxIdHash3 = _hash(_hash(_boxIdHash));
        BoxFunds storage box = boxes[boxIdHash3];
        require(!box.exists, "RealWorldPaymentsPlugin: The box does not exist");
        require(
            _canAllowAccounts(_msgSender(), _boxIdHash),
            "RealWorldPaymentsPlugin: the sender is not allowed to set/clear withdrawal permission in the specified box"
        );
        boxPermissions[boxIdHash3].withdrawAllowed[_accountHash] = _allow;
    }

    /**
     * Sets or clears a permission to make payments for a box for
     * a given account. The account is specified by its hash.
     */
    function setPaymentMakeAllowance(bytes32 _boxIdHash, bytes32 _accountHash, bool _allow) external {
        bytes32 boxIdHash3 = _hash(_hash(_boxIdHash));
        BoxFunds storage box = boxes[boxIdHash3];
        require(!box.exists, "RealWorldPaymentsPlugin: The box does not exist");
        require(
            _canAllowAccounts(_msgSender(), _boxIdHash),
            "RealWorldPaymentsPlugin: the sender is not allowed to set/clear payment making permission in the specified box"
        );
        boxPermissions[boxIdHash3].paymentMakeAllowed[_accountHash] = _allow;
    }

    /**
     * Clears withdrawal / payment making permissions from a box for all the accounts.
     */
    function resetBoxPermissions(bytes32 _boxIdHash) external {
        bytes32 boxIdHash3 = _hash(_hash(_boxIdHash));
        BoxFunds storage box = boxes[boxIdHash3];
        require(!box.exists, "RealWorldPaymentsPlugin: The box does not exist");
        require(
            _canAllowAccounts(_msgSender(), _boxIdHash),
            "RealWorldPaymentsPlugin: the sender is not allowed to reset withdrawal permissions in the specified box"
        );
        delete boxPermissions[boxIdHash3];
    }

    /**
     * Withdraw funds from an existing box, if the sender is
     * allowed to do it.
     */
    function withdraw(
        bytes32 _boxIdHash2, uint256 _native, uint256[] calldata _ids, uint256[] calldata _values
    ) external {
        bytes32 boxIdHash3 = _hash(_boxIdHash2);
        address sender = _msgSender();
        require(
            boxPermissions[boxIdHash3].withdrawAllowed[keccak256(abi.encodePacked(sender))],
            "RealWorldPaymentsPlugin: the sender is not allowed to withdraw from this box"
        );
        require(
            _ids.length == _values.length,
            "RealWorldPaymentsPlugin: token ids and amounts length mismatch"
        );
        BoxFunds storage box = boxes[boxIdHash3];
        // Remove the values (it will underflow):
        box.native -= _native;
        uint256 length = _ids.length;
        for(uint256 index = 0; index < length; index++) {
            box.tokens[_ids[index]] -= _values[index];
        }
        // By the end, transfer everything.
        if (_ids.length > 0) IERC1155(_economy()).safeBatchTransferFrom(
            address(this), sender, _ids, _values, "RealWorldPaymentsPlugin: withdraw"
        );
        if (_native > 0) {
            (bool success,) = sender.call{value: _native}("");
            require(success, "RealWorldPaymentsPlugin: error while withdrawing native tokens");
        }
    }

    /**
     * Makes a payment, but using the payment id hash and the
     * box id's 3rd hash.
     */
    function makePayment(bytes32 _paymentIdHash, bytes32 _boxIdHash3) external {
        Payment storage payment = payments[_paymentIdHash];
        require(payment.creator == address(0), "RealWorldPaymentsPlugin: payment already exists");
        BoxFunds storage box = boxes[_boxIdHash3];
        require(box.exists, "RealWorldPaymentsPlugin: The box does not exist");
        BoxPermissions storage boxPerms = boxPermissions[_boxIdHash3];
        address sender = _msgSender();
        require(
            boxPerms.paymentMakeAllowed[keccak256(abi.encode(sender))],
            "RealWorldPaymentsPlugin: The sender is not allowed to make payments"
        );
        payment.creator = sender;
        payment.boxIdHash3 = _boxIdHash3;
    }

    /**
     * Kills a payment, also determined by the box id hash.
     */
    function killPayment(bytes32 _boxIdHash, bytes32 _paymentIdHash) internal {
        bytes32 boxIdHash3 = _hash(_hash(_boxIdHash));
        Payment storage payment = payments[_paymentIdHash];
        require(payment.creator == address(0), "RealWorldPaymentsPlugin: payment already exists");
        require(
            boxIdHash3 == payment.boxIdHash3,
            "RealWorldPaymentsPlugin: payment is not related to the given box"
        );
        address sender = _msgSender();
        require(
            payment.creator == sender || _canAllowAccounts(sender, _boxIdHash),
            "RealWorldPaymentsPlugin: the sender is not allowed to kill this payment"
        );
        delete payments[_paymentIdHash];
    }
}
