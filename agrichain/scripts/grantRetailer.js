const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  
  const REGISTRY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const RETAILER_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

  const registry = await ethers.getContractAt("ProduceRegistry", REGISTRY_ADDRESS);

  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR"));
  const RETAILER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RETAILER"));

  // Grant OPERATOR role so retailer can call updateStatus
  if (!(await registry.hasRole(OPERATOR_ROLE, RETAILER_ADDRESS))) {
    await registry.grantRole(OPERATOR_ROLE, RETAILER_ADDRESS);
    console.log("✅ OPERATOR role granted to Retailer");
  } else {
    console.log("⚠️  OPERATOR already granted to Retailer");
  }

  if (!(await registry.hasRole(RETAILER_ROLE, RETAILER_ADDRESS))) {
    await registry.grantRole(RETAILER_ROLE, RETAILER_ADDRESS);
    console.log("✅ RETAILER role granted");
  } else {
    console.log("⚠️  RETAILER role already granted");
  }

  console.log("Done!");
}

main().catch(console.error);