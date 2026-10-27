// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAddrResolver} from "@ens/contracts/resolvers/profiles/IAddrResolver.sol";
import {IAddressResolver} from "@ens/contracts/resolvers/profiles/IAddressResolver.sol";
import {ITextResolver} from "@ens/contracts/resolvers/profiles/ITextResolver.sol";
import {IUniversalResolver} from "@ens/contracts/universalResolver/IUniversalResolver.sol";
import {NameCoder} from "@ens/contracts/utils/NameCoder.sol";
import {IETHRegistrar} from "@ens/contracts-v2/registrar/interfaces/IETHRegistrar.sol";
import {
    IPermissionedRegistry
} from "@ens/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ens/contracts-v2/registry/interfaces/IRegistry.sol";
import {LibLabel} from "@ens/contracts-v2/utils/LibLabel.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Test} from "forge-std/Test.sol";

import {FairyResolver} from "../src/FairyResolver.sol";

/// @dev Sepolia's mock payment tokens can be minted by anyone.
interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// @notice Fork tests against the live ENSv2 deployment on Sepolia: names are
///         registered through the real ETHRegistrar and resolved through the
///         Universal Resolver.
///
///   SEPOLIA_RPC_URL=... forge test
contract FairyResolverTest is Test {
    // ENSv2 on Sepolia (matches @ensdomains/ensjs)
    IETHRegistrar constant REGISTRAR = IETHRegistrar(0xf633e7FC17e2bbE0D0965D18ec1821dcB754a3d3);
    IPermissionedRegistry constant ETH_REGISTRY =
        IPermissionedRegistry(0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4);
    IUniversalResolver constant UNIVERSAL_RESOLVER =
        IUniversalResolver(0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe);
    address constant USDC = 0x240b0316Df57887DBBE58b586508b19e633a14aa;

    uint64 constant DURATION = 365 days;

    FairyResolver resolver;

    address gifter = makeAddr("gifter");
    address recipient = makeAddr("recipient");
    address stranger = makeAddr("stranger");
    address operator = makeAddr("operator");
    address elsewhere = makeAddr("elsewhere");

    string label;
    bytes name;
    bytes32 node;

    function setUp() public {
        vm.createSelectFork(
            vm.envOr("SEPOLIA_RPC_URL", string("https://ethereum-sepolia-rpc.publicnode.com"))
        );
        resolver = new FairyResolver(ETH_REGISTRY);

        label = string.concat("fairytest", vm.toString(block.timestamp));
        require(REGISTRAR.isAvailable(label), "test label is taken");
        name = NameCoder.ethName(label);
        node = NameCoder.namehash(name, 0);
    }

    ////////////////////////////////////////////////////////////////////////
    // Gifting
    ////////////////////////////////////////////////////////////////////////

    function test_giftResolvesToRecipientWithNoRecords() public {
        _gift(gifter, recipient);

        (address resolved, address usedResolver) = _resolveAddr();
        assertEq(resolved, recipient);
        assertEq(usedResolver, address(resolver));
        assertEq(resolver.ownerOf(name), recipient);
    }

    function test_coinTypeQueryAlsoDefaultsToOwner() public {
        _gift(gifter, recipient);

        (bytes memory result,) =
            UNIVERSAL_RESOLVER.resolve(name, abi.encodeCall(IAddressResolver.addr, (node, 60)));
        assertEq(abi.decode(result, (bytes)), abi.encodePacked(recipient));
    }

    ////////////////////////////////////////////////////////////////////////
    // ENS manager compatibility
    ////////////////////////////////////////////////////////////////////////

    function test_advertisesNameBasedSetters() public view {
        assertTrue(resolver.supportsInterface(bytes4(keccak256("setAddress(bytes,uint256,bytes)"))));
        assertTrue(resolver.supportsInterface(0x9061b923)); // IExtendedResolver
        assertTrue(resolver.supportsInterface(0x01ffc9a7)); // IERC165
    }

    function test_recipientCanSetAddress() public {
        _gift(gifter, recipient);

        vm.prank(recipient);
        resolver.setAddress(name, 60, abi.encodePacked(elsewhere));

        (address resolved,) = _resolveAddr();
        assertEq(resolved, elsewhere);
        assertTrue(resolver.canModifyName(name, recipient));
    }

    ////////////////////////////////////////////////////////////////////////
    // Access control
    ////////////////////////////////////////////////////////////////////////

    function test_gifterCannotWrite() public {
        _gift(gifter, recipient);

        vm.prank(gifter);
        vm.expectRevert(abi.encodeWithSelector(FairyResolver.Unauthorized.selector, name, gifter));
        resolver.setAddress(name, 60, abi.encodePacked(gifter));
    }

    function test_strangerCannotWrite() public {
        _gift(gifter, recipient);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(FairyResolver.Unauthorized.selector, name, stranger));
        resolver.setText(name, "url", "https://evil.example");
    }

    function test_unregisteredNameCannotBeWritten() public {
        vm.prank(gifter);
        vm.expectRevert(abi.encodeWithSelector(FairyResolver.Unauthorized.selector, name, gifter));
        resolver.setText(name, "url", "https://early.example");
    }

    function test_approvedOperatorCanWrite() public {
        _gift(gifter, recipient);

        vm.prank(recipient);
        resolver.setApprovalForAll(operator, true);

        vm.prank(operator);
        resolver.setText(name, "com.github", "gskril");
        assertEq(_resolveText("com.github"), "gskril");
        assertTrue(resolver.canModifyName(name, operator));
    }

    ////////////////////////////////////////////////////////////////////////
    // Records
    ////////////////////////////////////////////////////////////////////////

    function test_multicallWritesResolveThroughUniversalResolver() public {
        _gift(gifter, recipient);

        bytes[] memory calls = new bytes[](3);
        calls[0] = abi.encodeCall(resolver.setText, (name, "description", "gifted with ENS Fairy"));
        calls[1] = abi.encodeCall(resolver.setAddress, (name, 60, abi.encodePacked(elsewhere)));
        calls[2] = abi.encodeCall(resolver.setContenthash, (name, hex"e301"));
        vm.prank(recipient);
        resolver.multicall(calls);

        (address resolved,) = _resolveAddr();
        assertEq(resolved, elsewhere);
        assertEq(_resolveText("description"), "gifted with ENS Fairy");
    }

    function test_clearRecordsRestoresOwnerDefault() public {
        _gift(gifter, recipient);

        vm.startPrank(recipient);
        resolver.setAddress(name, 60, abi.encodePacked(elsewhere));
        resolver.setText(name, "description", "temporary");
        resolver.clearRecords(name);
        vm.stopPrank();

        (address resolved,) = _resolveAddr();
        assertEq(resolved, recipient);
        assertEq(_resolveText("description"), "");
    }

    function test_explicitlyEmptyAddressResolvesToZero() public {
        _gift(gifter, recipient);

        vm.prank(recipient);
        resolver.setAddress(name, 60, "");

        (address resolved,) = _resolveAddr();
        assertEq(resolved, address(0));
    }

    function test_rejectsMalformedEVMAddresses() public {
        _gift(gifter, recipient);

        vm.prank(recipient);
        vm.expectRevert(abi.encodeWithSelector(FairyResolver.InvalidEVMAddress.selector, hex"1234"));
        resolver.setAddress(name, 60, hex"1234");
    }

    function test_rejectsNamesOtherThanSecondLevelEth() public {
        bytes memory subname = NameCoder.encode(string.concat("sub.", label, ".eth"));
        vm.expectRevert(abi.encodeWithSelector(FairyResolver.UnsupportedName.selector, subname));
        resolver.ownerOf(subname);

        bytes memory otherTld = NameCoder.encode("fairy.com");
        vm.expectRevert(abi.encodeWithSelector(FairyResolver.UnsupportedName.selector, otherTld));
        resolver.ownerOf(otherTld);
    }

    ////////////////////////////////////////////////////////////////////////
    // Transfers and re-registration
    ////////////////////////////////////////////////////////////////////////

    function test_transferMovesDefaultAddressAndControl() public {
        _gift(gifter, recipient);
        uint256 tokenId = ETH_REGISTRY.getTokenId(LibLabel.id(label));

        vm.prank(recipient);
        IERC1155(address(ETH_REGISTRY)).safeTransferFrom(recipient, stranger, tokenId, 1, "");

        (address resolved,) = _resolveAddr();
        assertEq(resolved, stranger);

        vm.prank(stranger);
        resolver.setText(name, "description", "bought it");

        vm.prank(recipient);
        vm.expectRevert(
            abi.encodeWithSelector(FairyResolver.Unauthorized.selector, name, recipient)
        );
        resolver.setText(name, "description", "not anymore");
    }

    function test_reregistrationStartsWithNoRecords() public {
        _gift(gifter, recipient);
        vm.startPrank(recipient);
        resolver.setAddress(name, 60, abi.encodePacked(elsewhere));
        resolver.setText(name, "description", "previous owner");
        vm.stopPrank();

        // Well past expiry and the grace period
        vm.warp(block.timestamp + 2 * DURATION);

        // The Universal Resolver won't resolve an expired name, so ask the
        // resolver directly whether it still holds the old records
        bytes memory addrResult = resolver.resolve(name, abi.encodeCall(IAddrResolver.addr, (node)));
        assertEq(abi.decode(addrResult, (address)), address(0));
        bytes memory textResult =
            resolver.resolve(name, abi.encodeCall(ITextResolver.text, (node, "description")));
        assertEq(abi.decode(textResult, (string)), "");

        vm.prank(recipient);
        vm.expectRevert(
            abi.encodeWithSelector(FairyResolver.Unauthorized.selector, name, recipient)
        );
        resolver.setText(name, "url", "still mine?");

        _gift(stranger, stranger);

        (address resolved,) = _resolveAddr();
        assertEq(resolved, stranger, "new registrant inherited the old address");
        assertEq(_resolveText("description"), "", "new registrant inherited old text");

        vm.prank(recipient);
        vm.expectRevert(
            abi.encodeWithSelector(FairyResolver.Unauthorized.selector, name, recipient)
        );
        resolver.setText(name, "description", "nope");
    }

    ////////////////////////////////////////////////////////////////////////
    // Helpers
    ////////////////////////////////////////////////////////////////////////

    /// @dev Registers `label` to `owner` through the real registrar, paid by
    ///      `payer`, pointing at the shared resolver: approve, commit, wait,
    ///      register. No resolver deploy and no record writes.
    function _gift(address payer, address owner) internal {
        bytes32 secret = keccak256(abi.encode(payer, owner, block.timestamp));
        (uint256 base, uint256 premium) = REGISTRAR.getRegisterPrice(label, DURATION, IERC20(USDC));

        vm.startPrank(payer);
        IMintable(USDC).mint(payer, base + premium);
        IERC20(USDC).approve(address(REGISTRAR), base + premium);
        REGISTRAR.commit(
            REGISTRAR.makeCommitment(
                label, owner, secret, IRegistry(address(0)), address(resolver), DURATION, bytes32(0)
            )
        );
        vm.warp(block.timestamp + 2 minutes);
        REGISTRAR.register(
            label,
            owner,
            secret,
            IRegistry(address(0)),
            address(resolver),
            DURATION,
            IERC20(USDC),
            bytes32(0)
        );
        vm.stopPrank();
    }

    function _resolveAddr() internal view returns (address resolved, address usedResolver) {
        bytes memory result;
        (result, usedResolver) =
            UNIVERSAL_RESOLVER.resolve(name, abi.encodeCall(IAddrResolver.addr, (node)));
        resolved = abi.decode(result, (address));
    }

    function _resolveText(string memory key) internal view returns (string memory) {
        (bytes memory result,) =
            UNIVERSAL_RESOLVER.resolve(name, abi.encodeCall(ITextResolver.text, (node, key)));
        return abi.decode(result, (string));
    }
}
