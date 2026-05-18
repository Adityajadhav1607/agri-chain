const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer, farmer, distributor, retailer, inspector] =
    await ethers.getSigners();

  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // 1. Deploy AccessControlModule (standalone, not used by others directly)
  const AC = await ethers.getContractFactory("AccessControlModule");
  const ac = await AC.deploy();
  await ac.waitForDeployment();
  console.log("AccessControlModule:", await ac.getAddress());

  // 2. Deploy ProduceRegistry
  const Registry = await ethers.getContractFactory("ProduceRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("ProduceRegistry:    ", registryAddr);

  // 3. Deploy TrackTransfer
  const Tracker = await ethers.getContractFactory("TrackTransfer");
  const tracker = await Tracker.deploy(registryAddr);
  await tracker.waitForDeployment();
  const trackerAddr = await tracker.getAddress();
  console.log("TrackTransfer:      ", trackerAddr);

  // 4. Deploy QualityVerifier
  const Verifier = await ethers.getContractFactory("QualityVerifier");
  const verifier = await Verifier.deploy(registryAddr);
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log("QualityVerifier:    ", verifierAddr);

  // ── Role hashes ──────────────────────────────────────────────────
  const OPERATOR_ROLE    = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR"));
  const FARMER_ROLE      = ethers.keccak256(ethers.toUtf8Bytes("FARMER"));
  const DISTRIBUTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR"));
  const RETAILER_ROLE    = ethers.keccak256(ethers.toUtf8Bytes("RETAILER"));
  const INSPECTOR_ROLE   = ethers.keccak256(ethers.toUtf8Bytes("INSPECTOR"));

  // ── Grant OPERATOR to tracker & verifier on registry ─────────────
  await (await registry.grantRole(OPERATOR_ROLE, trackerAddr)).wait();
  await (await registry.grantRole(OPERATOR_ROLE, verifierAddr)).wait();
  console.log("\nOperator roles granted to contracts");

  // ── Grant test roles to Hardhat signers ──────────────────────────
  await (await registry.grantRole(FARMER_ROLE,      farmer.address)).wait();
  await (await tracker.grantRole(DISTRIBUTOR_ROLE,  distributor.address)).wait();
  await (await tracker.grantRole(RETAILER_ROLE,     retailer.address)).wait();
  await (await verifier.grantRole(INSPECTOR_ROLE,   inspector.address)).wait();

  console.log("Test roles granted:");
  console.log("  Farmer:      ", farmer.address);
  console.log("  Distributor: ", distributor.address);
  console.log("  Retailer:    ", retailer.address);
  console.log("  Inspector:   ", inspector.address);

  // ── Write addresses to frontend ──────────────────────────────────
  const addressesFile = path.join(__dirname, "../../frontend/src/utils/addresses.js");
  const content = `export const REGISTRY_ADDRESS   = "${registryAddr}";\nexport const TRACKER_ADDRESS    = "${trackerAddr}";\nexport const VERIFIER_ADDRESS   = "${verifierAddr}";\n`;
  fs.writeFileSync(addressesFile, content);
  console.log("\n✅ addresses.js updated in frontend/src/utils/");

  // ── Copy ABIs ─────────────────────────────────────────────────────
  const artifactsBase = path.join(__dirname, "../artifacts/contracts");
  const utilsDir      = path.join(__dirname, "../../frontend/src/utils");
  [
    ["ProduceRegistry.sol/ProduceRegistry.json", "ProduceRegistry.json"],
    ["TrackTransfer.sol/TrackTransfer.json",      "TrackTransfer.json"],
    ["QualityVerifier.sol/QualityVerifier.json",  "QualityVerifier.json"],
  ].forEach(([src, dst]) => {
    fs.copyFileSync(path.join(artifactsBase, src), path.join(utilsDir, dst));
  });
  console.log("✅ ABI files copied to frontend/src/utils/");

  console.log("\n=== Deployment complete ===");
  console.log({ ProduceRegistry: registryAddr, TrackTransfer: trackerAddr, QualityVerifier: verifierAddr });
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });