// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  AccessControlModule
 * @notice Lightweight role-based access control for the AgriChain system.
 *         Roles:  ADMIN, FARMER, DISTRIBUTOR, RETAILER, INSPECTOR, OPERATOR
 */
contract AccessControlModule {

    // ── Role constants ───────────────────────────────────────────────────────

    bytes32 public constant ADMIN_ROLE       = keccak256("ADMIN");
    bytes32 public constant FARMER_ROLE      = keccak256("FARMER");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR");
    bytes32 public constant RETAILER_ROLE    = keccak256("RETAILER");
    bytes32 public constant INSPECTOR_ROLE   = keccak256("INSPECTOR");
    bytes32 public constant OPERATOR_ROLE    = keccak256("OPERATOR");

    // ── State ────────────────────────────────────────────────────────────────

    address private _admin;
    mapping(bytes32 => mapping(address => bool)) private _roles;

    // ── Events ───────────────────────────────────────────────────────────────

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed by);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed by);

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == _admin, "AccessControl: not admin");
        _;
    }

    modifier onlyRole(bytes32 role) {
        require(_roles[role][msg.sender], "AccessControl: missing role");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        _admin = msg.sender;
        _roles[ADMIN_ROLE][msg.sender]    = true;
        _roles[OPERATOR_ROLE][msg.sender] = true;
    }

    // ── External functions ───────────────────────────────────────────────────

    function grantRole(bytes32 role, address account) external onlyAdmin {
        require(!_roles[role][account], "Role already granted");
        _roles[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    function revokeRole(bytes32 role, address account) external onlyAdmin {
        require(_roles[role][account], "Role not granted");
        _roles[role][account] = false;
        emit RoleRevoked(role, account, msg.sender);
    }

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    function admin() external view returns (address) {
        return _admin;
    }
}
