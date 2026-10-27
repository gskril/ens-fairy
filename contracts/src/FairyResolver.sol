// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev The ENSv2 .eth registry exposes the owner of each label.
interface IOwnedRegistry {
    function findOwner(string calldata label) external view returns (address);
}

/// @title FairyResolver
/// @notice A shared resolver for .eth names gifted through ENS Fairy.
///
/// One deployment serves every name, so a gift doesn't need to deploy or
/// configure a resolver. Records can only be written by the name's current
/// owner in the ENSv2 .eth registry, or an operator the owner approves.
///
/// Until the owner sets one, a name's ETH address resolves to its current
/// owner. A gifted name therefore resolves to the recipient the moment it's
/// registered, with no records written, and keeps following the owner if the
/// name is transferred.
///
/// Setters take the DNS-encoded name (like the ENSv2 PermissionedResolver),
/// so the ENS manager app recognizes them and can edit records. Reads go
/// through ENSIP-10 `resolve`, which is how the Universal Resolver calls
/// resolvers that support it.
///
/// Only second-level .eth names are supported. The contract has no owner, no
/// admin functions, and isn't upgradeable.
contract FairyResolver {
    ////////////////////////////////////////////////////////////////////////
    // Constants
    ////////////////////////////////////////////////////////////////////////

    /// @dev namehash("eth")
    bytes32 private constant ETH_NODE =
        0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;

    uint256 private constant COIN_TYPE_ETH = 60;

    // Profile selectors served through `resolve`
    bytes4 private constant ADDR_SELECTOR = 0x3b3b57de; // addr(bytes32)
    bytes4 private constant ADDR_COIN_SELECTOR = 0xf1cb7e06; // addr(bytes32,uint256)
    bytes4 private constant TEXT_SELECTOR = 0x59d1d43c; // text(bytes32,string)
    bytes4 private constant CONTENTHASH_SELECTOR = 0xbc1c58d1; // contenthash(bytes32)

    // ERC-165 interface ids
    bytes4 private constant ERC165_INTERFACE = 0x01ffc9a7;
    bytes4 private constant EXTENDED_RESOLVER_INTERFACE = 0x9061b923; // resolve(bytes,bytes)
    /// @dev The ENS manager probes this id to choose name-based setters.
    bytes4 private constant ADDRESS_SETTER_INTERFACE =
        bytes4(keccak256("setAddress(bytes,uint256,bytes)"));

    ////////////////////////////////////////////////////////////////////////
    // Storage
    ////////////////////////////////////////////////////////////////////////

    /// @notice The ENSv2 .eth registry that decides who owns each name.
    IOwnedRegistry public immutable ETH_REGISTRY;

    /// @notice Bumped by `clearRecords` to drop every record for a name.
    mapping(bytes32 node => uint64 version) public recordVersions;

    mapping(uint64 version => mapping(bytes32 node => mapping(uint256 coinType => bytes addressBytes)))
        private _addresses;

    /// @dev Distinguishes an explicitly set (possibly empty) address from one
    ///      that was never set, which falls back to the owner for ETH.
    mapping(uint64 version => mapping(bytes32 node => mapping(uint256 coinType => bool isSet)))
        private _addressIsSet;

    mapping(uint64 version => mapping(bytes32 node => mapping(string key => string value)))
        private _texts;

    mapping(uint64 version => mapping(bytes32 node => bytes hash)) private _contenthashes;

    /// @notice Accounts an owner allows to manage records for all their names.
    mapping(address owner => mapping(address operator => bool approved)) public isApprovedForAll;

    ////////////////////////////////////////////////////////////////////////
    // Events
    ////////////////////////////////////////////////////////////////////////

    event AddressChanged(bytes32 indexed node, uint256 coinType, bytes newAddress);
    event TextChanged(bytes32 indexed node, string indexed indexedKey, string key, string value);
    event ContenthashChanged(bytes32 indexed node, bytes hash);
    event VersionChanged(bytes32 indexed node, uint64 newVersion);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    ////////////////////////////////////////////////////////////////////////
    // Errors
    ////////////////////////////////////////////////////////////////////////

    /// @notice The name isn't a DNS-encoded second-level .eth name.
    error UnsupportedName(bytes name);

    /// @notice The caller doesn't own the name and isn't an approved operator.
    error Unauthorized(bytes name, address account);

    /// @notice An ETH address must be empty or exactly 20 bytes.
    error InvalidEVMAddress(bytes addressBytes);

    /// @notice `resolve` was asked for a profile this resolver doesn't serve.
    error UnsupportedResolverProfile(bytes4 selector);

    error InvalidOperator();

    ////////////////////////////////////////////////////////////////////////
    // Initialization
    ////////////////////////////////////////////////////////////////////////

    /// @param ethRegistry The ENSv2 .eth registry.
    constructor(IOwnedRegistry ethRegistry) {
        ETH_REGISTRY = ethRegistry;
    }

    ////////////////////////////////////////////////////////////////////////
    // Writes
    ////////////////////////////////////////////////////////////////////////

    /// @notice Set the address for `coinType`. An empty value removes it.
    /// @param name The DNS-encoded name.
    function setAddress(bytes calldata name, uint256 coinType, bytes calldata addressBytes)
        external
    {
        bytes32 node = _authorize(name);
        if (coinType == COIN_TYPE_ETH && addressBytes.length != 0 && addressBytes.length != 20) {
            revert InvalidEVMAddress(addressBytes);
        }
        uint64 version = recordVersions[node];
        _addresses[version][node][coinType] = addressBytes;
        _addressIsSet[version][node][coinType] = true;
        emit AddressChanged(node, coinType, addressBytes);
    }

    /// @notice Set a text record. An empty value removes it.
    /// @param name The DNS-encoded name.
    function setText(bytes calldata name, string calldata key, string calldata value) external {
        bytes32 node = _authorize(name);
        _texts[recordVersions[node]][node][key] = value;
        emit TextChanged(node, key, key, value);
    }

    /// @notice Set the contenthash. An empty value removes it.
    /// @param name The DNS-encoded name.
    function setContenthash(bytes calldata name, bytes calldata hash) external {
        bytes32 node = _authorize(name);
        _contenthashes[recordVersions[node]][node] = hash;
        emit ContenthashChanged(node, hash);
    }

    /// @notice Remove every record. The ETH address goes back to the owner.
    /// @param name The DNS-encoded name.
    function clearRecords(bytes calldata name) external {
        bytes32 node = _authorize(name);
        uint64 version = ++recordVersions[node];
        emit VersionChanged(node, version);
    }

    /// @notice Let `operator` manage records for every name the caller owns.
    function setApprovalForAll(address operator, bool approved) external {
        if (operator == msg.sender) revert InvalidOperator();
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
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

    /// @notice ENSIP-10 resolution. Answers `addr`, `addr` with a coin type,
    ///         `text`, and `contenthash` for `name`.
    /// @param name The DNS-encoded name.
    /// @param data The ABI-encoded profile call. Its node argument is ignored
    ///        in favor of the namehash of `name`.
    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        returns (bytes memory)
    {
        (bytes32 node, string calldata label) = _parseName(name);
        bytes4 selector = bytes4(data);

        if (selector == ADDR_SELECTOR) {
            return abi.encode(address(bytes20(_ethAddress(node, label))));
        }
        if (selector == ADDR_COIN_SELECTOR) {
            (, uint256 coinType) = abi.decode(data[4:], (bytes32, uint256));
            if (coinType == COIN_TYPE_ETH) return abi.encode(_ethAddress(node, label));
            return abi.encode(_addresses[recordVersions[node]][node][coinType]);
        }
        if (selector == TEXT_SELECTOR) {
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            return abi.encode(_texts[recordVersions[node]][node][key]);
        }
        if (selector == CONTENTHASH_SELECTOR) {
            return abi.encode(_contenthashes[recordVersions[node]][node]);
        }
        revert UnsupportedResolverProfile(selector);
    }

    /// @notice The current owner of `name` in the ENSv2 .eth registry.
    /// @param name The DNS-encoded name.
    function ownerOf(bytes calldata name) external view returns (address) {
        (, string calldata label) = _parseName(name);
        return _owner(label);
    }

    /// @notice Whether `account` can write records for `name`.
    /// @param name The DNS-encoded name.
    function canModifyName(bytes calldata name, address account) external view returns (bool) {
        (, string calldata label) = _parseName(name);
        address owner = _owner(label);
        return owner != address(0) && (account == owner || isApprovedForAll[owner][account]);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == ERC165_INTERFACE ||
            interfaceId == EXTENDED_RESOLVER_INTERFACE ||
            interfaceId == ADDRESS_SETTER_INTERFACE ||
            interfaceId == ADDR_SELECTOR ||
            interfaceId == ADDR_COIN_SELECTOR ||
            interfaceId == TEXT_SELECTOR ||
            interfaceId == CONTENTHASH_SELECTOR;
    }

    ////////////////////////////////////////////////////////////////////////
    // Internal
    ////////////////////////////////////////////////////////////////////////

    /// @dev Reverts unless the caller owns `name` or is an approved operator.
    function _authorize(bytes calldata name) private view returns (bytes32 node) {
        string calldata label;
        (node, label) = _parseName(name);
        address owner = _owner(label);
        if (owner == address(0) || (msg.sender != owner && !isApprovedForAll[owner][msg.sender])) {
            revert Unauthorized(name, msg.sender);
        }
    }

    /// @dev The explicit ETH address, or the owner's if none was ever set.
    function _ethAddress(bytes32 node, string calldata label) private view returns (bytes memory) {
        uint64 version = recordVersions[node];
        if (_addressIsSet[version][node][COIN_TYPE_ETH]) {
            return _addresses[version][node][COIN_TYPE_ETH];
        }
        address owner = _owner(label);
        return owner == address(0) ? bytes("") : abi.encodePacked(owner);
    }

    function _owner(string calldata label) private view returns (address) {
        return ETH_REGISTRY.findOwner(label);
    }

    /// @dev Parses `\x{len}label\x03eth\x00` into its namehash and label.
    function _parseName(bytes calldata name)
        private
        pure
        returns (bytes32 node, string calldata label)
    {
        uint256 length = name.length > 0 ? uint8(name[0]) : 0;
        if (
            length == 0 ||
            name.length != length + 6 ||
            name[length + 1] != 0x03 ||
            name[length + 2] != "e" ||
            name[length + 3] != "t" ||
            name[length + 4] != "h" ||
            name[length + 5] != 0x00
        ) {
            revert UnsupportedName(name);
        }
        label = string(name[1:length + 1]);
        node = keccak256(abi.encodePacked(ETH_NODE, keccak256(bytes(label))));
    }
}
