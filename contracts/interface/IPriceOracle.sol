//SPDX-License-Identifier: MIT
pragma solidity >=0.8.17 <0.9.0;

interface IPriceOracle {

    struct Price {
        uint256 cost; // = value x durationInYears  // actual payments.
        uint256 value; // domain acutal value per year // value per year

        uint256 durationInYears;
        uint256 grabRefund;  // 123.5%
    }

    function resetPrice(
        string calldata name,
        uint256 newValue
    ) external view returns (Price calldata);

    function renewPrice(
        string calldata name,
        uint256 durationInYears
    ) external view returns (Price calldata);

    // if name is owned, return the grab price
    // if name is not owned, calculate the price
    function grabPrice(
        string calldata name,
        uint256 durationInYears
    ) external view returns (Price calldata);

    // if name is owned by owner, return the renew price, default 3 years
    // if name is owned, return the price
    // if name is not owned, calculate the price
    function grabPriceFrom(
        string calldata name,
        uint256 durationInYears,
        address owner
    ) external view returns (Price calldata);

}
