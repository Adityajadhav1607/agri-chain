// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AccessControl.sol";
import "./ProduceRegistry.sol";

// ── External interface ────────────────────────────────────────────────────────

/**
 * @dev Minimal interface to the CarbonCredit contract.
 *      Used to auto-mint credits after a passing organic inspection.
 */
interface ICarbonCredit {
    function mint(address farmer, uint256 batchId, uint256 co2Grams) external;
}

// ── Main contract ─────────────────────────────────────────────────────────────

/**
 * @title  QualityVerifier
 * @notice Issues quality certificates for produce batches.
 *         Grade A or B batches with "Organic" certification automatically trigger
 *         carbon credit minting via the linked CarbonCredit contract.
 */
contract QualityVerifier is AccessControlModule {

    // ── Enums & Structs ───────────────────────────────────────────────────────

    enum Grade { A, B, C, Rejected }

    struct Certificate {
        uint256 certId;
        uint256 batchId;
        address inspector;
        Grade   grade;
        uint256 issuedAt;
        string  ipfsHash;
        string  remarks;
        bool    passed;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    uint256 private _certCounter;

    ProduceRegistry private _registry;

    /// @notice Address of the CarbonCredit contract for auto-minting credits
    address public carbonCreditContract;

    mapping(uint256 => Certificate) private _certs;

    /// @dev batchId => certId (0 means no certificate issued yet)
    mapping(uint256 => uint256) private _batchCert;

    // ── Events ────────────────────────────────────────────────────────────────

    event CertificateIssued(
        uint256 indexed certId,
        uint256 indexed batchId,
        Grade   grade,
        bool    passed,
        string  ipfsHash
    );

    event CarbonCreditContractUpdated(address indexed previousAddr, address indexed newAddr);

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address registryAddress) {
        _registry = ProduceRegistry(registryAddress);
    }

    // ── Admin setters ─────────────────────────────────────────────────────────

    /**
     * @notice Link the CarbonCredit contract so that passing organic inspections
     *         automatically trigger credit minting.
     * @param addr Deployed CarbonCredit contract address (set to address(0) to disable)
     */
    function setCarbonCreditContract(address addr) external onlyAdmin {
        address prev = carbonCreditContract;
        carbonCreditContract = addr;
        emit CarbonCreditContractUpdated(prev, addr);
    }

    // ── Core logic ────────────────────────────────────────────────────────────

    /**
     * @notice Issue a quality certificate for a produce batch.
     *         - Grade A or B  => batch passes, status set to QualityChecked.
     *         - Grade C       => batch passes (marginal), status set to QualityChecked.
     *         - Rejected      => batch fails, status set to Rejected.
     *
     *         If the batch is Grade A or B AND has "Organic" certification,
     *         carbon credits are automatically minted (try/catch so a failure
     *         in CarbonCredit does NOT revert the certificate issuance).
     *
     * @param batchId   ProduceRegistry batch ID
     * @param grade     Inspector's quality grade
     * @param ipfsHash  IPFS CID of the detailed inspection report
     * @param remarks   Free-text inspector remarks
     * @return certId   ID of the newly issued certificate
     */
    function issueCertificate(
        uint256 batchId,
        Grade   grade,
        string calldata ipfsHash,
        string calldata remarks
    )
        external
        onlyRole(INSPECTOR_ROLE)
        returns (uint256 certId)
    {
        // Fetch batch — reverts if batchId doesn't exist
        ProduceRegistry.Batch memory batch = _registry.getBatch(batchId);

        require(
            _batchCert[batchId] == 0,
            "Certificate already issued"
        );

        certId = ++_certCounter;

        bool passed = grade != Grade.Rejected;

        _certs[certId] = Certificate({
            certId:    certId,
            batchId:   batchId,
            inspector: msg.sender,
            grade:     grade,
            issuedAt:  block.timestamp,
            ipfsHash:  ipfsHash,
            remarks:   remarks,
            passed:    passed
        });

        _batchCert[batchId] = certId;

        ProduceRegistry.Status newStatus = passed
            ? ProduceRegistry.Status.QualityChecked
            : ProduceRegistry.Status.Rejected;

        _registry.updateStatus(batchId, newStatus);

        // ── Auto-mint Carbon Credit for organic Grade A or B batches ──────────
        // Only Grade A (0) and Grade B (1) qualify; Grade C and Rejected do not.
        if (passed && uint8(grade) <= 1 && carbonCreditContract != address(0)) {
            // Manual byte-level string comparison for "Organic" certification
            bytes memory certBytes    = bytes(batch.certification);
            bytes memory organicBytes = bytes("Organic");
            bool isOrganic = (certBytes.length == organicBytes.length);
            if (isOrganic) {
                for (uint256 i = 0; i < certBytes.length; i++) {
                    if (certBytes[i] != organicBytes[i]) {
                        isOrganic = false;
                        break;
                    }
                }
            }
            if (isOrganic) {
                // CO2 offset estimate: 50 grams per kg (organic farming research basis)
                uint256 co2Grams = batch.quantity * 50;
                // Use try/catch: a failure in CarbonCredit must NOT block certification
                try ICarbonCredit(carbonCreditContract).mint(batch.farmer, batchId, co2Grams) {}
                catch {}
            }
        }

        emit CertificateIssued(
            certId,
            batchId,
            grade,
            passed,
            ipfsHash
        );
    }

    // ── View functions ────────────────────────────────────────────────────────

    /**
     * @notice Retrieve a certificate by its ID.
     * @param certId Certificate ID
     */
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

    /**
     * @notice Retrieve the certificate issued for a given batch.
     * @param batchId ProduceRegistry batch ID
     */
    function getBatchCertificate(uint256 batchId)
        external
        view
        returns (Certificate memory)
    {
        uint256 certId = _batchCert[batchId];
        require(certId != 0, "No certificate");
        return _certs[certId];
    }

    /**
     * @notice Returns true if a certificate has been issued for the given batch.
     * @param batchId ProduceRegistry batch ID
     */
    function hasCertificate(uint256 batchId) external view returns (bool) {
        return _batchCert[batchId] != 0;
    }

    /**
     * @notice Returns the total number of certificates issued.
     */
    function totalCertificates() external view returns (uint256) {
        return _certCounter;
    }
}