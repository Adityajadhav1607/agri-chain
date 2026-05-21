// SPDX-License-Identifier: MIT
/**
 * @file   deployFarmPassport.js
 * @notice Deploys the FarmPassport contract to Sepolia.
 *
 * Usage:
 *   npx hardhat run scripts/deployFarmPassport.js --network sepolia
 *
 * After deployment:
 *   1. Copy the printed FARM_PASSPORT_ADDRESS into frontend/src/utils/addresses.js
 *   2. Grant OPERATOR_ROLE to any address that should be able to mintPassport()
 *      (the deployer already has OPERATOR_ROLE from the AccessControlModule constructor)
 */

const { ethers } = require("hardhat");

// ── Known deployed addresses ──────────────────────────────────────────────────
const REGISTRY_ADDRESS = "0x4850b47EE1C106D814822F7737e6cC95C8651240";
const TRACKER_ADDRESS  = "0x70a16B829C507bd025416a6660eAB2f5F0d59FBF";
const VERIFIER_ADDRESS = "0xC9D48a0f03942B8cae52ab58e6c3343535D8CC18";

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  AgriChain — FarmPassport Deployment");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Network  : ${network.name}`);
    console.log(`  Deployer : ${deployer.address}`);
    console.log(`  Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
    console.log("───────────────────────────────────────────────────────────────");

    // ── Deploy FarmPassport ───────────────────────────────────────────────────
    console.log("\n[1/1] Deploying FarmPassport...");
    const FarmPassport = await ethers.getContractFactory("FarmPassport");
    const farmPassport = await FarmPassport.deploy();
    await farmPassport.waitForDeployment();

    const farmPassportAddress = await farmPassport.getAddress();

    console.log(`\n  ✅  FarmPassport deployed at: ${farmPassportAddress}`);
    console.log(`      Tx hash              : ${farmPassport.deploymentTransaction().hash}`);

    // ── Verify basic state ────────────────────────────────────────────────────
    const name   = await farmPassport.name();
    const symbol = await farmPassport.symbol();
    const total  = await farmPassport.totalPassports();

    console.log(`\n  Token name   : ${name}`);
    console.log(`  Token symbol : ${symbol}`);
    console.log(`  Total minted : ${total}`);
    console.log(`  Admin        : ${deployer.address} (has OPERATOR_ROLE by default)`);

    // ── Print usage instructions ──────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  HOW TO MINT A PASSPORT (requires OPERATOR_ROLE)");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  npx hardhat console --network sepolia`);
    console.log(`  > const fp = await ethers.getContractAt("FarmPassport", "${farmPassportAddress}")`);
    console.log(`  > await fp.mintPassport(`);
    console.log(`      "0xFarmerAddress",`);
    console.log(`      1000,                          // batchId from ProduceRegistry`);
    console.log(`      "18.5204,73.8567",             // GPS coordinates`);
    console.log(`      "ipfs://QmYourMetadataHash"    // IPFS metadata URI`);
    console.log(`    )`);

    console.log("\n  HOW TO GRANT OPERATOR_ROLE TO ANOTHER ADDRESS");
    console.log("  ─────────────────────────────────────────────");
    console.log(`  > const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR"))`);
    console.log(`  > await fp.grantRole(OPERATOR_ROLE, "0xOperatorAddress")`);

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  ADDRESS SUMMARY — Copy to frontend/src/utils/addresses.js");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  REGISTRY_ADDRESS      : "${REGISTRY_ADDRESS}"`);
    console.log(`  TRACKER_ADDRESS       : "${TRACKER_ADDRESS}"`);
    console.log(`  VERIFIER_ADDRESS      : "${VERIFIER_ADDRESS}"`);
    console.log(`  FARM_PASSPORT_ADDRESS : "${farmPassportAddress}"`);
    console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
