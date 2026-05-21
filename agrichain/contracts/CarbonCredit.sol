// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AccessControl.sol";

/**
 * @title  CarbonCredit
 * @notice Tracks CO2 offset credits earned by farmers for organic Grade A/B produce.
 *         Credits are minted by the authorizedMinter (QualityVerifier contract).
 *         Each batch can only receive credits once (_batchCredited guard).
 */
contract CarbonCredit is AccessControlModule {

    // ── Structs ───────────────────────────────────────────────────────────────

    struct CreditRecord {
        uint256 batchId;    // The produce batch this credit is tied to
        uint256 co2Grams;   // CO2 offset in grams
        uint256 issuedAt;   // Block timestamp at mint time
    }

    // ── State ─────────────────────────────────────────────────────────────────

    /// @notice The only address allowed to call mint() — should be set to QualityVerifier
    address public authorizedMinter;

    /// @dev farmer address => list of carbon credit records
    mapping(address => CreditRecord[]) private _farmerCredits;

    /// @dev batchId => already credited; prevents double-minting for same batch
    mapping(uint256 => bool) private _batchCredited;

    /// @notice Cumulative CO2 offset in grams per farmer
    mapping(address => uint256) public totalCO2;

    // ── Events ────────────────────────────────────────────────────────────────

    event CreditMinted(
        address indexed farmer,
        uint256 indexed batchId,
        uint256 co2Grams,
        uint256 timestamp
    );

    event AuthorizedMinterUpdated(address indexed previousMinter, address indexed newMinter);

    // ── Admin functions ───────────────────────────────────────────────────────

    /**
     * @notice Set the address that is authorised to call mint().
     *         Should be set to the deployed QualityVerifier contract address.
     * @param minter New authorised minter address (cannot be zero address)
     */
    function setAuthorizedMinter(address minter) external onlyAdmin {
        require(minter != address(0), "CarbonCredit: zero address");
        address prev = authorizedMinter;
        authorizedMinter = minter;
        emit AuthorizedMinterUpdated(prev, minter);
    }

    // ── Minting ───────────────────────────────────────────────────────────────

    /**
     * @notice Mint carbon credits for a farmer linked to a produce batch.
     * @dev    Can only be called by authorizedMinter (QualityVerifier).
     *         Reverts if the batch has already been credited.
     * @param farmer    The farmer who produced the batch
     * @param batchId   The ProduceRegistry batch ID
     * @param co2Grams  CO2 offset in grams (e.g. quantity * 50)
     */
    function mint(
        address farmer,
        uint256 batchId,
        uint256 co2Grams
    ) external {
        require(msg.sender == authorizedMinter, "CarbonCredit: caller not authorized minter");
        require(farmer != address(0), "CarbonCredit: zero farmer address");
        require(co2Grams > 0, "CarbonCredit: co2Grams must be > 0");
        require(!_batchCredited[batchId], "CarbonCredit: batch already credited");

        // Mark batch as credited before state changes (re-entrancy safety)
        _batchCredited[batchId] = true;

        // Record credit for the farmer
        _farmerCredits[farmer].push(CreditRecord({
            batchId:  batchId,
            co2Grams: co2Grams,
            issuedAt: block.timestamp
        }));

        // Accumulate total CO2 offset
        totalCO2[farmer] += co2Grams;

        emit CreditMinted(farmer, batchId, co2Grams, block.timestamp);
    }

    // ── View functions ────────────────────────────────────────────────────────

    /**
     * @notice Returns all carbon credit records for a given farmer.
     * @param farmer The farmer's wallet address
     */
    function getCreditsByFarmer(address farmer)
        external
        view
        returns (CreditRecord[] memory)
    {
        return _farmerCredits[farmer];
    }

    /**
     * @notice Returns the number of carbon credit records for a given farmer.
     * @param farmer The farmer's wallet address
     */
    function getCreditCount(address farmer) external view returns (uint256) {
        return _farmerCredits[farmer].length;
    }

    /**
     * @notice Returns whether a specific batch has already been credited.
     * @param batchId The ProduceRegistry batch ID
     */
    function isBatchCredited(uint256 batchId) external view returns (bool) {
        return _batchCredited[batchId];
    }
}
