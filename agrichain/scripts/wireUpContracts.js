// SPDX-License-Identifier: MIT
/**
 * @file   wireUpContracts.js
 * @notice Convenience script that wires CarbonCredit <-> QualityVerifier after
 *         both contracts have been deployed.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * BEFORE RUNNING: Fill in the addresses below after deploying the contracts.
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Usage:
 *   npx hardhat run scripts/wireUpContracts.js --network sepolia
 *
 * What this script does:
 *   1. Calls QualityVerifier.setCarbonCreditContract(carbonCreditAddress)
 *      → Tells QualityVerifier where to send auto-mint calls.
 *   2. Calls CarbonCredit.setAuthorizedMinter(verifierAddress)
 *      → Allows QualityVerifier to call CarbonCredit.mint().
 *
 * Both calls require the deployer wallet (msg.sender must be admin).
 */

const { ethers } = require("hardhat");

// ══════════════════════════════════════════════════════════════════════════════
//  FILL IN THESE ADDRESSES BEFORE RUNNING
// ══════════════════════════════════════════════════════════════════════════════

const VERIFIER_ADDRESS      = "0xC9D48a0f03942B8cae52ab58e6c3343535D8CC18"; // Already deployed
const CARBON_CREDIT_ADDRESS = "0xd9e911CC058b99C1a15eEC5C6A2E5b884A3111b0"; // Deployed 2026-05-21


// ══════════════════════════════════════════════════════════════════════════════

async function main() {
    // ── Pre-flight check ──────────────────────────────────────────────────────
    if (CARBON_CREDIT_ADDRESS === "FILL_ME_IN") {
        console.error(
            "\n  ❌  ERROR: CARBON_CREDIT_ADDRESS is not set.\n" +
            "      Run deployCarbonCredit.js first, then copy the address into this script.\n"
        );
        process.exit(1);
    }

    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  AgriChain — Contract Wire-Up");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Network         : ${network.name}`);
    console.log(`  Admin / Deployer: ${deployer.address}`);
    console.log(`  Balance         : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
    console.log("───────────────────────────────────────────────────────────────");
    console.log(`  QualityVerifier  : ${VERIFIER_ADDRESS}`);
    console.log(`  CarbonCredit     : ${CARBON_CREDIT_ADDRESS}`);
    console.log("───────────────────────────────────────────────────────────────\n");

    // ── Attach to contracts ───────────────────────────────────────────────────
    const qualityVerifier = await ethers.getContractAt("QualityVerifier", VERIFIER_ADDRESS);
    const carbonCredit    = await ethers.getContractAt("CarbonCredit",    CARBON_CREDIT_ADDRESS);

    let allSuccess = true;

    // ── Step 1: Tell QualityVerifier about CarbonCredit ──────────────────────
    console.log("[1/2] Calling QualityVerifier.setCarbonCreditContract()...");
    try {
        const tx1 = await qualityVerifier.setCarbonCreditContract(CARBON_CREDIT_ADDRESS);
        process.stdout.write("      Waiting for confirmation...");
        const receipt1 = await tx1.wait();
        console.log(` ✅ confirmed (block ${receipt1.blockNumber}, gas ${receipt1.gasUsed})`);

        // Verify the value was set
        const storedAddr = await qualityVerifier.carbonCreditContract();
        if (storedAddr.toLowerCase() === CARBON_CREDIT_ADDRESS.toLowerCase()) {
            console.log(`      Verified: carbonCreditContract = ${storedAddr}`);
        } else {
            console.warn(`      ⚠️  Warning: stored address mismatch! Got: ${storedAddr}`);
        }
    } catch (err) {
        console.error(`\n  ❌  FAILED: ${err.message}`);
        console.error("      Make sure the deployer wallet is the admin of QualityVerifier.");
        allSuccess = false;
    }

    // ── Step 2: Authorise QualityVerifier to call CarbonCredit.mint() ─────────
    console.log("\n[2/2] Calling CarbonCredit.setAuthorizedMinter()...");
    try {
        const tx2 = await carbonCredit.setAuthorizedMinter(VERIFIER_ADDRESS);
        process.stdout.write("      Waiting for confirmation...");
        const receipt2 = await tx2.wait();
        console.log(` ✅ confirmed (block ${receipt2.blockNumber}, gas ${receipt2.gasUsed})`);

        // Verify the value was set
        const storedMinter = await carbonCredit.authorizedMinter();
        if (storedMinter.toLowerCase() === VERIFIER_ADDRESS.toLowerCase()) {
            console.log(`      Verified: authorizedMinter = ${storedMinter}`);
        } else {
            console.warn(`      ⚠️  Warning: stored minter mismatch! Got: ${storedMinter}`);
        }
    } catch (err) {
        console.error(`\n  ❌  FAILED: ${err.message}`);
        console.error("      Make sure the deployer wallet is the admin of CarbonCredit.");
        allSuccess = false;
    }

    // ── Final summary ─────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════════");
    if (allSuccess) {
        console.log("  🎉  Wire-up complete! The integration is now live:");
        console.log("      When QualityVerifier.issueCertificate() is called with");
        console.log("      a Grade A or B batch that has 'Organic' certification,");
        console.log("      CarbonCredit.mint() will be called automatically.");
    } else {
        console.log("  ⚠️  Wire-up finished with errors. Review the output above.");
    }
    console.log("\n  CONTRACT ADDRESSES");
    console.log(`  QualityVerifier  : ${VERIFIER_ADDRESS}`);
    console.log(`  CarbonCredit     : ${CARBON_CREDIT_ADDRESS}`);
    console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
