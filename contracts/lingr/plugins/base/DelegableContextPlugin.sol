// SPDX-License-Identifier: MIT
pragma solidity >=0.8 <0.9.0;

import "./MetaversePlugin.sol";

/**
 * A delegable context plug-in has access to the metaverse
 * and can help methods to take a signature argument that
 * can, when tested, delegate the gas cost on another party
 * (this, be it the sponsoring mechanism or not).
 */
abstract contract DelegableContextPlugin is MetaversePlugin {
    /**
     * The true sender of this transaction. If set, _msgSender()
     * will contain this value, and msg.sender will be the
     * payer. If unset, _msgSender() will contain msg.sender
     * and will also be the payer.
     *
     * At the end of the execution of the modifier, this
     * value will be unset.
     */
    address private trueSender;

    /**
     * The current hash of this transaction. It will involve
     * whatever arguments are needed to run the method.
     */
    bytes32 private currentHash;

    /**
     * The timeout of the signature after the emission. The
     * current block timestamp must be between the emission
     * date and (emission date + timeout), Both including.
     *
     * This setting can be managed by the metaverse deployers.
     */
    uint256 public timeout;

    /**
     * This modifier allows a particular method to act as
     * delegable.
     */
    modifier delegable(bytes memory _delegation) {
        if (_delegation.length != 0) {
            (currentHash, trueSender) = IMetaverse(metaverse).checkSignature(_delegation, timeout);
        } else {
            currentHash = 0x0;
            trueSender = address(0);
        }
        _;
    }

    /**
     * This modifier allows a particular method to act as
     * sponsor-only. It should only be used after delegable
     * modifier.
     */
    modifier sponsorOnly(address _brandId) {
        if (trueSender != address(0)) {
            require(_brandId != address(0), "DelegableContextPlugin: when delegated, the brand must be present");
            IMetaverse(metaverse).checkSponsoring(msg.sender, _brandId);
        }
        _;
    }

    /**
     * This modifier allows a particular method to act as not
     * delegable. Nevertheless, it is recommended to be used
     * since a previous method, delegable and with a delegation
     * being passed in, will leave the trueSender in the wrong
     * state (i.e. used, instead of 0).
     */
    modifier nonDelegable {
        currentHash = 0x0;
        trueSender = address(0);
        _;
    }
}
