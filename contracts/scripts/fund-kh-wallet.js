import hre from "hardhat";

const KH_WALLET = process.env.KH_WALLET_ADDRESS;
const [signer] = await hre.ethers.getSigners();

const tx = await signer.sendTransaction({
  to: KH_WALLET,
  value: hre.ethers.parseEther("0.01"),
});
await tx.wait();
console.log("Sent 0.01 ETH to KeeperHub wallet. tx:", tx.hash);
