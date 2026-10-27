// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IMulticallable} from "@ens/resolvers/IMulticallable.sol";
import {IABIResolver} from "@ens/resolvers/profiles/IABIResolver.sol";
import {IAddrResolver} from "@ens/resolvers/profiles/IAddrResolver.sol";
import {IAddressResolver} from "@ens/resolvers/profiles/IAddressResolver.sol";
import {IContentHashResolver} from "@ens/resolvers/profiles/IContentHashResolver.sol";
import {IDataResolver} from "@ens/resolvers/profiles/IDataResolver.sol";
import {IExtendedResolver} from "@ens/resolvers/profiles/IExtendedResolver.sol";
import {IHasAddressResolver} from "@ens/resolvers/profiles/IHasAddressResolver.sol";
import {IInterfaceResolver} from "@ens/resolvers/profiles/IInterfaceResolver.sol";
import {INameResolver} from "@ens/resolvers/profiles/INameResolver.sol";
import {ITextResolver} from "@ens/resolvers/profiles/ITextResolver.sol";
import {ResolverFeatures} from "@ens/resolvers/ResolverFeatures.sol";
import {COIN_TYPE_DEFAULT, COIN_TYPE_ETH, ENSIP19} from "@ens/utils/ENSIP19.sol";
import {IERC7996} from "@ens/utils/IERC7996.sol";
import {NameCoder} from "@ens/utils/NameCoder.sol";
import {IPermissionedRegistry} from "@ens/v2/registry/interfaces/IPermissionedRegistry.sol";
import {AbstractRecordResolver} from "@ens/v2/resolver/AbstractRecordResolver.sol";
import {IRecordResolver} from "@ens/v2/resolver/interfaces/IRecordResolver.sol";
import {IABISetter} from "@ens/v2/resolver/interfaces/setters/IABISetter.sol";
import {IAddressSetter} from "@ens/v2/resolver/interfaces/setters/IAddressSetter.sol";
import {IContenthashSetter} from "@ens/v2/resolver/interfaces/setters/IContenthashSetter.sol";
import {IDataSetter} from "@ens/v2/resolver/interfaces/setters/IDataSetter.sol";
import {IInterfaceSetter} from "@ens/v2/resolver/interfaces/setters/IInterfaceSetter.sol";
import {INameSetter} from "@ens/v2/resolver/interfaces/setters/INameSetter.sol";
import {ITextSetter} from "@ens/v2/resolver/interfaces/setters/ITextSetter.sol";
import {LibLabel} from "@ens/v2/utils/LibLabel.sol";
import {ERC165} from "@openzeppelin/utils/introspection/ERC165.sol";
import {ERC165Checker} from "@openzeppelin/utils/introspection/ERC165Checker.sol";

