import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const USDC = process.env.USDC_ADDRESS;
  const EVALUATOR = process.env.EVALUATOR_ADDRESS;

  if (!USDC || !EVALUATOR) {
    throw new Error("Set USDC_ADDRESS and EVALUATOR_ADDRESS in .env");
  }

  // 1. Deploy escrow
  const Escrow = await hre.ethers.getContractFactory("HiveBidEscrow");
  const escrow = await Escrow.deploy(USDC, EVALUATOR);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("HiveBidEscrow deployed:", escrowAddr);

  // 2. Deploy delegation (points at the escrow)
  const Delegation = await hre.ethers.getContractFactory("HiveBidDelegation");
  const delegation = await Delegation.deploy(USDC, escrowAddr);
  await delegation.waitForDeployment();
  const delegationAddr = await delegation.getAddress();
  console.log("HiveBidDelegation deployed:", delegationAddr);

  console.log("\n--- Add these to your .env ---");
  console.log(`ESCROW_ADDRESS=${escrowAddr}`);
  console.log(`DELEGATION_ADDRESS=${delegationAddr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
