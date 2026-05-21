// SPDX-License-Identifier: MIT
/**
 * @file   deployPriceOracle.js
 * @notice Deploys the PriceOracle contract to Sepolia and prints all seeded prices.
 *
 * Usage:
 *   npx hardhat run scripts/deployPriceOracle.js --network sepolia
 *
 * After deployment:
 *   Copy the printed ORACLE_ADDRESS into frontend/src/utils/addresses.js
 */

const { ethers } = require("hardhat");

// ── Known deployed addresses ──────────────────────────────────────────────────
const REGISTRY_ADDRESS = "0x4850b47EE1C106D814822F7737e6cC95C8651240";
const TRACKER_ADDRESS  = "0x70a16B829C507bd025416a6660eAB2f5F0d59FBF";
const VERIFIER_ADDRESS = "0xC9D48a0f03942B8cae52ab58e6c3343535D8CC18";

// Expected initial crop data (must match constructor in PriceOracle.sol)
const INITIAL_PRICES = [
    { crop: "wheat",   paise: 2200  },
    { crop: "rice",    paise: 3500  },
    { crop: "tomato",  paise: 2500  },
    { crop: "onion",   paise: 1800  },
    { crop: "potato",  paise: 1500  },
    { crop: "mango",   paise: 6000  },
    { crop: "banana",  paise: 3000  },
    { crop: "apple",   paise: 8000  },
    { crop: "garlic",  paise: 12000 },
    { crop: "ginger",  paise: 8000  },
];

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  AgriChain — PriceOracle Deployment");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Network  : ${network.name}`);
    console.log(`  Deployer : ${deployer.address}`);
    console.log(`  Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
    console.log("───────────────────────────────────────────────────────────────");

    // ── Deploy PriceOracle ────────────────────────────────────────────────────
    console.log("\n[1/1] Deploying PriceOracle...");
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy();
    await priceOracle.waitForDeployment();

    const oracleAddress = await priceOracle.getAddress();

    console.log(`\n  ✅  PriceOracle deployed at: ${oracleAddress}`);
    console.log(`      Tx hash             : ${priceOracle.deploymentTransaction().hash}`);

    // ── Verify seeded prices ──────────────────────────────────────────────────
    console.log("\n  Verifying seeded prices on-chain...\n");
    console.log("  ┌──────────────┬──────────────┬──────────────────┐");
    console.log("  │ Crop         │ Paise / kg   │ INR / kg         │");
    console.log("  ├──────────────┼──────────────┼──────────────────┤");

    for (const { crop } of INITIAL_PRICES) {
        try {
            const [priceInPaise, updatedAt] = await priceOracle.getPrice(crop);
            const inr = (Number(priceInPaise) / 100).toFixed(2);
            console.log(
                `  │ ${crop.padEnd(12)} │ ${String(priceInPaise).padEnd(12)} │ ₹${inr.padStart(14)} │`
            );
        } catch (err) {
            console.log(`  │ ${crop.padEnd(12)} │ ERROR        │ ${err.message.substring(0, 14)} │`);
        }
    }

    console.log("  └──────────────┴──────────────┴──────────────────┘");

    const cropCount = await priceOracle.getCropCount();
    console.log(`\n  Total crops registered: ${cropCount}`);

    // ── Print update instructions ─────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  HOW TO UPDATE PRICES (admin or operator wallet required)");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  npx hardhat console --network sepolia`);
    console.log(`  > const oracle = await ethers.getContractAt("PriceOracle", "${oracleAddress}")`);
    console.log(`  > await oracle.updatePrice("wheat", 2400)   // ₹24.00/kg`);

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  ADDRESS SUMMARY — Copy to frontend/src/utils/addresses.js");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  REGISTRY_ADDRESS : "${REGISTRY_ADDRESS}"`);
    console.log(`  TRACKER_ADDRESS  : "${TRACKER_ADDRESS}"`);
    console.log(`  VERIFIER_ADDRESS : "${VERIFIER_ADDRESS}"`);
    console.log(`  ORACLE_ADDRESS   : "${oracleAddress}"`);
    console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
