// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRegistry} from "@ens/v2/registry/interfaces/IRegistry.sol";
import {Script, console} from "forge-std/Script.sol";

import {FairyResolver} from "../src/FairyResolver.sol";

/// @notice Deploys FairyResolver with CREATE2 through the deterministic
///         deployment proxy, so it has the same address on every supported
///         chain. Deploy every chain from the same commit, since any change to
///         the contract's bytecode changes the address.
///
///   forge script script/DeployFairyResolver.s.sol --rpc-url sepolia --broadcast --skip-simulation --account <name>
///
/// `--skip-simulation` makes forge take the gas limit from the node's
/// `eth_estimateGas`. Forge's own simulation prices code deposits with an older
/// gas schedule: on Sepolia the deploy needs ~20M gas but forge would set ~4M,
/// and the CREATE2 runs out of gas.
///
/// Re-running on a chain where it's already deployed does nothing.
contract DeployFairyResolver is Script {
    bytes32 constant SALT = keccak256("ENS Fairy");

    function run() external returns (FairyResolver resolver) {
        resolver = FairyResolver(
            vm.computeCreate2Address(SALT, keccak256(type(FairyResolver).creationCode))
        );

        if (address(resolver).code.length > 0) {
            console.log("Already deployed:", address(resolver));
        } else {
            vm.startBroadcast();
            resolver = new FairyResolver{salt: SALT}();
            vm.stopBroadcast();
            console.log("FairyResolver:", address(resolver));
        }

        // Guard against a wrong registry address in the contract
        (, string memory label) = IRegistry(address(resolver.ETH_REGISTRY())).getParent();
        require(keccak256(bytes(label)) == keccak256("eth"), "not the .eth registry");

        console.log("Set chain", block.chainid, "in src/lib/contracts.ts to this address");
    }
}
