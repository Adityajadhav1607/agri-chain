/**
 * redeployVerifier.js — Redeploy QualityVerifier with CarbonCredit integration
 * The original QualityVerifier doesn't have setCarbonCreditContract().
 * This deploys the updated version and wires it up in one shot.
 *
 * Usage:
 *   npx hardhat run scripts/redeployVerifier.js --network sepolia
 *
 * After running:
 *   - Copy the new VERIFIER_ADDRESS to frontend/src/utils/addresses.js
 */

const { ethers } = require("hardhat");

const REGISTRY_ADDRESS      = "0x4850b47EE1C106D814822F7737e6cC95C8651240";
const CARBON_CREDIT_ADDRESS = "0xd9e911CC058b99C1a15eEC5C6A2E5b884A3111b0";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  AgriChain — QualityVerifier Redeploy (with CarbonCredit hook)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Network  : ${network.name}`);
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("───────────────────────────────────────────────────────────────\n");

  // 1. Deploy new QualityVerifier
  console.log("[1/3] Deploying updated QualityVerifier...");
  const QVFactory = await ethers.getContractFactory("QualityVerifier");
  const qv = await QVFactory.deploy(REGISTRY_ADDRESS);
  await qv.waitForDeployment();
  const qvAddress = await qv.getAddress();
  console.log(`  ✅  QualityVerifier deployed at: ${qvAddress}`);

  // 2. Set carbon credit contract
  console.log("\n[2/3] Calling setCarbonCreditContract...");
  const tx1 = await qv.setCarbonCreditContract(CARBON_CREDIT_ADDRESS);
  await tx1.wait();
  const stored = await qv.carbonCreditContract();
  console.log(`  ✅  carbonCreditContract set to: ${stored}`);

  // 3. Wire CarbonCredit minter → new verifier
  console.log("\n[3/3] Updating CarbonCredit.setAuthorizedMinter → new verifier...");
  const ccAbi = ["function setAuthorizedMinter(address) external", "function authorizedMinter() external view returns (address)"];
  const cc = new ethers.Contract(CARBON_CREDIT_ADDRESS, ccAbi, deployer);
  const tx2 = await cc.setAuthorizedMinter(qvAddress);
  await tx2.wait();
  const minter = await cc.authorizedMinter();
  console.log(`  ✅  authorizedMinter set to: ${minter}`);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  🎉  All done! Update frontend/src/utils/addresses.js:");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  VERIFIER_ADDRESS      : "${qvAddress}"`);
  console.log(`  CARBON_CREDIT_ADDRESS : "${CARBON_CREDIT_ADDRESS}"`);
  console.log(`  ORACLE_ADDRESS        : "0xB9feB027A3948cDCDdcFb0E5ba2F74b8333015E1"`);
  console.log(`  FARM_PASSPORT_ADDRESS : "0x3990D7b8d39521704D2af6b3cac995e478D2d724"`);
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
