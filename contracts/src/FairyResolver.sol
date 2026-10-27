// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAddrResolver} from "@ens/resolvers/profiles/IAddrResolver.sol";
import {IAddressResolver} from "@ens/resolvers/profiles/IAddressResolver.sol";
import {IContentHashResolver} from "@ens/resolvers/profiles/IContentHashResolver.sol";
import {IExtendedResolver} from "@ens/resolvers/profiles/IExtendedResolver.sol";
import {ITextResolver} from "@ens/resolvers/profiles/ITextResolver.sol";
import {IVersionableResolver} from "@ens/resolvers/profiles/IVersionableResolver.sol";
import {COIN_TYPE_ETH, ENSIP19} from "@ens/utils/ENSIP19.sol";
import {NameCoder} from "@ens/utils/NameCoder.sol";
import {IPermissionedRegistry} from "@ens/v2/registry/interfaces/IPermissionedRegistry.sol";
import {LibLabel} from "@ens/v2/utils/LibLabel.sol";
import {ERC165} from "@openzeppelin/utils/introspection/ERC165.sol";

/// @title FairyResolver
/// @notice A shared resolver for .eth names gifted through ENS Fairy.
///
/// One deployment serves every name, so a gift doesn't need to deploy or
/// configure a resolver. Records can only be written by the name's current
/// owner in the ENSv2 .eth registry, or an operator the owner has approved on
/// the registry with `setApprovalForAll`. The resolver keeps no approvals of
/// its own.
///
/// Until the owner sets one, a name's ETH address resolves to its current
/// owner. A gifted name therefore resolves to the recipient the moment it's
/// registered, with no records written, and keeps following the owner if the
/// name is transferred.
///
/// Records are wiped when a name changes hands through expiry. Otherwise, if
/// alice.eth expired and Bob registered it, he'd inherit Alice's records,
/// including her ETH address, so funds sent to his name would go to her.
/// To prevent that, records are stored under the registry's resource ID
/// rather than the name. That ID changes each time the name is registered
/// fresh, so a new registrant starts empty. It does not change on transfers,
/// renewals, or role changes, so those keep their records, as in ENSv1.
///
/// Setters take the DNS-encoded name (like the ENSv2 PermissionedResolver),
/// so the ENS manager app recognizes them and can edit records. Reads only go
/// through ENSIP-10 `resolve`, which is how the Universal Resolver calls
/// resolvers that support it; a bare namehash can't identify a registration.
///
/// Only second-level .eth names are supported. The contract has no owner, no
/// admin functions, and isn't upgradeable.
contract FairyResolver is ERC165, IExtendedResolver {
    ////////////////////////////////////////////////////////////////////////
    // Storage
    ////////////////////////////////////////////////////////////////////////

    /// @notice The ENSv2 .eth registry that decides who owns each name.
    IPermissionedRegistry public immutable ETH_REGISTRY;

    /// @notice Bumped by `clearRecords` to drop every record for a registration.
    mapping(uint256 resource => uint64 version) public recordVersions;

    /// @dev Every record lives under a key derived from the registration's
    ///      resource and its clear-version, see `_recordKey`.
    mapping(bytes32 recordKey => mapping(uint256 coinType => bytes addressBytes)) private
        _addresses;

    /// @dev Distinguishes an explicitly set (possibly empty) address from one
    ///      that was never set, which falls back to the owner for ETH.
    mapping(bytes32 recordKey => mapping(uint256 coinType => bool isSet)) private _addressIsSet;

    mapping(bytes32 recordKey => mapping(string key => string value)) private _texts;

    mapping(bytes32 recordKey => bytes hash) private _contenthashes;

    ////////////////////////////////////////////////////////////////////////
    // Errors
    ////////////////////////////////////////////////////////////////////////

    /// @notice The name isn't a DNS-encoded second-level .eth name.
    error UnsupportedName(bytes name);

    /// @notice The caller doesn't own the name and isn't approved on the registry.
    error Unauthorized(bytes name, address account);

    /// @notice EVM addresses must be empty or exactly 20 bytes.
    error InvalidEVMAddress(bytes addressBytes);

    /// @notice `resolve` was asked for a profile this resolver doesn't serve.
    error UnsupportedResolverProfile(bytes4 selector);

    ////////////////////////////////////////////////////////////////////////
    // Initialization
    ////////////////////////////////////////////////////////////////////////

    /// @param ethRegistry The ENSv2 .eth registry.
    constructor(IPermissionedRegistry ethRegistry) {
        ETH_REGISTRY = ethRegistry;
    }

    /// @inheritdoc ERC165
    /// @dev Advertises name-based setters, which the ENS manager probes for
    ///      with the `setAddress(bytes,uint256,bytes)` selector.
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IExtendedResolver).interfaceId
            || interfaceId == this.setAddress.selector || super.supportsInterface(interfaceId);
    }

    ////////////////////////////////////////////////////////////////////////
    // Writes
    ////////////////////////////////////////////////////////////////////////

    /// @notice Set the address for `coinType`. An empty value removes it.
    /// @param name The DNS-encoded name.
    function setAddress(bytes calldata name, uint256 coinType, bytes calldata addressBytes)
        external
    {
        (bytes32 node, uint256 resource) = _authorize(name);
        if (
            addressBytes.length != 0 && addressBytes.length != 20 && ENSIP19.isEVMCoinType(coinType)
        ) {
            revert InvalidEVMAddress(addressBytes);
        }
        bytes32 recordKey = _recordKey(resource);
        _addresses[recordKey][coinType] = addressBytes;
        _addressIsSet[recordKey][coinType] = true;
        emit IAddressResolver.AddressChanged(node, coinType, addressBytes);
    }

    /// @notice Set a text record. An empty value removes it.
    /// @param name The DNS-encoded name.
    function setText(bytes calldata name, string calldata key, string calldata value) external {
        (bytes32 node, uint256 resource) = _authorize(name);
        _texts[_recordKey(resource)][key] = value;
        emit ITextResolver.TextChanged(node, key, key, value);
    }

    /// @notice Set the contenthash. An empty value removes it.
    /// @param name The DNS-encoded name.
    function setContenthash(bytes calldata name, bytes calldata hash) external {
        (bytes32 node, uint256 resource) = _authorize(name);
        _contenthashes[_recordKey(resource)] = hash;
        emit IContentHashResolver.ContenthashChanged(node, hash);
    }

    /// @notice Remove every record. The ETH address goes back to the owner.
    /// @param name The DNS-encoded name.
    function clearRecords(bytes calldata name) external {
        (bytes32 node, uint256 resource) = _authorize(name);
        emit IVersionableResolver.VersionChanged(node, ++recordVersions[resource]);
    }

    /// @notice Run several writes in one transaction. Reverts with the first error.
    function multicall(bytes[] calldata data) external returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i; i < data.length; ++i) {
            (bool ok, bytes memory result) = address(this).delegatecall(data[i]);
            if (!ok) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
            results[i] = result;
        }
    }

    ////////////////////////////////////////////////////////////////////////
    // Reads
    ////////////////////////////////////////////////////////////////////////

    /// @inheritdoc IExtendedResolver
    /// @dev Answers `addr`, `addr` with a coin type, `text`, and `contenthash`.
    ///      The node argument inside `data` is ignored in favor of `name`.
    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        returns (bytes memory)
    {
        (, string memory label) = _parseName(name);
        bytes32 recordKey = _recordKey(_resource(label));
        // forge-lint: disable-next-line(unsafe-typecast)
        bytes4 selector = bytes4(data);

        if (selector == IAddrResolver.addr.selector) {
            // forge-lint: disable-next-line(unsafe-typecast)
            return abi.encode(address(bytes20(_ethAddress(recordKey, label))));
        }
        if (selector == IAddressResolver.addr.selector) {
            (, uint256 coinType) = abi.decode(data[4:], (bytes32, uint256));
            if (coinType == COIN_TYPE_ETH) return abi.encode(_ethAddress(recordKey, label));
            return abi.encode(_addresses[recordKey][coinType]);
        }
        if (selector == ITextResolver.text.selector) {
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            return abi.encode(_texts[recordKey][key]);
        }
        if (selector == IContentHashResolver.contenthash.selector) {
            return abi.encode(_contenthashes[recordKey]);
        }
        revert UnsupportedResolverProfile(selector);
    }

    /// @notice The current owner of `name` in the ENSv2 .eth registry.
    /// @param name The DNS-encoded name.
    function ownerOf(bytes calldata name) external view returns (address) {
        (, string memory label) = _parseName(name);
        return _owner(label);
    }

    /// @notice Whether `account` can write records for `name`.
    /// @param name The DNS-encoded name.
    function canModifyName(bytes calldata name, address account) external view returns (bool) {
        (, string memory label) = _parseName(name);
        return _canModify(_owner(label), account);
    }

    ////////////////////////////////////////////////////////////////////////
    // Internal
    ////////////////////////////////////////////////////////////////////////

    /// @dev Reverts unless the caller owns `name` or is approved on the registry.
    function _authorize(bytes calldata name) private view returns (bytes32 node, uint256 resource) {
        string memory label;
        (node, label) = _parseName(name);
        if (!_canModify(_owner(label), msg.sender)) revert Unauthorized(name, msg.sender);
        resource = _resource(label);
    }

    /// @dev The owner, or an operator the owner approved on the .eth registry,
    ///      the same approval that lets it transfer the name.
    function _canModify(address owner, address account) private view returns (bool) {
        return
            owner != address(0)
                && (account == owner || ETH_REGISTRY.isApprovedForAll(owner, account));
    }

    /// @dev The explicit ETH address, or the owner's if none was ever set.
    function _ethAddress(bytes32 recordKey, string memory label)
        private
        view
        returns (bytes memory)
    {
        if (_addressIsSet[recordKey][COIN_TYPE_ETH]) {
            return _addresses[recordKey][COIN_TYPE_ETH];
        }
        address owner = _owner(label);
        return owner == address(0) ? bytes("") : abi.encodePacked(owner);
    }

    /// @dev Records for one registration, at its current clear-version.
    function _recordKey(uint256 resource) private view returns (bytes32) {
        return keccak256(abi.encode(resource, recordVersions[resource]));
    }

    /// @dev Zero once the name expires.
    function _owner(string memory label) private view returns (address) {
        return ETH_REGISTRY.getOwner(LibLabel.id(label));
    }

    /// @dev Changes when the name is registered again, but not on transfers,
    ///      renewals, or role changes.
    function _resource(string memory label) private view returns (uint256) {
        return ETH_REGISTRY.getResource(LibLabel.id(label));
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
