// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AccessControl.sol";
import "./ProduceRegistry.sol";

contract TrackTransfer is AccessControlModule {

    enum TransportMode { Road, Rail, Air, Sea }

    struct Transfer {
        uint256 transferId;
        uint256 batchId;
        address from;
        address to;
        TransportMode transport;
        int16 temperature;
        uint256 timestamp;
        string location;
        string notes;
    }

    uint256 private _transferCounter;

    ProduceRegistry private _registry;

    mapping(uint256 => Transfer[]) private _batchHistory;

    event TransferLogged(
        uint256 indexed transferId,
        uint256 indexed batchId,
        address indexed from,
        address to,
        TransportMode transport
    );

    constructor(address registryAddress) {
        _registry = ProduceRegistry(registryAddress);
    }

    function logTransfer(
        uint256 batchId,
        address to,
        TransportMode transport,
        int16 temperature,
        string calldata location,
        string calldata notes
    ) external returns (uint256 transferId) {

        require(to != address(0), "Invalid recipient");
        require(to != msg.sender, "Cannot transfer to yourself");

        require(
            hasRole(DISTRIBUTOR_ROLE, msg.sender) ||
            hasRole(RETAILER_ROLE, msg.sender),
            "Unauthorized"
        );

        ProduceRegistry.Batch memory batch =
            _registry.getBatch(batchId);

        require(batch.exists, "Batch not found");

        require(
            batch.currentHolder == msg.sender,
            "Not current holder"
        );

        transferId = ++_transferCounter;

        _batchHistory[batchId].push(Transfer({
            transferId: transferId,
            batchId: batchId,
            from: msg.sender,
            to: to,
            transport: transport,
            temperature: temperature,
            timestamp: block.timestamp,
            location: location,
            notes: notes
        }));

        _registry.updateStatus(
            batchId,
            ProduceRegistry.Status.InTransit
        );

        _registry.updateHolder(batchId, to);

        emit TransferLogged(
            transferId,
            batchId,
            msg.sender,
            to,
            transport
        );
    }

    function getBatchHistory(uint256 batchId)
        external
        view
        returns (Transfer[] memory)
    {
        return _batchHistory[batchId];
    }

    function getTransferCount(uint256 batchId)
        external
        view
        returns (uint256)
    {
        return _batchHistory[batchId].length;
    }
}