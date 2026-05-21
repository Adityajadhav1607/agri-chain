// SPDX-License-Identifier: MIT
/**
 * @file   deployCarbonCredit.js
 * @notice Deploys the CarbonCredit contract to Sepolia and prints wiring instructions.
 *
 * Usage:
 *   npx hardhat run scripts/deployCarbonCredit.js --network sepolia
 *
 * After deployment:
 *   1. Copy the printed CARBON_CREDIT_ADDRESS into frontend/src/utils/addresses.js
 *   2. Run wireUpContracts.js  — OR — call the two setter functions manually (see below).
 */

const { ethers } = require("hardhat");

// ── Known deployed addresses ──────────────────────────────────────────────────
const VERIFIER_ADDRESS = "0xC9D48a0f03942B8cae52ab58e6c3343535D8CC18";
const REGISTRY_ADDRESS = "0x4850b47EE1C106D814822F7737e6cC95C8651240";
const TRACKER_ADDRESS  = "0x70a16B829C507bd025416a6660eAB2f5F0d59FBF";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  AgriChain — CarbonCredit Deployment");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Network  : ${(await ethers.provider.getNetwork()).name}`);
    console.log(`  Deployer : ${deployer.address}`);
    console.log(`  Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
    console.log("───────────────────────────────────────────────────────────────");

    // ── Deploy CarbonCredit ───────────────────────────────────────────────────
    console.log("\n[1/1] Deploying CarbonCredit...");
    const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
    const carbonCredit = await CarbonCredit.deploy();
    await carbonCredit.waitForDeployment();

    const carbonCreditAddress = await carbonCredit.getAddress();

    console.log(`\n  ✅  CarbonCredit deployed at: ${carbonCreditAddress}`);
    console.log(`      Tx hash              : ${carbonCredit.deploymentTransaction().hash}`);

    // ── Print wiring instructions ─────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  NEXT STEPS — Wire CarbonCredit to QualityVerifier");
    console.log("═══════════════════════════════════════════════════════════════");

    console.log("\n  Option A: Run the convenience wire-up script (recommended)");
    console.log("  ─────────────────────────────────────────────────────────");
    console.log(`  1. Open scripts/wireUpContracts.js`);
    console.log(`  2. Set CARBON_CREDIT_ADDRESS = "${carbonCreditAddress}"`);
    console.log(`  3. npx hardhat run scripts/wireUpContracts.js --network sepolia`);

    console.log("\n  Option B: Call setter functions manually via Hardhat console");
    console.log("  ─────────────────────────────────────────────────────────");
    console.log(`  npx hardhat console --network sepolia`);
    console.log(`  > const cc = await ethers.getContractAt("CarbonCredit", "${carbonCreditAddress}")`);
    console.log(`  > await cc.setAuthorizedMinter("${VERIFIER_ADDRESS}")`);
    console.log(`  > const qv = await ethers.getContractAt("QualityVerifier", "${VERIFIER_ADDRESS}")`);
    console.log(`  > await qv.setCarbonCreditContract("${carbonCreditAddress}")`);

    console.log("\n  Option C: Copy these hardhat task commands");
    console.log("  ─────────────────────────────────────────────────────────");
    console.log(`  # Step 1 — Authorise QualityVerifier as the minter`);
    console.log(`  npx hardhat --network sepolia verify --contract contracts/CarbonCredit.sol:CarbonCredit ${carbonCreditAddress}`);

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  ADDRESS SUMMARY — Copy to frontend/src/utils/addresses.js");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  REGISTRY_ADDRESS      : "${REGISTRY_ADDRESS}"`);
    console.log(`  TRACKER_ADDRESS       : "${TRACKER_ADDRESS}"`);
    console.log(`  VERIFIER_ADDRESS      : "${VERIFIER_ADDRESS}"`);
    console.log(`  CARBON_CREDIT_ADDRESS : "${carbonCreditAddress}"`);
    console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
