const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const qvAbi = [
    "function admin() external view returns (address)",
    "function carbonCreditContract() external view returns (address)"
  ];
  
  const qv = new ethers.Contract(
    "0xC9D48a0f03942B8cae52ab58e6c3343535D8CC18",
    qvAbi,
    deployer
  );
  
  const adminAddr   = await qv.admin();
  const ccAddr      = await qv.carbonCreditContract();
  
  console.log("QualityVerifier admin()   :", adminAddr);
  console.log("carbonCreditContract()    :", ccAddr);
  console.log("Current deployer wallet   :", deployer.address);
  console.log("Wallets match?            :", adminAddr.toLowerCase() === deployer.address.toLowerCase());
}

main().catch(console.error);
