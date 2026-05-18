// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AccessControl.sol";

contract ProduceRegistry is AccessControlModule {

    enum Status { Registered, InTransit, QualityChecked, Delivered, Rejected }

    struct Batch {
        uint256 batchId;
        string  produceType;
        uint256 quantity;
        address farmer;
        address currentHolder;
        string  farmLocation;
        uint256 harvestTimestamp;
        string  certification;
        string  notes;
        Status  status;
        bool    exists;
    }

    uint256 private _batchCounter;
    mapping(uint256 => Batch) private _batches;
    mapping(address => uint256[]) private _farmerBatches;
    mapping(address => uint256[]) private _holderBatches;
    uint256[] private _allBatchIds;

    event BatchRegistered(
        uint256 indexed batchId,
        address indexed farmer,
        string produceType,
        uint256 quantity
    );

    event BatchStatusUpdated(uint256 indexed batchId, Status newStatus);

    constructor() {
        _batchCounter = 1000;
    }

    function registerBatch(
        string calldata produceType,
        uint256 quantity,
        string calldata farmLocation,
        string calldata certification,
        string calldata notes
    ) external onlyRole(FARMER_ROLE) returns (uint256 batchId) {

        require(bytes(produceType).length > 0, "Produce type required");
        require(quantity > 0, "Quantity must be > 0");

        batchId = _batchCounter++;

        _batches[batchId] = Batch({
            batchId: batchId,
            produceType: produceType,
            quantity: quantity,
            farmer: msg.sender,
            currentHolder: msg.sender,
            farmLocation: farmLocation,
            harvestTimestamp: block.timestamp,
            certification: certification,
            notes: notes,
            status: Status.Registered,
            exists: true
        });

        _farmerBatches[msg.sender].push(batchId);
        _holderBatches[msg.sender].push(batchId);
        _allBatchIds.push(batchId);

        emit BatchRegistered(batchId, msg.sender, produceType, quantity);
    }

    function updateStatus(uint256 batchId, Status newStatus)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(_batches[batchId].exists, "Batch not found");

        _batches[batchId].status = newStatus;

        emit BatchStatusUpdated(batchId, newStatus);
    }

    function confirmDelivery(uint256 batchId) external {
        require(_batches[batchId].exists, "Batch not found");
        require(msg.sender == _batches[batchId].currentHolder, "Not current holder");
        
        _batches[batchId].status = Status.Delivered;
        emit BatchStatusUpdated(batchId, Status.Delivered);
    }

    function updateHolder(uint256 batchId, address newHolder)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(_batches[batchId].exists, "Batch not found");

        _batches[batchId].currentHolder = newHolder;
        _holderBatches[newHolder].push(batchId);
    }

    function getBatch(uint256 batchId)
        external
        view
        returns (Batch memory)
    {
        require(_batches[batchId].exists, "Batch not found");

        return _batches[batchId];
    }

    function getFarmerBatches(address farmer)
        external
        view
        returns (uint256[] memory)
    {
        return _farmerBatches[farmer];
    }

    function getHolderBatches(address holder)
        external
        view
        returns (uint256[] memory)
    {
        return _holderBatches[holder];
    }

    function getAllBatchIds() external view returns (uint256[] memory) {
        return _allBatchIds;
    }

    function totalBatches() external view returns (uint256) {
        return _batchCounter - 1000;
    }
}