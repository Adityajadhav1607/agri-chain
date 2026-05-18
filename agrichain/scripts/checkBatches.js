const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const REGISTRY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  
  const registry = await ethers.getContractAt("ProduceRegistry", REGISTRY_ADDRESS);
  
  const total = await registry.totalBatches();
  console.log("Total batches registered:", total.toString());
  
  // Check batches from 1000 onwards
  for (let i = 1000; i < 1000 + Number(total); i++) {
    try {
      const batch = await registry.getBatch(i);
      console.log(`\nBatch #${i}:`);
      console.log("  Produce:", batch.produceType);
      console.log("  Quantity:", batch.quantity.toString(), "kg");
      console.log("  Location:", batch.farmLocation);
      console.log("  Farmer:", batch.farmer);
      console.log("  Status:", ["Registered","InTransit","QualityChecked","Delivered","Rejected"][batch.status]);
    } catch(e) {
      console.log(`Batch #${i}: not found`);
    }
  }
}

main().catch(console.error);