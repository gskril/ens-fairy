// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import {IETHRegistrarController} from "../interface/IETHRegistrarController.sol";
import {IPriceOracle} from "../interface/IPriceOracle.sol";

contract ENSFlow {
    address public resolver;
    IETHRegistrarController public controller;
    address payable trustedRelayer;

    mapping(address => uint256) public balances;

    event RegisterCommit(
        address indexed sender,
        uint256 value,
        bytes32 commitment
    );

    constructor(
        address _resolver,
        IETHRegistrarController _controller,
        address payable _trustedRelayer
    ) {
        resolver = _resolver;
        controller = _controller;
        trustedRelayer = _trustedRelayer;
    }

    /**
     * @dev Register the name, with the commitment
     *      Pay with the out the door price
     * @param commitment The hash of the current commitment.
     */
    function registerCommit(bytes32 commitment) public payable {
        require(msg.value > 0, "Pay Eth to Register");
        controller.commit(commitment);

        balances[msg.sender] += msg.value;
        emit RegisterCommit(msg.sender, msg.value, commitment);
    }


    /**
     * @dev Register by the Relayer
     * Currently Relayer (msg.sender) is the whitelist user, 
     *  - Relayer is revealing the name and secret.
     *  - Relayer cannot withdraw the balance of sender (who starts the registerCommit)
     */
    function registerRelay(
        string calldata name,
        address sender,
        address owner,
        uint256 duration,
        uint256 value,
        bytes32 secret
    ) public {
        require (msg.sender == trustedRelayer, "not trusted");

        // balance is the balance from the origin buyer. It can be accumulated, which might contains multiple purchase.
        // value is the payment amount for one purchase for one name, which should be equal to or less than balance
        uint256 balance = balances[sender];
        require (balance >= value, "Balance not enough"); 
        balances[sender] = balance - value;

        // cost is the current price cost for one name
        // value is the payment amount for this purchase, which should be greater or equal to cost
        uint cost = controller.rentPrice(name, duration);
        require (value >= cost, "Payment not enough."); 

        controller.registerWithConfig{value: cost}(name, owner, duration, secret, resolver, owner);

        if (value > cost) {
            trustedRelayer.transfer(value - cost);
        }
    }

    /**
     * User can withdraw anytime.
     */
    function withdraw() public {
        uint256 balance = balances[msg.sender];
        require (balance > 0, "No balance to withdraw"); 

        balances[msg.sender] = 0;
        (bool sent, ) = msg.sender.call{value: balance}("");
        require(sent, "Failed to withdraw");
    }
}