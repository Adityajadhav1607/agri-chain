// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AccessControl.sol";
import "./ProduceRegistry.sol";

contract QualityVerifier is AccessControlModule {

    enum Grade { A, B, C, Rejected }

    struct Certificate {
        uint256 certId;
        uint256 batchId;
        address inspector;
        Grade grade;
        uint256 issuedAt;
        string ipfsHash;
        string remarks;
        bool passed;
    }

    uint256 private _certCounter;

    ProduceRegistry private _registry;

    mapping(uint256 => Certificate) private _certs;

    mapping(uint256 => uint256) private _batchCert;

    event CertificateIssued(
        uint256 indexed certId,
        uint256 indexed batchId,
        Grade grade,
        bool passed,
        string ipfsHash
    );

    constructor(address registryAddress) {
        _registry = ProduceRegistry(registryAddress);
    }

    function issueCertificate(
        uint256 batchId,
        Grade grade,
        string calldata ipfsHash,
        string calldata remarks
    ) external onlyRole(INSPECTOR_ROLE)
      returns (uint256 certId)
    {
        _registry.getBatch(batchId);

        require(
            _batchCert[batchId] == 0,
            "Certificate already issued"
        );

        certId = ++_certCounter;

        bool passed = grade != Grade.Rejected;

        _certs[certId] = Certificate({
            certId: certId,
            batchId: batchId,
            inspector: msg.sender,
            grade: grade,
            issuedAt: block.timestamp,
            ipfsHash: ipfsHash,
            remarks: remarks,
            passed: passed
        });

        _batchCert[batchId] = certId;

        ProduceRegistry.Status newStatus = passed
            ? ProduceRegistry.Status.QualityChecked
            : ProduceRegistry.Status.Rejected;

        _registry.updateStatus(batchId, newStatus);

        emit CertificateIssued(
            certId,
            batchId,
            grade,
            passed,
            ipfsHash
        );
    }

    function getCertificate(uint256 certId)
        external
        view
        returns (Certificate memory)
    {
        require(
            _certs[certId].certId != 0,
            "Certificate not found"
        );

        return _certs[certId];
    }

    function getBatchCertificate(uint256 batchId)
        external
        view
        returns (Certificate memory)
    {
        uint256 certId = _batchCert[batchId];

        require(certId != 0, "No certificate");

        return _certs[certId];
    }
}