/// @title FairyResolver
/// @notice A shared resolver for .eth names gifted through ENS Fairy.
///
/// One deployment serves every name, so a gift doesn't need to deploy or
/// configure a resolver. It implements the same `IRecordResolver` interface as
/// the ENSv2 PermissionedResolver: the same name-based setters, the same
/// `resolve` profiles (including resolve-multicall and the ENSIP-19 default
/// address), and the same record events, so the ENS manager and v2 indexers
/// treat it like any other v2 resolver. It has no EAC roles.
///
/// Records can be written by the name's current owner in the ENSv2 .eth
/// registry, or by accounts the owner approves here, like PublicResolverV2:
/// an operator for all of their names (`setApprovalForAll`) or a delegate for
/// one name (`approve`). Approvals belong to the owner, so they stop applying
/// when a name changes hands.
///
/// Until the owner sets one, a name's ETH address resolves to its current
/// owner. A gifted name therefore resolves to the recipient the moment it's
/// registered, with no records written, and keeps following the owner if the
/// name is transferred.
///
/// Records are wiped when a name changes hands through expiry. Otherwise, if
/// alice.eth expired and Bob registered it, he'd inherit Alice's records,
/// including her ETH address, so funds sent to his name would go to her.
/// To prevent that, each registration gets its own record, found through the
/// registry's resource ID rather than the name. That ID changes each time the
/// name is registered fresh, so a new registrant starts empty. It does not
/// change on transfers, renewals, or role changes, so those keep their
/// records, as in ENSv1.
///
/// Records use PermissionedResolver's events: every write emits
/// `Linked(recordId, node, name)` and the matching `*Updated(recordId, ...)`.
/// The record ID is derived from the registration instead of stored, so the
/// first write can't be told apart and `Linked` is repeated, which indexers
/// can treat as a no-op.
///
/// Only second-level .eth names are supported. The contract has no owner, no
/// admin functions, and isn't upgradeable.
///
/// The constructor takes no arguments and picks the .eth registry for the
/// chain it's deployed on, so the creation code is identical everywhere and a
/// CREATE2 deploy lands at the same address on mainnet and Sepolia.
contract FairyResolver is ERC165, IRecordResolver, IERC7996 {
    ////////////////////////////////////////////////////////////////////////
    // Storage
    ////////////////////////////////////////////////////////////////////////

    /// @notice The ENSv2 .eth registry that decides who owns each name.
    IPermissionedRegistry public immutable ETH_REGISTRY;

    /// @notice Bumped by `clearRecords` to start a registration's record over.
    mapping(uint256 resource => uint64 version) public recordVersions;

    /// @dev Keyed by `_recordId`.
    mapping(uint256 recordId => AbstractRecordResolver.Record record) private _records;

    /// @dev Distinguishes an explicitly set (possibly empty) ETH address from
    ///      one that was never set, which falls back to the owner.
    mapping(uint256 recordId => bool isSet) private _ethAddressSet;

    /// @notice Accounts an owner allows to manage records for all their names.
    mapping(address owner => mapping(address operator => bool approved)) public isApprovedForAll;

    /// @dev Accounts an owner allows to manage records for one name.
    mapping(
        address owner => mapping(bytes32 node => mapping(address delegate => bool approved))
    ) private _tokenApprovals;

    ////////////////////////////////////////////////////////////////////////
    // Events
    ////////////////////////////////////////////////////////////////////////

    /// @notice An operator is added or removed.
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    /// @notice A delegate is approved or an approval is revoked.
    event Approved(
        address owner, bytes32 indexed node, address indexed delegate, bool indexed approved
    );

    ////////////////////////////////////////////////////////////////////////
    // Errors
    ////////////////////////////////////////////////////////////////////////

    /// @notice The name isn't a DNS-encoded second-level .eth name.
    error UnsupportedName(bytes name);

    /// @notice The caller doesn't own the name and isn't approved by the owner.
    error Unauthorized(bytes name, address account);

    /// @notice Owners can't approve themselves.
    error InvalidApproval();

    /// @notice The contract was deployed on a chain without a known .eth registry.
    error UnsupportedChain(uint256 chainId);

    ////////////////////////////////////////////////////////////////////////
    // Initialization
    ////////////////////////////////////////////////////////////////////////

    constructor() {
        ETH_REGISTRY = IPermissionedRegistry(_ethRegistry(block.chainid));
        emit ResolverCreated();
    }

    /// @inheritdoc ERC165
    /// @dev Matches AbstractRecordResolver, which the ENS manager relies on to
    ///      find the name-based setters.
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IExtendedResolver).interfaceId
            || interfaceId == type(IERC7996).interfaceId
            || interfaceId == type(IMulticallable).interfaceId
            || interfaceId == type(IABISetter).interfaceId
            || interfaceId == type(IAddressSetter).interfaceId
            || interfaceId == type(IContenthashSetter).interfaceId
            || interfaceId == type(IDataSetter).interfaceId
            || interfaceId == type(IInterfaceSetter).interfaceId
            || interfaceId == type(INameSetter).interfaceId
            || interfaceId == type(ITextSetter).interfaceId || super.supportsInterface(interfaceId);
    }

    /// @inheritdoc IERC7996
    function supportsFeature(bytes4 feature) external pure returns (bool) {
        return feature == ResolverFeatures.RESOLVE_MULTICALL;
    }

    ////////////////////////////////////////////////////////////////////////
    // Writes
    ////////////////////////////////////////////////////////////////////////

    /// @inheritdoc IABISetter
    function setABI(bytes calldata name, uint256 contentType, bytes calldata data) external {
        if (contentType == 0 || (contentType - 1) & contentType != 0) {
            revert InvalidContentType(contentType);
        }
        uint256 recordId = _writableRecord(name);
        _records[recordId].abis[contentType] = data;
        emit ABIUpdated(recordId, contentType);
    }

    /// @inheritdoc IAddressSetter
    /// @dev Setting the ETH address, even to empty, stops it following the owner.
    function setAddress(bytes calldata name, uint256 coinType, bytes calldata addressBytes)
        external
    {
        if (
            addressBytes.length != 0 && addressBytes.length != 20 && ENSIP19.isEVMCoinType(coinType)
        ) {
            revert InvalidEVMAddress(addressBytes);
        }
        uint256 recordId = _writableRecord(name);
        _records[recordId].addresses[coinType] = addressBytes;
        if (coinType == COIN_TYPE_ETH) _ethAddressSet[recordId] = true;
        emit AddressUpdated(recordId, coinType, addressBytes);
    }

    /// @inheritdoc IContenthashSetter
    function setContenthash(bytes calldata name, bytes calldata hash) external {
        uint256 recordId = _writableRecord(name);
        _records[recordId].contenthash = hash;
        emit ContenthashUpdated(recordId, hash);
    }

    /// @inheritdoc IDataSetter
    function setData(bytes calldata name, string calldata key, bytes calldata value) external {
        uint256 recordId = _writableRecord(name);
        _records[recordId].datas[key] = value;
        emit DataUpdated(recordId, key, key, value);
    }

    /// @inheritdoc IInterfaceSetter
    function setInterface(bytes calldata name, bytes4 interfaceId, address implementer) external {
        uint256 recordId = _writableRecord(name);
        _records[recordId].interfaces[interfaceId] = implementer;
        emit InterfaceUpdated(recordId, interfaceId, implementer);
    }

    /// @inheritdoc INameSetter
    function setName(bytes calldata name, string calldata primaryName) external {
        uint256 recordId = _writableRecord(name);
        _records[recordId].name = primaryName;
        emit NameUpdated(recordId, primaryName);
    }

    /// @inheritdoc ITextSetter
    function setText(bytes calldata name, string calldata key, string calldata value) external {
        uint256 recordId = _writableRecord(name);
        _records[recordId].texts[key] = value;
        emit TextUpdated(recordId, key, key, value);
    }

    /// @notice Remove every record. The ETH address goes back to the owner.
    /// @dev The name moves to a new, empty record, which the next write links.
    /// @param name The DNS-encoded name.
    function clearRecords(bytes calldata name) external {
        (, uint256 resource) = _authorize(name);
        emit Cleared(_recordId(resource));
        ++recordVersions[resource];
    }

    /// @notice Let `operator` manage records for every name the caller owns.
    function setApprovalForAll(address operator, bool approved) external {
        if (operator == msg.sender) revert InvalidApproval();
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    /// @notice Let `delegate` manage records for one name the caller owns.
    /// @param node The namehash of the name.
    function approve(bytes32 node, address delegate, bool approved) external {
        if (delegate == msg.sender) revert InvalidApproval();
        _tokenApprovals[msg.sender][node][delegate] = approved;
        emit Approved(msg.sender, node, delegate, approved);
    }

    /// @inheritdoc IMulticallable
    /// @notice Run several writes in one transaction. Reverts with the first error.
    function multicall(bytes[] calldata calls) public returns (bytes[] memory results) {
        results = new bytes[](calls.length);
        for (uint256 i; i < calls.length; ++i) {
            (bool ok, bytes memory result) = address(this).delegatecall(calls[i]);
            if (!ok) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
            results[i] = result;
        }
    }

    /// @inheritdoc IMulticallable
    /// @dev Same as `multicall`, since every call checks its own name.
    function multicallWithNodeCheck(bytes32, bytes[] calldata calls)
        external
        returns (bytes[] memory)
    {
        return multicall(calls);
    }

    ////////////////////////////////////////////////////////////////////////
    // Reads
    ////////////////////////////////////////////////////////////////////////

    /// @inheritdoc IExtendedResolver
    /// @dev Serves the same profiles as AbstractRecordResolver. The node
    ///      argument inside `data` is ignored in favor of `name`.
    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        returns (bytes memory)
    {
        // forge-lint: disable-next-line(unsafe-typecast)
        bytes4 selector = bytes4(data);
        if (selector == IMulticallable.multicall.selector) {
            bytes[] memory m = abi.decode(data[4:], (bytes[]));
            for (uint256 i; i < m.length; ++i) {
                try this.resolve(name, m[i]) returns (bytes memory v) {
                    m[i] = v;
                } catch (bytes memory v) {
                    m[i] = v;
                }
            }
            return abi.encode(m);
        }

        (, string memory label) = _parseName(name);
        (address owner, uint256 resource) = _registration(label);
        uint256 recordId = _recordId(resource);
        AbstractRecordResolver.Record storage r = _records[recordId];

        if (selector == IAddrResolver.addr.selector) {
            return abi.encode(_addr(recordId, owner));
        } else if (selector == IAddressResolver.addr.selector) {
            (, uint256 coinType) = abi.decode(data[4:], (bytes32, uint256));
            return abi.encode(_address(recordId, owner, coinType));
        } else if (selector == ITextResolver.text.selector) {
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            return abi.encode(r.texts[key]);
        } else if (selector == IDataResolver.data.selector) {
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            return abi.encode(r.datas[key]);
        } else if (selector == INameResolver.name.selector) {
            return abi.encode(r.name);
        } else if (selector == IContentHashResolver.contenthash.selector) {
            return abi.encode(r.contenthash);
        } else if (selector == IHasAddressResolver.hasAddr.selector) {
            (, uint256 coinType) = abi.decode(data[4:], (bytes32, uint256));
            return abi.encode(r.addresses[coinType].length > 0);
        } else if (selector == IABIResolver.ABI.selector) {
            (, uint256 contentTypes) = abi.decode(data[4:], (bytes32, uint256));
            (uint256 contentType, bytes memory value) = _abi(r, contentTypes);
            return abi.encode(contentType, value);
        } else if (selector == IInterfaceResolver.interfaceImplementer.selector) {
            (, bytes4 interfaceId) = abi.decode(data[4:], (bytes32, bytes4));
            address implementer = r.interfaces[interfaceId];
            if (implementer == address(0)) {
                address pointer = _addr(recordId, owner);
                if (ERC165Checker.supportsInterface(pointer, interfaceId)) {
                    implementer = pointer;
                }
            }
            return abi.encode(implementer);
        }
        revert UnsupportedResolverProfile(selector);
    }

    /// @notice The current owner of `name` in the ENSv2 .eth registry.
    /// @param name The DNS-encoded name.
    function ownerOf(bytes calldata name) external view returns (address) {
        (, string memory label) = _parseName(name);
        (address owner,) = _registration(label);
        return owner;
    }

    /// @notice Whether `account` can write records for `name`.
    /// @param name The DNS-encoded name.
    function canModifyName(bytes calldata name, address account) external view returns (bool) {
        (bytes32 node, string memory label) = _parseName(name);
        (address owner,) = _registration(label);
        return _canModify(owner, node, account);
    }

    /// @notice Whether `owner` approved `delegate` for the name with namehash `node`.
    function isApprovedFor(address owner, bytes32 node, address delegate)
        external
        view
        returns (bool)
    {
        return _tokenApprovals[owner][node][delegate];
    }

    /// @notice The record `name` currently resolves from.
    /// @param name The DNS-encoded name.
    function getRecordId(bytes calldata name) external view returns (uint256) {
        (, string memory label) = _parseName(name);
        (, uint256 resource) = _registration(label);
        return _recordId(resource);
    }

    ////////////////////////////////////////////////////////////////////////
    // Internal
    ////////////////////////////////////////////////////////////////////////

    /// @dev Reverts unless the caller owns `name` or is approved by the owner.
    function _authorize(bytes calldata name) private view returns (bytes32 node, uint256 resource) {
        string memory label;
        (node, label) = _parseName(name);
        address owner;
        (owner, resource) = _registration(label);
        if (!_canModify(owner, node, msg.sender)) revert Unauthorized(name, msg.sender);
    }

    function _canModify(address owner, bytes32 node, address account) private view returns (bool) {
        return owner != address(0)
            && (account == owner
                || isApprovedForAll[owner][account]
                || _tokenApprovals[owner][node][account]);
    }

    /// @dev Authorizes the caller and links the name to its registration's record.
    function _writableRecord(bytes calldata name) private returns (uint256 recordId) {
        (bytes32 node, uint256 resource) = _authorize(name);
        recordId = _recordId(resource);
        emit Linked(recordId, node, name);
    }

    /// @dev ENSIP-19: an unset EVM address falls back to the default address.
    ///      An ETH address that was never set falls back to the owner after that.
    function _address(uint256 recordId, address owner, uint256 coinType)
        private
        view
        returns (bytes memory addressBytes)
    {
        AbstractRecordResolver.Record storage r = _records[recordId];
        addressBytes = r.addresses[coinType];
        if (addressBytes.length == 0 && ENSIP19.chainFromCoinType(coinType) > 0) {
            addressBytes = r.addresses[COIN_TYPE_DEFAULT];
        }
        if (
            addressBytes.length == 0 && coinType == COIN_TYPE_ETH && !_ethAddressSet[recordId]
                && owner != address(0)
        ) {
            addressBytes = abi.encodePacked(owner);
        }
    }

    function _addr(uint256 recordId, address owner) private view returns (address) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return address(bytes20(_address(recordId, owner, COIN_TYPE_ETH)));
    }

    /// @dev Find the ABI matching the `contentTypes` filter.
    function _abi(AbstractRecordResolver.Record storage r, uint256 contentTypes)
        private
        view
        returns (uint256 contentType, bytes memory value)
    {
        for (contentType = 1; contentType > 0 && contentType <= contentTypes; contentType <<= 1) {
            if ((contentType & contentTypes) != 0) {
                value = r.abis[contentType];
                if (value.length > 0) return (contentType, value);
            }
        }
        return (0, "");
    }

    /// @dev A registration's record at its current clear-version.
    function _recordId(uint256 resource) private view returns (uint256) {
        return uint256(keccak256(abi.encode(resource, recordVersions[resource])));
    }

    /// @dev The name's owner, zero unless it's registered and unexpired, and
    ///      its resource ID, which changes when the name is registered again
    ///      but not on transfers, renewals, or role changes. One registry call.
    function _registration(string memory label)
        private
        view
        returns (address owner, uint256 resource)
    {
        IPermissionedRegistry.State memory state = ETH_REGISTRY.getState(LibLabel.id(label));
        if (state.status == IPermissionedRegistry.Status.REGISTERED) owner = state.latestOwner;
        resource = state.resource;
    }

    /// @dev ENSv2 .eth registries (what @ensdomains/ensjs calls `ensRegistry`).
    function _ethRegistry(uint256 chainId) private pure returns (address) {
        if (chainId == 1) return 0xf60aba43E1f7F3DAB1186Ff03B561401C9Df85E2;
        if (chainId == 11155111) return 0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4;
        revert UnsupportedChain(chainId);
    }

    /// @dev Accepts only `{label}.eth`, returning its namehash and label.
    function _parseName(bytes calldata name)
        private
        pure
        returns (bytes32 node, string memory label)
    {
        (label,) = NameCoder.extractLabel(name, 0);
        if (bytes(label).length == 0 || keccak256(NameCoder.ethName(label)) != keccak256(name)) {
            revert UnsupportedName(name);
        }
        node = NameCoder.namehash(name, 0);
    }
}
