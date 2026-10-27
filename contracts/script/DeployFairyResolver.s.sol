// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPermissionedRegistry} from "@ens/v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ens/v2/registry/interfaces/IRegistry.sol";
import {Script, console} from "forge-std/Script.sol";

import {FairyResolver} from "../src/FairyResolver.sol";

/// @notice Deploys FairyResolver against the chain's ENSv2 .eth registry.
///
///   forge script script/DeployFairyResolver.s.sol --rpc-url sepolia --broadcast --account <name>
///
/// Set ETH_REGISTRY to override the registry address.
contract DeployFairyResolver is Script {
    function run() external returns (FairyResolver resolver) {
        IPermissionedRegistry ethRegistry =
            IPermissionedRegistry(vm.envOr("ETH_REGISTRY", _ethRegistry(block.chainid)));

        // Guard against pointing at the wrong registry
        (, string memory label) = IRegistry(address(ethRegistry)).getParent();
        require(keccak256(bytes(label)) == keccak256("eth"), "not the .eth registry");

        vm.startBroadcast();
        resolver = new FairyResolver(ethRegistry);
        vm.stopBroadcast();

        console.log("FairyResolver:", address(resolver));
        console.log(
            string.concat(
                "VITE_FAIRY_RESOLVER_",
                vm.toString(block.chainid),
                "=",
                vm.toString(address(resolver))
            )
        );
    }

    /// @dev ENSv2 .eth registries (what @ensdomains/ensjs calls `ensRegistry`).
    function _ethRegistry(uint256 chainId) internal pure returns (address) {
        if (chainId == 1) return 0xf60aba43E1f7F3DAB1186Ff03B561401C9Df85E2;
        if (chainId == 11155111) return 0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4;
        revert("unsupported chain, set ETH_REGISTRY");
    }
}
