const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgriChain — Complete Test Suite", function () {
  let registry, tracker, verifier;
  let owner, farmer, distributor, retailer, inspector, customer;

  // ── Deploy all contracts before each test ──────────────────────────────
  beforeEach(async function () {
    [owner, farmer, distributor, retailer, inspector, customer] =
      await ethers.getSigners();

    // Deploy ProduceRegistry
    const Registry = await ethers.getContractFactory("ProduceRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();

    // Deploy TrackTransfer
    const Tracker = await ethers.getContractFactory("TrackTransfer");
    tracker = await Tracker.deploy(await registry.getAddress());
    await tracker.waitForDeployment();

    // Deploy QualityVerifier
    const Verifier = await ethers.getContractFactory("QualityVerifier");
    verifier = await Verifier.deploy(await registry.getAddress());
    await verifier.waitForDeployment();

    // Grant roles
    const FARMER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FARMER"));
    const DISTRIBUTOR_ROLE = ethers.keccak256(
      ethers.toUtf8Bytes("DISTRIBUTOR"),
    );
    const RETAILER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RETAILER"));
    const INSPECTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("INSPECTOR"));
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR"));

    await registry.grantRole(FARMER_ROLE, farmer.address);
    await registry.grantRole(DISTRIBUTOR_ROLE, distributor.address);
    await registry.grantRole(RETAILER_ROLE, retailer.address);
    await registry.grantRole(INSPECTOR_ROLE, inspector.address);
    await registry.grantRole(OPERATOR_ROLE, await tracker.getAddress());
    await registry.grantRole(OPERATOR_ROLE, await verifier.getAddress());
    await registry.grantRole(OPERATOR_ROLE, retailer.address);
    await verifier.grantRole(INSPECTOR_ROLE, inspector.address);
  });

  // ════════════════════════════════════════════════════════════════════════
  // 1. ACCESS CONTROL TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("AccessControl", function () {
    it("Should set deployer as admin", async function () {
      const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN"));
      expect(await registry.hasRole(ADMIN_ROLE, owner.address)).to.equal(true);
    });

    it("Should correctly assign FARMER role", async function () {
      const FARMER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FARMER"));
      expect(await registry.hasRole(FARMER_ROLE, farmer.address)).to.equal(
        true,
      );
    });

    it("Should correctly assign DISTRIBUTOR role", async function () {
      const DISTRIBUTOR_ROLE = ethers.keccak256(
        ethers.toUtf8Bytes("DISTRIBUTOR"),
      );
      expect(
        await registry.hasRole(DISTRIBUTOR_ROLE, distributor.address),
      ).to.equal(true);
    });

    it("Should correctly assign RETAILER role", async function () {
      const RETAILER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RETAILER"));
      expect(await registry.hasRole(RETAILER_ROLE, retailer.address)).to.equal(
        true,
      );
    });

    it("Should allow admin to revoke a role", async function () {
      const FARMER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FARMER"));
      await registry.revokeRole(FARMER_ROLE, farmer.address);
      expect(await registry.hasRole(FARMER_ROLE, farmer.address)).to.equal(
        false,
      );
    });

    it("Should reject non-admin from granting roles", async function () {
      const FARMER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FARMER"));
      await expect(
        registry.connect(farmer).grantRole(FARMER_ROLE, customer.address),
      ).to.be.revertedWith("AccessControl: not admin");
    });

    it("Should reject granting same role twice", async function () {
      const FARMER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FARMER"));
      await expect(
        registry.grantRole(FARMER_ROLE, farmer.address),
      ).to.be.revertedWith("Role already granted");
    });

    it("Customer should have no special role", async function () {
      const FARMER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FARMER"));
      expect(await registry.hasRole(FARMER_ROLE, customer.address)).to.equal(
        false,
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 2. PRODUCE REGISTRY TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("ProduceRegistry", function () {
    it("Should register a batch and return correct data", async function () {
      await registry
        .connect(farmer)
        .registerBatch(
          "Wheat",
          500000,
          "Nasik, Maharashtra",
          "Organic",
          "Test batch",
        );
      const batch = await registry.getBatch(1000);
      expect(batch.produceType).to.equal("Wheat");
      expect(batch.quantity).to.equal(500000);
      expect(batch.farmLocation).to.equal("Nasik, Maharashtra");
      expect(batch.certification).to.equal("Organic");
      expect(batch.farmer).to.equal(farmer.address);
      expect(batch.exists).to.equal(true);
    });

    it("Should assign sequential Batch IDs starting from 1000", async function () {
      await registry
        .connect(farmer)
        .registerBatch("Wheat", 500, "Nasik", "None", "");
      await registry
        .connect(farmer)
        .registerBatch("Onion", 300, "Pune", "None", "");
      await registry
        .connect(farmer)
        .registerBatch("Tomato", 200, "Latur", "None", "");

      const b1 = await registry.getBatch(1000);
      const b2 = await registry.getBatch(1001);
      const b3 = await registry.getBatch(1002);

      expect(b1.produceType).to.equal("Wheat");
      expect(b2.produceType).to.equal("Onion");
      expect(b3.produceType).to.equal("Tomato");
    });

    it("Should emit BatchRegistered event with correct args", async function () {
      await expect(
        registry
          .connect(farmer)
          .registerBatch("Wheat", 500, "Nasik", "Organic", ""),
      )
        .to.emit(registry, "BatchRegistered")
        .withArgs(1000, farmer.address, "Wheat", 500);
    });

    it("Should track total batch count correctly", async function () {
      expect(await registry.totalBatches()).to.equal(0);
      await registry
        .connect(farmer)
        .registerBatch("Wheat", 500, "Nasik", "None", "");
      expect(await registry.totalBatches()).to.equal(1);
      await registry
        .connect(farmer)
        .registerBatch("Onion", 300, "Pune", "None", "");
      expect(await registry.totalBatches()).to.equal(2);
    });

    it("Should store farmer's batch IDs correctly", async function () {
      await registry
        .connect(farmer)
        .registerBatch("Wheat", 500, "Nasik", "None", "");
      await registry
        .connect(farmer)
        .registerBatch("Onion", 300, "Pune", "None", "");
      const farmerBatches = await registry.getFarmerBatches(farmer.address);
      expect(farmerBatches.length).to.equal(2);
      expect(farmerBatches[0]).to.equal(1000);
      expect(farmerBatches[1]).to.equal(1001);
    });

    it("Should set initial status as Registered (0)", async function () {
      await registry
        .connect(farmer)
        .registerBatch("Wheat", 500, "Nasik", "None", "");
      const batch = await registry.getBatch(1000);
      expect(batch.status).to.equal(0); // 0 = Registered
    });

    it("Should reject registration by non-farmer", async function () {
      await expect(
        registry
          .connect(customer)
          .registerBatch("Wheat", 500, "Nasik", "None", ""),
      ).to.be.revertedWith("AccessControl: missing role");
    });

    it("Should reject empty produce type", async function () {
      await expect(
        registry.connect(farmer).registerBatch("", 500, "Nasik", "None", ""),
      ).to.be.revertedWith("Produce type required");
    });

    it("Should reject zero quantity", async function () {
      await expect(
        registry.connect(farmer).registerBatch("Wheat", 0, "Nasik", "None", ""),
      ).to.be.revertedWith("Quantity must be > 0");
    });

    it("Should revert getBatch for non-existent batch", async function () {
      await expect(registry.getBatch(9999)).to.be.revertedWith(
        "Batch not found",
      );
    });

    it("Should allow OPERATOR to update batch status", async function () {
      await registry
        .connect(farmer)
        .registerBatch("Wheat", 500, "Nasik", "None", "");
      await registry.connect(retailer).updateStatus(1000, 3); // 3 = Delivered
      const batch = await registry.getBatch(1000);
      expect(batch.status).to.equal(3);
    });

    it("Should reject status update by non-operator", async function () {
      await registry
        .connect(farmer)
        .registerBatch("Wheat", 500, "Nasik", "None", "");
      await expect(
        registry.connect(customer).updateStatus(1000, 3),
      ).to.be.revertedWith("AccessControl: missing role");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 3. TRACK TRANSFER TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("TrackTransfer", function () {
    beforeEach(async function () {
      // Register a batch before each transfer test
      await registry
        .connect(farmer)
        .registerBatch("Wheat", 500000, "Nasik", "Organic", "");
    });

    it("Should log a transfer and store correct data", async function () {
      await tracker
        .connect(farmer)
        .logTransfer(
          1000,
          distributor.address,
          0,
          25,
          "Nasik Farm",
          "Picked up",
        );
      const history = await tracker.getBatchHistory(1000);
      expect(history.length).to.equal(1);
      expect(history[0].from).to.equal(farmer.address);
      expect(history[0].to).to.equal(distributor.address);
      expect(history[0].temperature).to.equal(25);
      expect(history[0].location).to.equal("Nasik Farm");
    });

    it("Should record full transfer chain: Farmer → Distributor → Retailer", async function () {
      await tracker
        .connect(farmer)
        .logTransfer(1000, distributor.address, 0, 25, "Farm", "Step 1");
      await tracker
        .connect(distributor)
        .logTransfer(1000, retailer.address, 0, 10, "Pune DC", "Step 2");
      const history = await tracker.getBatchHistory(1000);
      expect(history.length).to.equal(2);
      expect(history[0].from).to.equal(farmer.address);
      expect(history[0].to).to.equal(distributor.address);
      expect(history[1].from).to.equal(distributor.address);
      expect(history[1].to).to.equal(retailer.address);
    });

    it("Should emit TransferLogged event", async function () {
      await expect(
        tracker
          .connect(farmer)
          .logTransfer(1000, distributor.address, 0, 25, "Farm", "Note"),
      ).to.emit(tracker, "TransferLogged");
    });

    it("Should update batch status to InTransit after transfer", async function () {
      await tracker
        .connect(farmer)
        .logTransfer(1000, distributor.address, 0, 25, "Farm", "");
      const batch = await registry.getBatch(1000);
      expect(batch.status).to.equal(1); // 1 = InTransit
    });

    it("Should track transfer count correctly", async function () {
      expect(await tracker.getTransferCount(1000)).to.equal(0);
      await tracker
        .connect(farmer)
        .logTransfer(1000, distributor.address, 0, 25, "Farm", "");
      expect(await tracker.getTransferCount(1000)).to.equal(1);
      await tracker
        .connect(distributor)
        .logTransfer(1000, retailer.address, 0, 10, "DC", "");
      expect(await tracker.getTransferCount(1000)).to.equal(2);
    });

    it("Should reject transfer to zero address", async function () {
      await expect(
        tracker
          .connect(farmer)
          .logTransfer(1000, ethers.ZeroAddress, 0, 25, "Farm", ""),
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should reject transfer to yourself", async function () {
      await expect(
        tracker
          .connect(farmer)
          .logTransfer(1000, farmer.address, 0, 25, "Farm", ""),
      ).to.be.revertedWith("Cannot transfer to yourself");
    });

    it("Should reject transfer for non-existent batch", async function () {
      await expect(
        tracker
          .connect(farmer)
          .logTransfer(9999, distributor.address, 0, 25, "Farm", ""),
      ).to.be.revertedWith("Batch not found");
    });

    it("Should handle negative temperature (cold chain)", async function () {
      await tracker
        .connect(farmer)
        .logTransfer(
          1000,
          distributor.address,
          0,
          -5,
          "Cold Storage",
          "Frozen",
        );
      const history = await tracker.getBatchHistory(1000);
      expect(history[0].temperature).to.equal(-5);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 4. QUALITY VERIFIER TESTS
  // ════════════════════════════════════════════════════════════════════════
  describe("QualityVerifier", function () {
    beforeEach(async function () {
      await registry
        .connect(farmer)
        .registerBatch("Wheat", 500000, "Nasik", "Organic", "");
      // Inspector role already granted in outer beforeEach — no need to grant again
    });

    it("Should issue a Grade A certificate", async function () {
      await verifier
        .connect(inspector)
        .issueCertificate(1000, 0, "QmHash123", "Excellent quality");
      const cert = await verifier.getBatchCertificate(1000);
      expect(cert.grade).to.equal(0); // 0 = Grade A
      expect(cert.passed).to.equal(true);
      expect(cert.ipfsHash).to.equal("QmHash123");
      expect(cert.inspector).to.equal(inspector.address);
    });

    it("Should issue a Rejected certificate and set status", async function () {
      await verifier
        .connect(inspector)
        .issueCertificate(1000, 3, "QmHash456", "Failed quality check");
      const cert = await verifier.getBatchCertificate(1000);
      expect(cert.grade).to.equal(3); // 3 = Rejected
      expect(cert.passed).to.equal(false);
      const batch = await registry.getBatch(1000);
      expect(batch.status).to.equal(4); // 4 = Rejected
    });

    it("Should update batch status to QualityChecked on pass", async function () {
      await verifier
        .connect(inspector)
        .issueCertificate(1000, 0, "QmHash", "Grade A");
      const batch = await registry.getBatch(1000);
      expect(batch.status).to.equal(2); // 2 = QualityChecked
    });

    it("Should emit CertificateIssued event", async function () {
      await expect(
        verifier.connect(inspector).issueCertificate(1000, 0, "QmHash", "Good"),
      ).to.emit(verifier, "CertificateIssued");
    });

    it("Should reject certificate by non-inspector", async function () {
      await expect(
        verifier.connect(customer).issueCertificate(1000, 0, "QmHash", "Good"),
      ).to.be.revertedWith("AccessControl: missing role");
    });

    it("Should reject certificate for non-existent batch", async function () {
      await expect(
        verifier.connect(inspector).issueCertificate(9999, 0, "QmHash", "Good"),
      ).to.be.revertedWith("Batch not found");
    });

    it("Should retrieve certificate by certId", async function () {
      await verifier
        .connect(inspector)
        .issueCertificate(1000, 1, "QmHash789", "Grade B — minor issues");
      const cert = await verifier.getCertificate(1);
      expect(cert.grade).to.equal(1); // 1 = Grade B
      expect(cert.remarks).to.equal("Grade B — minor issues");
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 5. END-TO-END INTEGRATION TEST
  // ════════════════════════════════════════════════════════════════════════
  describe("End-to-end supply chain flow", function () {
    it("Should complete full flow: Register → Transfer → Deliver → Certify", async function () {
      // Step 1: Farmer registers batch
      await registry
        .connect(farmer)
        .registerBatch(
          "Wheat",
          1000000,
          "Nasik, Maharashtra",
          "Organic",
          "Harvested fresh",
        );
      let batch = await registry.getBatch(1000);
      expect(batch.status).to.equal(0); // Registered
      expect(batch.produceType).to.equal("Wheat");
      console.log("    ✓ Step 1: Batch #1000 registered by Farmer");

      // Step 2: Farmer transfers to Distributor
      await tracker
        .connect(farmer)
        .logTransfer(
          1000,
          distributor.address,
          0,
          25,
          "Nasik Farm Gate",
          "Pickup confirmed",
        );
      batch = await registry.getBatch(1000);
      expect(batch.status).to.equal(1); // InTransit
      console.log("    ✓ Step 2: Batch transferred Farmer → Distributor");

      // Step 3: Distributor transfers to Retailer
      await tracker
        .connect(distributor)
        .logTransfer(
          1000,
          retailer.address,
          0,
          10,
          "Pune Distribution Centre",
          "Delivered to retailer",
        );
      const history = await tracker.getBatchHistory(1000);
      expect(history.length).to.equal(2);
      console.log("    ✓ Step 3: Batch transferred Distributor → Retailer");

      // Step 4: Retailer confirms delivery
      await registry.connect(retailer).updateStatus(1000, 3); // Delivered
      batch = await registry.getBatch(1000);
      expect(batch.status).to.equal(3); // Delivered
      console.log("    ✓ Step 4: Delivery confirmed by Retailer");

      // Step 5: Inspector certifies quality
      await verifier.connect(inspector).issueCertificate(
          1000,
          0,
          "QmXyz123abc",
          "Grade A — passed all checks",
        );
      const cert = await verifier.getBatchCertificate(1000);
      expect(cert.passed).to.equal(true);
      console.log("    ✓ Step 5: Quality certificate issued — Grade A");

      // Step 6: Verify complete history (Customer view)
      const fullHistory = await tracker.getBatchHistory(1000);
      expect(fullHistory.length).to.equal(2);
      expect(fullHistory[0].from).to.equal(farmer.address);
      expect(fullHistory[1].to).to.equal(retailer.address);
      console.log(
        "    ✓ Step 6: Customer can trace full journey —",
        fullHistory.length,
        "transfers",
      );
    });
  });
});
