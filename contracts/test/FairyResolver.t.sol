// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAddrResolver} from "@ens/resolvers/profiles/IAddrResolver.sol";
import {IAddressResolver} from "@ens/resolvers/profiles/IAddressResolver.sol";
import {IABIResolver} from "@ens/resolvers/profiles/IABIResolver.sol";
import {IDataResolver} from "@ens/resolvers/profiles/IDataResolver.sol";
import {IHasAddressResolver} from "@ens/resolvers/profiles/IHasAddressResolver.sol";
import {IInterfaceResolver} from "@ens/resolvers/profiles/IInterfaceResolver.sol";
import {INameResolver} from "@ens/resolvers/profiles/INameResolver.sol";
import {ITextResolver} from "@ens/resolvers/profiles/ITextResolver.sol";
import {IMulticallable} from "@ens/resolvers/IMulticallable.sol";
import {ResolverFeatures} from "@ens/resolvers/ResolverFeatures.sol";
import {IUniversalResolver} from "@ens/universalResolver/IUniversalResolver.sol";
import {COIN_TYPE_DEFAULT} from "@ens/utils/ENSIP19.sol";
import {NameCoder} from "@ens/utils/NameCoder.sol";
import {IETHRegistrar} from "@ens/v2/registrar/interfaces/IETHRegistrar.sol";
import {IPermissionedRegistry} from "@ens/v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ens/v2/registry/interfaces/IRegistry.sol";
import {IRecordResolver} from "@ens/v2/resolver/interfaces/IRecordResolver.sol";
import {IAddressSetter} from "@ens/v2/resolver/interfaces/setters/IAddressSetter.sol";
import {IContenthashSetter} from "@ens/v2/resolver/interfaces/setters/IContenthashSetter.sol";
import {ITextSetter} from "@ens/v2/resolver/interfaces/setters/ITextSetter.sol";
import {LibLabel} from "@ens/v2/utils/LibLabel.sol";
import {IERC1155} from "@openzeppelin/token/ERC1155/IERC1155.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
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
    address delegate = makeAddr("delegate");

    string label;
    bytes name;
    bytes32 node;

    function setUp() public {
        vm.createSelectFork(
            vm.envOr("SEPOLIA_RPC_URL", string("https://ethereum-sepolia-rpc.publicnode.com"))
        );
        resolver = new FairyResolver();
        assertEq(address(resolver.ETH_REGISTRY()), address(ETH_REGISTRY));

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

    function test_advertisesSameInterfacesAsV2Resolvers() public view {
        // What the ENS manager probes for to pick name-based setters
        assertTrue(resolver.supportsInterface(bytes4(keccak256("setAddress(bytes,uint256,bytes)"))));
        assertTrue(resolver.supportsInterface(type(IAddressSetter).interfaceId));
        assertTrue(resolver.supportsInterface(type(ITextSetter).interfaceId));
        assertTrue(resolver.supportsInterface(type(IContenthashSetter).interfaceId));
        assertTrue(resolver.supportsInterface(type(IMulticallable).interfaceId));
        assertTrue(resolver.supportsInterface(0x9061b923)); // IExtendedResolver
        assertTrue(resolver.supportsInterface(0x01ffc9a7)); // IERC165
        assertTrue(resolver.supportsFeature(ResolverFeatures.RESOLVE_MULTICALL));
    }

    function test_emitsV2RecordEvents() public {
        _gift(gifter, recipient);
        uint256 recordId = resolver.getRecordId(name);

        vm.startPrank(recipient);
        vm.expectEmit(address(resolver));
        emit IRecordResolver.Linked(recordId, node, name);
        vm.expectEmit(address(resolver));
        emit IAddressSetter.AddressUpdated(recordId, 60, abi.encodePacked(elsewhere));
        resolver.setAddress(name, 60, abi.encodePacked(elsewhere));

        vm.expectEmit(address(resolver));
        emit IRecordResolver.Cleared(recordId);
        resolver.clearRecords(name);
        uint256 nextRecordId = resolver.getRecordId(name);
        assertNotEq(nextRecordId, recordId);

        vm.expectEmit(address(resolver));
        emit IRecordResolver.Linked(nextRecordId, node, name);
        resolver.setText(name, "url", "https://fairy.example");
        vm.stopPrank();
    }

    function test_recordIdFollowsRegistration() public {
        _gift(gifter, recipient);
        uint256 recordId = resolver.getRecordId(name);
        uint256 tokenId = ETH_REGISTRY.getTokenId(LibLabel.id(label));

        vm.prank(recipient);
        IERC1155(address(ETH_REGISTRY)).safeTransferFrom(recipient, stranger, tokenId, 1, "");
        assertEq(resolver.getRecordId(name), recordId, "transfer changed the record");

        vm.warp(block.timestamp + 2 * DURATION);
        _gift(stranger, stranger);
        assertNotEq(resolver.getRecordId(name), recordId, "re-registration kept the record");
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
        assertFalse(resolver.canModifyName(name, operator));

        vm.prank(recipient);
        resolver.setApprovalForAll(operator, true);

        vm.prank(operator);
        resolver.setText(name, "com.github", "gskril");
        assertEq(_resolveText("com.github"), "gskril");
        assertTrue(resolver.canModifyName(name, operator));

        vm.prank(recipient);
        resolver.setApprovalForAll(operator, false);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(FairyResolver.Unauthorized.selector, name, operator));
        resolver.setText(name, "com.github", "someone-else");
    }

    function test_approvedDelegateCanWriteOneName() public {
        _gift(gifter, recipient);

        vm.prank(recipient);
        resolver.approve(node, delegate, true);
        assertTrue(resolver.isApprovedFor(recipient, node, delegate));

        vm.prank(delegate);
        resolver.setText(name, "com.github", "gskril");
        assertEq(_resolveText("com.github"), "gskril");

        // A delegate can't hand out approvals of its own
        vm.prank(delegate);
        resolver.approve(node, stranger, true);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(FairyResolver.Unauthorized.selector, name, stranger));
        resolver.setText(name, "com.github", "someone-else");
    }

    function test_cannotApproveSelf() public {
        vm.startPrank(recipient);
        vm.expectRevert(FairyResolver.InvalidApproval.selector);
        resolver.setApprovalForAll(recipient, true);
        vm.expectRevert(FairyResolver.InvalidApproval.selector);
        resolver.approve(node, recipient, true);
        vm.stopPrank();
    }

    function test_approvalsDontFollowTransfers() public {
        _gift(gifter, recipient);
        vm.startPrank(recipient);
        resolver.setApprovalForAll(operator, true);
        resolver.approve(node, delegate, true);
        IERC1155(address(ETH_REGISTRY))
            .safeTransferFrom(
                recipient, stranger, ETH_REGISTRY.getTokenId(LibLabel.id(label)), 1, ""
            );
        vm.stopPrank();

        assertFalse(resolver.canModifyName(name, operator));
        assertFalse(resolver.canModifyName(name, delegate));
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

    function test_defaultAddressAppliesToEthAndOtherEVMChains() public {
        _gift(gifter, recipient);

        vm.prank(recipient);
        resolver.setAddress(name, COIN_TYPE_DEFAULT, abi.encodePacked(elsewhere));

        (address resolved,) = _resolveAddr();
        assertEq(resolved, elsewhere);
        uint256 base = COIN_TYPE_DEFAULT | 8453;
        (bytes memory result,) =
            UNIVERSAL_RESOLVER.resolve(name, abi.encodeCall(IAddressResolver.addr, (node, base)));
        assertEq(abi.decode(result, (bytes)), abi.encodePacked(elsewhere));
    }

    function test_servesEveryRecordProfile() public {
        _gift(gifter, recipient);

        bytes[] memory calls = new bytes[](4);
        calls[0] = abi.encodeCall(resolver.setData, (name, "avatar", hex"cafe"));
        calls[1] = abi.encodeCall(resolver.setName, (name, "fairy.eth"));
        calls[2] = abi.encodeCall(resolver.setABI, (name, 1, bytes("[]")));
        calls[3] = abi.encodeCall(resolver.setInterface, (name, bytes4(0x12345678), elsewhere));
        vm.prank(recipient);
        resolver.multicall(calls);

        // One resolve-multicall, the way the Universal Resolver batches reads
        bytes[] memory reads = new bytes[](6);
        reads[0] = abi.encodeCall(IDataResolver.data, (node, "avatar"));
        reads[1] = abi.encodeCall(INameResolver.name, (node));
        reads[2] = abi.encodeCall(IABIResolver.ABI, (node, 1));
        reads[3] = abi.encodeCall(IInterfaceResolver.interfaceImplementer, (node, 0x12345678));
        reads[4] = abi.encodeCall(IHasAddressResolver.hasAddr, (node, 60));
        reads[5] = abi.encodeCall(IAddrResolver.addr, (node));
        bytes[] memory results = abi.decode(
            resolver.resolve(name, abi.encodeCall(IMulticallable.multicall, (reads))), (bytes[])
        );

        assertEq(abi.decode(results[0], (bytes)), hex"cafe");
        assertEq(abi.decode(results[1], (string)), "fairy.eth");
        (uint256 contentType, bytes memory abiData) = abi.decode(results[2], (uint256, bytes));
        assertEq(contentType, 1);
        assertEq(abiData, bytes("[]"));
        assertEq(abi.decode(results[3], (address)), elsewhere);
        // The owner default isn't a stored address
        assertFalse(abi.decode(results[4], (bool)));
        assertEq(abi.decode(results[5], (address)), recipient);
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
        vm.expectRevert(
            abi.encodeWithSelector(IAddressSetter.InvalidEVMAddress.selector, hex"1234")
        );
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
    // Deployment
    ////////////////////////////////////////////////////////////////////////

    function test_rejectsUnknownChains() public {
        vm.chainId(10);
        vm.expectRevert(abi.encodeWithSelector(FairyResolver.UnsupportedChain.selector, 10));
        new FairyResolver();
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
