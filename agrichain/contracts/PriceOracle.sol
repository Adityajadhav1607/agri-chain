// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AccessControl.sol";

/**
 * @title  PriceOracle
 * @notice On-chain commodity price feed for Indian agricultural produce.
 *         Prices are stored in paise (1 INR = 100 paise) to avoid decimals.
 *         Exposes a Chainlink AggregatorV3-compatible latestRoundData() interface
 *         so frontend code can use a familiar API.
 *
 *         Updatable by admin or any address holding OPERATOR_ROLE.
 *         Pre-seeded with 10 common Indian crops at construction time.
 */
contract PriceOracle is AccessControlModule {

    // ── Structs ───────────────────────────────────────────────────────────────

    struct PriceData {
        string  crop;           // Lowercase crop name, e.g. "wheat"
        uint256 priceInPaise;   // Price per kg in paise (INR * 100)
        uint256 updatedAt;      // Block timestamp of last update
        uint80  roundId;        // Monotonically increasing round counter per crop
    }

    // ── State ─────────────────────────────────────────────────────────────────

    /// @dev Ordered list of all crop names (for enumeration)
    string[] private _cropList;

    /// @dev crop name (lowercase) => latest PriceData
    mapping(string => PriceData) private _prices;

    /// @dev crop name => whether it has been added
    mapping(string => bool) private _cropExists;

    /// @dev crop name => current round ID counter
    mapping(string => uint80) private _roundId;

    // ── Events ────────────────────────────────────────────────────────────────

    event PriceUpdated(string indexed crop, uint256 priceInPaise, uint256 timestamp);
    event CropAdded(string crop, uint256 initialPriceInPaise);

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @dev Seeds 10 standard Indian agricultural commodity prices.
     *      All prices are in paise per kg (INR * 100).
     */
    constructor() {
        // Seed initial prices: all lowercase, price in paise per kg
        _seedPrice("wheat",   2200);   //  ₹22.00 / kg
        _seedPrice("rice",    3500);   //  ₹35.00 / kg
        _seedPrice("tomato",  2500);   //  ₹25.00 / kg
        _seedPrice("onion",   1800);   //  ₹18.00 / kg
        _seedPrice("potato",  1500);   //  ₹15.00 / kg
        _seedPrice("mango",   6000);   //  ₹60.00 / kg
        _seedPrice("banana",  3000);   //  ₹30.00 / kg
        _seedPrice("apple",   8000);   //  ₹80.00 / kg
        _seedPrice("garlic",  12000);  // ₹120.00 / kg
        _seedPrice("ginger",  8000);   //  ₹80.00 / kg
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * @dev Adds a new crop with an initial price. Used in constructor only.
     */
    function _seedPrice(string memory crop, uint256 priceInPaise) internal {
        _cropList.push(crop);
        _cropExists[crop] = true;
        _roundId[crop] = 1;
        _prices[crop] = PriceData({
            crop:         crop,
            priceInPaise: priceInPaise,
            updatedAt:    block.timestamp,
            roundId:      1
        });
    }

    // ── Price update ──────────────────────────────────────────────────────────

    /**
     * @notice Update the price for a crop.
     *         If the crop doesn't exist yet, it is added to the registry.
     *         Caller must be admin or hold OPERATOR_ROLE.
     * @param crop         Lowercase crop name (e.g. "wheat")
     * @param priceInPaise New price in paise per kg
     */
    function updatePrice(string calldata crop, uint256 priceInPaise) external {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
            "PriceOracle: caller is not admin or operator"
        );
        require(bytes(crop).length > 0, "PriceOracle: empty crop name");
        require(priceInPaise > 0, "PriceOracle: price must be > 0");

        // Register new crop if it hasn't been seen before
        if (!_cropExists[crop]) {
            _cropList.push(crop);
            _cropExists[crop] = true;
            emit CropAdded(crop, priceInPaise);
        }

        // Increment round ID
        _roundId[crop] += 1;
        uint80 newRound = _roundId[crop];

        _prices[crop] = PriceData({
            crop:         crop,
            priceInPaise: priceInPaise,
            updatedAt:    block.timestamp,
            roundId:      newRound
        });

        emit PriceUpdated(crop, priceInPaise, block.timestamp);
    }

    // ── View functions ────────────────────────────────────────────────────────

    /**
     * @notice Get the current price and last-updated timestamp for a crop.
     * @param crop Lowercase crop name
     * @return priceInPaise Price in paise per kg
     * @return updatedAt    Block timestamp of last update
     */
    function getPrice(string calldata crop)
        external
        view
        returns (uint256 priceInPaise, uint256 updatedAt)
    {
        require(_cropExists[crop], "PriceOracle: crop not found");
        PriceData storage pd = _prices[crop];
        return (pd.priceInPaise, pd.updatedAt);
    }

    /**
     * @notice Chainlink AggregatorV3-compatible price feed interface.
     *         answer is in paise (int256 cast of priceInPaise).
     * @param crop Lowercase crop name
     * @return roundId        Current round ID
     * @return answer         Price in paise (cast to int256)
     * @return startedAt      Same as updatedAt (no distinction kept)
     * @return updatedAt      Block timestamp of last update
     * @return answeredInRound Same as roundId
     */
    function latestRoundData(string calldata crop)
        external
        view
        returns (
            uint80  roundId,
            int256  answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80  answeredInRound
        )
    {
        require(_cropExists[crop], "PriceOracle: crop not found");
        PriceData storage pd = _prices[crop];
        roundId        = pd.roundId;
        answer         = int256(pd.priceInPaise);
        startedAt      = pd.updatedAt;
        updatedAt      = pd.updatedAt;
        answeredInRound = pd.roundId;
    }

    /**
     * @notice Returns PriceData for all registered crops.
     * @return Array of PriceData structs in insertion order
     */
    function getAllPrices() external view returns (PriceData[] memory) {
        uint256 count = _cropList.length;
        PriceData[] memory all = new PriceData[](count);
        for (uint256 i = 0; i < count; i++) {
            all[i] = _prices[_cropList[i]];
        }
        return all;
    }

    /**
     * @notice Returns the total number of registered crops.
     */
    function getCropCount() external view returns (uint256) {
        return _cropList.length;
    }

    /**
     * @notice Returns the ordered list of all crop names.
     */
    function getCropList() external view returns (string[] memory) {
        return _cropList;
    }

    /**
     * @notice Returns whether a given crop name is registered.
     * @param crop Lowercase crop name
     */
    function cropExists(string calldata crop) external view returns (bool) {
        return _cropExists[crop];
    }
}
