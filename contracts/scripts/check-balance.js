import hre from "hardhat";

const [deployer] = await hre.ethers.getSigners();
console.log("Address:", deployer.address);
const bal = await hre.ethers.provider.getBalance(deployer.address);
console.log("Balance:", hre.ethers.formatEther(bal), "ETH");
