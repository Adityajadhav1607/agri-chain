const { ethers } = require("hardhat");

async function main() {

  const [owner, farmer, distributor, retailer] =
    await ethers.getSigners();

  const REGISTRY_ADDRESS =
    "YOUR_REGISTRY_ADDRESS";

  const TRACKER_ADDRESS =
    "YOUR_TRACKER_ADDRESS";

  const registry =
    await ethers.getContractAt(
      "ProduceRegistry",
      REGISTRY_ADDRESS
    );

  const tracker =
    await ethers.getContractAt(
      "TrackTransfer",
      TRACKER_ADDRESS
    );

  const FARMER_ROLE = ethers.keccak256(
    ethers.toUtf8Bytes("FARMER")
  );

  const DISTRIBUTOR_ROLE = ethers.keccak256(
    ethers.toUtf8Bytes("DISTRIBUTOR")
  );

  const RETAILER_ROLE = ethers.keccak256(
    ethers.toUtf8Bytes("RETAILER")
  );

  await registry.grantRole(
    FARMER_ROLE,
    farmer.address
  );

  await tracker.grantRole(
    DISTRIBUTOR_ROLE,
    distributor.address
  );

  await tracker.grantRole(
    RETAILER_ROLE,
    retailer.address
  );

  console.log("Roles granted");

}

main()
  .then(() => process.exit(0))
  .catch(console.error);