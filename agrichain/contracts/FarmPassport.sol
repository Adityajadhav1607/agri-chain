// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AccessControl.sol";

/**
 * @title  FarmPassport
 * @notice A minimal on-chain NFT (ERC-721-like) that issues a unique "Farm Passport"
 *         for each produce batch. Each passport records GPS coordinates, a metadata URI,
 *         and links back to the ProduceRegistry batch ID.
 *
 *         Key design decisions:
 *         - One passport per batch (enforced by _batchHasPassport guard).
 *         - Passport lookup is by batchId, not tokenId, since batchId is the primary key.
 *         - No transfer logic — passports are soulbound to their original farmer.
 *         - ownerOf() is included for ERC-721 interface compatibility.
 */
contract FarmPassport is AccessControlModule {

    // ── ERC-721 metadata ──────────────────────────────────────────────────────

    string public name   = "AgriChain Farm Passport";
    string public symbol = "AFP";

    // ── Structs ───────────────────────────────────────────────────────────────

    struct Passport {
        uint256 tokenId;         // Auto-incremented NFT token ID
        address farmer;          // Wallet address of the farmer
        uint256 batchId;         // Linked ProduceRegistry batch ID
        string  gpsCoordinates;  // GPS coords of the farm (e.g. "18.5204,73.8567")
        string  tokenUri;        // IPFS URI for passport metadata JSON
        uint256 mintedAt;        // Block timestamp at mint time
    }

    // ── State ─────────────────────────────────────────────────────────────────

    /// @dev Monotonically increasing token counter; starts at 1
    uint256 private _tokenCounter;

    /// @dev batchId => Passport (primary lookup key)
    mapping(uint256 => Passport) private _passportsByBatch;

    /// @dev farmer address => list of batchIds for which they have passports
    mapping(address => uint256[]) private _farmerBatchIds;

    /// @dev batchId => has a passport been issued?
    mapping(uint256 => bool) private _batchHasPassport;

    /// @dev tokenId => owner address (minimal ERC-721 ownership tracking)
    mapping(uint256 => address) private _tokenOwner;

    // ── Events ────────────────────────────────────────────────────────────────

    event PassportMinted(
        address indexed farmer,
        uint256 indexed batchId,
        uint256 tokenId,
        string  gpsCoordinates
    );

    // ── Minting ───────────────────────────────────────────────────────────────

    /**
     * @notice Issue a Farm Passport NFT for a produce batch.
     *         Only addresses with OPERATOR_ROLE may call this.
     * @param farmer         The farmer's wallet address
     * @param batchId        The ProduceRegistry batch ID to attach the passport to
     * @param gpsCoordinates GPS coordinates of the farm (stored on-chain for provenance)
     * @param tokenUri       IPFS URI pointing to the passport metadata JSON
     * @return tokenId       The newly minted NFT token ID
     */
    function mintPassport(
        address farmer,
        uint256 batchId,
        string  calldata gpsCoordinates,
        string  calldata tokenUri
    )
        external
        onlyRole(OPERATOR_ROLE)
        returns (uint256 tokenId)
    {
        require(farmer != address(0),          "FarmPassport: zero farmer address");
        require(bytes(gpsCoordinates).length > 0, "FarmPassport: GPS coordinates required");
        require(!_batchHasPassport[batchId],   "FarmPassport: passport already exists for batch");

        // Mint: assign next token ID
        tokenId = ++_tokenCounter;

        // Store passport record indexed by batchId
        _passportsByBatch[batchId] = Passport({
            tokenId:        tokenId,
            farmer:         farmer,
            batchId:        batchId,
            gpsCoordinates: gpsCoordinates,
            tokenUri:       tokenUri,
            mintedAt:       block.timestamp
        });

        // Mark batch as having a passport (prevents re-mint)
        _batchHasPassport[batchId] = true;

        // Track all batchIds for this farmer
        _farmerBatchIds[farmer].push(batchId);

        // Record token ownership (ERC-721 compatibility)
        _tokenOwner[tokenId] = farmer;

        emit PassportMinted(farmer, batchId, tokenId, gpsCoordinates);
    }

    // ── View functions ────────────────────────────────────────────────────────

    /**
     * @notice Retrieve the Passport struct for a given batch.
     * @param batchId ProduceRegistry batch ID
     */
    function getPassport(uint256 batchId)
        external
        view
        returns (Passport memory)
    {
        require(_batchHasPassport[batchId], "FarmPassport: no passport for batch");
        return _passportsByBatch[batchId];
    }

    /**
     * @notice Returns true if a passport has been issued for the given batch.
     * @param batchId ProduceRegistry batch ID
     */
    function hasPassport(uint256 batchId) external view returns (bool) {
        return _batchHasPassport[batchId];
    }

    /**
     * @notice Returns all batchIds for which the farmer has passports.
     * @param farmer The farmer's wallet address
     * @return batchIds Array of ProduceRegistry batch IDs
     */
    function getFarmerPassports(address farmer)
        external
        view
        returns (uint256[] memory batchIds)
    {
        return _farmerBatchIds[farmer];
    }

    /**
     * @notice Returns the total number of passports minted so far.
     */
    function totalPassports() external view returns (uint256) {
        return _tokenCounter;
    }

    /**
     * @notice ERC-721 ownerOf — returns the farmer (original owner) of a token.
     * @param tokenId The NFT token ID
     */
    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _tokenOwner[tokenId];
        require(owner != address(0), "FarmPassport: token does not exist");
        return owner;
    }

    /**
     * @notice Returns the metadata URI for a given batch's passport.
     * @param batchId ProduceRegistry batch ID
     */
    function tokenURI(uint256 batchId) external view returns (string memory) {
        require(_batchHasPassport[batchId], "FarmPassport: no passport for batch");
        return _passportsByBatch[batchId].tokenUri;
    }
}
