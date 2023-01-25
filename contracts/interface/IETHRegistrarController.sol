//SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;

interface IETHRegistrarController {
    function rentPrice(string memory, uint256)
        external
        returns(uint);

    function commit(bytes32) external;

    function registerWithConfig(
        string calldata,
        address,
        uint256,
        bytes32,
        address,
        address
    ) external payable;

}
