/**
 * One-time setup: approve the escrow contract to spend USDC from the KeeperHub wallet.
 * KeeperHub wallet must call this — use KeeperHub's Direct Execution API.
 */
import hre from "hardhat";

const USDC = process.env.USDC_ADDRESS;
const ESCROW = process.env.ESCROW_ADDRESS;
const KH_WALLET = process.env.KH_WALLET_ADDRESS;

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const [signer] = await hre.ethers.getSigners();
const usdc = new hre.ethers.Contract(USDC, ERC20_ABI, signer);

const balance = await usdc.balanceOf(KH_WALLET);
console.log("KeeperHub wallet USDC balance:", hre.ethers.formatUnits(balance, 6), "USDC");

const allowance = await usdc.allowance(KH_WALLET, ESCROW);
console.log("Current allowance:", hre.ethers.formatUnits(allowance, 6), "USDC");

// Approve max so we don't need to re-approve per task
const MAX = hre.ethers.MaxUint256;
const tx = await usdc.approve(ESCROW, MAX);
await tx.wait();
console.log("Approved! tx:", tx.hash);
