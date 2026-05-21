/**
 * fixWireUp.js — Calls QualityVerifier.setCarbonCreditContract() directly
 * This is needed because QualityVerifier was deployed before the new contracts.
 * The deployer must be the admin of QualityVerifier.
 */
const { ethers } = require("hardhat");

const VERIFIER_ADDRESS      = "0xC9D48a0f03942B8cae52ab58e6c3343535D8CC18";
const CARBON_CREDIT_ADDRESS = "0xd9e911CC058b99C1a15eEC5C6A2E5b884A3111b0";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const qvAbi = [
    "function setCarbonCreditContract(address) external",
    "function carbonCreditContract() external view returns (address)",
    "function hasRole(bytes32, address) external view returns (bool)"
  ];

  const qv = new ethers.Contract(VERIFIER_ADDRESS, qvAbi, deployer);

  // Check current admin
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN"));
  let isAdmin = false;
  try {
    isAdmin = await qv.hasRole(ADMIN_ROLE, deployer.address);
    console.log("Is admin?", isAdmin);
  } catch {
    // Try DEFAULT_ADMIN_ROLE = 0x00
    const DEFAULT_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
    isAdmin = await qv.hasRole(DEFAULT_ADMIN, deployer.address);
    console.log("Is DEFAULT_ADMIN?", isAdmin);
  }

  if (!isAdmin) {
    console.error("❌ Deployer is not admin of QualityVerifier. Cannot set carbon credit contract.");
    console.error("   You need to call this from the wallet that originally deployed QualityVerifier.");
    process.exit(1);
  }

  console.log("\nCalling setCarbonCreditContract...");
  const tx = await qv.setCarbonCreditContract(CARBON_CREDIT_ADDRESS);
  console.log("Tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Confirmed at block", receipt.blockNumber);

  const stored = await qv.carbonCreditContract();
  console.log("Verified stored address:", stored);
  if (stored.toLowerCase() === CARBON_CREDIT_ADDRESS.toLowerCase()) {
    console.log("🎉 Wire-up complete! Carbon Credit auto-minting is now live.");
  }
}

main().catch(console.error);
