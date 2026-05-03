/**
 * interact.js — call every function on HiveBidEscrow and HiveBidDelegation
 *
 * Usage (from contracts/scripts/ or contracts/):
 *   node scripts/interact.js
 *
 * Reads from contracts/.env (DEPLOYER_PRIVATE_KEY, EVALUATOR_PRIVATE_KEY, USDC_ADDRESS)
 */

import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env files — contracts/.env first, then backend/.env as fallback
dotenvConfig({ path: resolve(__dirname, "../.env") });
dotenvConfig({ path: resolve(__dirname, "../../backend/.env"), override: false });

// ── Config ────────────────────────────────────────────────────────────────────
const RPC_URL          = process.env.BASE_SEPOLIA_RPC || process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const DEPLOYER_KEY     = process.env.DEPLOYER_PRIVATE_KEY;
const EVALUATOR_KEY    = process.env.EVALUATOR_PRIVATE_KEY || DEPLOYER_KEY;
const USDC_ADDR        = process.env.USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const ESCROW_ADDR      = "0x2725111582b68539df62d57f579eafcebfb870b0";
const DELEGATION_ADDR  = "0xa952e8ac92bce001b5ef4ddb1a4027a7b9d2868e";

if (!DEPLOYER_KEY) {
  console.error("ERROR: DEPLOYER_PRIVATE_KEY not set in contracts/.env");
  process.exit(1);
}

// ── ABIs ──────────────────────────────────────────────────────────────────────
const ESCROW_ABI = [
  "function usdc() view returns (address)",
  "function evaluator() view returns (address)",
  "function tasks(bytes32) view returns (address client, address worker, uint256 amount, uint8 status, uint256 deadline)",
  "function getTask(bytes32 taskId) view returns (tuple(address client, address worker, uint256 amount, uint8 status, uint256 deadline))",
  "function lock(bytes32 taskId, address worker, uint256 amount, uint256 deadline)",
  "function lockFor(bytes32 taskId, address client, address worker, uint256 amount, uint256 deadline)",
  "function release(bytes32 taskId, bytes evaluatorSig)",
  "function refund(bytes32 taskId, bytes evaluatorSig)",
  "function refundExpired(bytes32 taskId)",
  "event Locked(bytes32 indexed taskId, address indexed client, address indexed worker, uint256 amount)",
  "event Released(bytes32 indexed taskId, address indexed worker, uint256 amount)",
  "event Refunded(bytes32 indexed taskId, address indexed client, uint256 amount)",
];

const DELEGATION_ABI = [
  "function usdc() view returns (address)",
  "function escrowContract() view returns (address)",
  "function delegations(bytes32) view returns (address agent, bytes32 taskId, uint256 maxAmount, uint256 expiry, bool consumed)",
  "function isValid(bytes32 delegationId) view returns (bool)",
  "function createDelegation(bytes32 delegationId, address agent, bytes32 taskId, uint256 maxAmount, uint256 expiry)",
  "function executeEscrowLock(bytes32 delegationId, address userWallet, address worker, uint256 amount, uint256 taskDeadline)",
  "function revoke(bytes32 delegationId)",
  "event DelegationCreated(bytes32 indexed delegationId, address indexed agent, bytes32 indexed taskId, uint256 maxAmount, uint256 expiry)",
  "event DelegationConsumed(bytes32 indexed delegationId, bytes32 indexed taskId, uint256 amount)",
  "event DelegationRevoked(bytes32 indexed delegationId)",
];

const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_NAMES = ["Empty", "Locked", "Released", "Refunded"];

const usdcUnits = (n) => ethers.parseUnits(String(n), 6);
const fmtUsdc   = (n) => `${ethers.formatUnits(n, 6)} USDC`;

function sep(title) {
  console.log("\n" + "─".repeat(62));
  console.log(`  ${title}`);
  console.log("─".repeat(62));
}
const ok  = (label, val) => console.log(`  ✓  ${label.padEnd(38)} ${val}`);
const log = (msg)        => console.log(`  →  ${msg}`);

function randomId() {
  return ethers.hexlify(ethers.randomBytes(32));
}

async function ensureApproval(usdcContract, spender, amount, signer) {
  const have = await usdcContract.allowance(signer.address, spender);
  if (have < amount) {
    log(`Approving ${fmtUsdc(amount)} USDC for ${spender}…`);
    const tx = await usdcContract.connect(signer).approve(spender, ethers.MaxUint256);
    await tx.wait();
    ok("approve() tx", tx.hash);
  } else {
    log(`USDC already approved (${fmtUsdc(have)})`);
  }
}

/**
 * Build evaluator signature for HiveBidEscrow._verifyVerdict():
 *   hash    = keccak256(abi.encodePacked(taskId bytes32, pass bool, escrow address))
 *   ethHash = keccak256("\x19Ethereum Signed Message:\n32" + hash)
 */
async function signVerdict(wallet, taskId, pass, escrowAddress) {
  const hash = ethers.solidityPackedKeccak256(
    ["bytes32", "bool", "address"],
    [taskId, pass, escrowAddress]
  );
  return wallet.signMessage(ethers.getBytes(hash));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const provider        = new ethers.JsonRpcProvider(RPC_URL);
  const deployer        = new ethers.Wallet(DEPLOYER_KEY, provider);
  const evaluator       = new ethers.Wallet(EVALUATOR_KEY, provider);
  const workerWallet    = ethers.Wallet.createRandom().connect(provider);
  const agentWallet     = ethers.Wallet.createRandom().connect(provider);

  const { chainId } = await provider.getNetwork();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║          HiveBid Contract Interaction Script             ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\n  RPC      : ${RPC_URL}`);
  console.log(`  Chain ID : ${chainId}`);
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Evaluator: ${evaluator.address}`);
  console.log(`  Worker   : ${workerWallet.address} (ephemeral)`);
  console.log(`  Agent    : ${agentWallet.address}  (ephemeral)`);

  const escrow     = new ethers.Contract(ESCROW_ADDR,     ESCROW_ABI,     deployer);
  const delegation = new ethers.Contract(DELEGATION_ADDR, DELEGATION_ABI, deployer);
  const usdc       = new ethers.Contract(USDC_ADDR,       USDC_ABI,       deployer);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1  HiveBidEscrow — read immutables
  // ══════════════════════════════════════════════════════════════════════════
  sep("HiveBidEscrow — Read Immutables");

  const contractUsdc      = await escrow.usdc();
  const contractEvaluator = await escrow.evaluator();
  const balance           = await usdc.balanceOf(deployer.address);
  const ethBalance        = await provider.getBalance(deployer.address);

  ok("escrow.usdc()",               contractUsdc);
  ok("escrow.evaluator()",          contractEvaluator);
  ok("Deployer USDC balance",       fmtUsdc(balance));
  ok("Deployer ETH balance",        `${ethers.formatEther(ethBalance)} ETH`);

  const evalMatch = evaluator.address.toLowerCase() === contractEvaluator.toLowerCase();
  if (!evalMatch) {
    console.log(`\n  ⚠  Evaluator key mismatch!`);
    console.log(`     Contract evaluator : ${contractEvaluator}`);
    console.log(`     Signing wallet     : ${evaluator.address}`);
    console.log(`     Set EVALUATOR_PRIVATE_KEY to the key for ${contractEvaluator}`);
    console.log(`     release() and refund() will revert with InvalidSignature.\n`);
  } else {
    ok("Evaluator key matches contract ✓", "");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2  HiveBidEscrow — getTask() / tasks() on empty slot
  // ══════════════════════════════════════════════════════════════════════════
  sep("HiveBidEscrow — getTask() + tasks() [view]");

  const zeroId   = ethers.ZeroHash;
  const emptyT   = await escrow.getTask(zeroId);
  const rawT     = await escrow.tasks(zeroId);

  ok("getTask(zeroHash).status",  STATUS_NAMES[emptyT.status]);
  ok("getTask(zeroHash).client",  emptyT.client);
  ok("getTask(zeroHash).amount",  emptyT.amount.toString());
  ok("tasks(zeroHash).worker",    rawT.worker);
  ok("tasks(zeroHash).deadline",  rawT.deadline.toString());

  // ══════════════════════════════════════════════════════════════════════════
  // Guard — skip write calls if no USDC
  // ══════════════════════════════════════════════════════════════════════════
  const LOCK_AMT = usdcUnits(1); // 1 USDC per test
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  if (balance < LOCK_AMT * 4n) {
    console.log(`\n  ⚠  Need at least 4 USDC for write calls. Get test tokens:`);
    console.log(`     https://faucet.circle.com/\n`);
    console.log(`  Skipping write calls — read-only section done.\n`);
    await runDelegationReads(delegation);
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 3  HiveBidEscrow — lock() → release()
  // ══════════════════════════════════════════════════════════════════════════
  sep("HiveBidEscrow — lock() then release()");

  const task1 = randomId();
  await ensureApproval(usdc, ESCROW_ADDR, LOCK_AMT, deployer);

  log(`lock(task1, worker, 1 USDC, +1h)…`);
  const lockTx = await escrow.lock(task1, workerWallet.address, LOCK_AMT, deadline);
  await lockTx.wait();
  ok("lock() tx", lockTx.hash);

  const t1 = await escrow.getTask(task1);
  ok("getTask after lock — status",  STATUS_NAMES[t1.status]);
  ok("getTask — client",             t1.client);
  ok("getTask — worker",             t1.worker);
  ok("getTask — amount",             fmtUsdc(t1.amount));

  log("Signing PASS verdict with evaluator wallet…");
  const passSig = await signVerdict(evaluator, task1, true, ESCROW_ADDR);
  ok("evaluator sig (pass)", passSig.slice(0, 22) + "…");

  log("release(task1, passSig)…");
  const relTx = await escrow.release(task1, passSig);
  await relTx.wait();
  ok("release() tx", relTx.hash);
  ok("getTask after release — status", STATUS_NAMES[(await escrow.getTask(task1)).status]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 4  HiveBidEscrow — lock() → refund()
  // ══════════════════════════════════════════════════════════════════════════
  sep("HiveBidEscrow — lock() then refund()");

  const task2 = randomId();
  await ensureApproval(usdc, ESCROW_ADDR, LOCK_AMT, deployer);

  log("lock(task2, worker, 1 USDC, +1h)…");
  const lock2Tx = await escrow.lock(task2, workerWallet.address, LOCK_AMT, deadline);
  await lock2Tx.wait();
  ok("lock() tx", lock2Tx.hash);

  log("Signing FAIL verdict with evaluator wallet…");
  const failSig = await signVerdict(evaluator, task2, false, ESCROW_ADDR);
  ok("evaluator sig (fail)", failSig.slice(0, 22) + "…");

  log("refund(task2, failSig)…");
  const refTx = await escrow.refund(task2, failSig);
  await refTx.wait();
  ok("refund() tx", refTx.hash);
  ok("getTask after refund — status", STATUS_NAMES[(await escrow.getTask(task2)).status]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 5  HiveBidEscrow — lockFor() → refundExpired()
  //   deadline = 1 (Jan 1 1970) — always in the past on any live network
  // ══════════════════════════════════════════════════════════════════════════
  sep("HiveBidEscrow — lockFor() then refundExpired()");

  const task3 = randomId();
  await ensureApproval(usdc, ESCROW_ADDR, LOCK_AMT, deployer);

  log("lockFor(task3, client=deployer, worker, 1 USDC, deadline=1)…");
  const lockForTx = await escrow.lockFor(
    task3,
    deployer.address,
    workerWallet.address,
    LOCK_AMT,
    1, // deadline already expired
  );
  await lockForTx.wait();
  ok("lockFor() tx", lockForTx.hash);

  const t3 = await escrow.getTask(task3);
  ok("getTask after lockFor — status",   STATUS_NAMES[t3.status]);
  ok("getTask — deadline",               t3.deadline.toString());

  log("refundExpired(task3)… (deadline=1 is always in the past)");
  const expTx = await escrow.refundExpired(task3);
  await expTx.wait();
  ok("refundExpired() tx", expTx.hash);
  ok("getTask after refundExpired — status", STATUS_NAMES[(await escrow.getTask(task3)).status]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 6  HiveBidDelegation — read immutables
  // ══════════════════════════════════════════════════════════════════════════
  sep("HiveBidDelegation — Read Immutables");

  ok("delegation.usdc()",           await delegation.usdc());
  ok("delegation.escrowContract()", await delegation.escrowContract());

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 7  HiveBidDelegation — isValid() + delegations() on empty slot
  // ══════════════════════════════════════════════════════════════════════════
  sep("HiveBidDelegation — isValid() + delegations() [view]");

  ok("isValid(zeroHash)",             await delegation.isValid(zeroId));
  const emptyDel = await delegation.delegations(zeroId);
  ok("delegations(zeroHash).agent",   emptyDel.agent);
  ok("delegations(zeroHash).consumed",emptyDel.consumed);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 8  HiveBidDelegation — createDelegation() → executeEscrowLock()
  // ══════════════════════════════════════════════════════════════════════════
  sep("HiveBidDelegation — createDelegation() then executeEscrowLock()");

  const delId1   = randomId();
  const delTask1 = randomId();
  const delExpiry = Math.floor(Date.now() / 1000) + 3600;
  const delCap    = usdcUnits(5);

  log("createDelegation(id1, agent, taskId, 5 USDC cap, +1h)…");
  const createTx = await delegation.createDelegation(
    delId1, agentWallet.address, delTask1, delCap, delExpiry
  );
  await createTx.wait();
  ok("createDelegation() tx", createTx.hash);

  ok("isValid(delId1) after create",   await delegation.isValid(delId1));
  const d1 = await delegation.delegations(delId1);
  ok("delegations — agent",            d1.agent);
  ok("delegations — maxAmount",        fmtUsdc(d1.maxAmount));
  ok("delegations — expiry",           new Date(Number(d1.expiry) * 1000).toISOString());
  ok("delegations — consumed",         d1.consumed);

  // Approve delegation contract to pull USDC from deployer
  await ensureApproval(usdc, DELEGATION_ADDR, LOCK_AMT, deployer);

  // Fund agent wallet with ETH for gas
  log("Funding agent wallet with 0.001 ETH for gas…");
  const fundTx = await deployer.sendTransaction({
    to: agentWallet.address,
    value: ethers.parseEther("0.001"),
  });
  await fundTx.wait();
  ok("ETH funded to agent", fundTx.hash);

  log("executeEscrowLock(delId1, deployer, worker, 1 USDC, +1h)… [called by agent]");
  const execTx = await delegation.connect(agentWallet).executeEscrowLock(
    delId1,
    deployer.address,       // userWallet that holds USDC
    workerWallet.address,   // worker
    LOCK_AMT,
    deadline,
  );
  await execTx.wait();
  ok("executeEscrowLock() tx", execTx.hash);

  const d1After = await delegation.delegations(delId1);
  ok("delegations — consumed after exec", d1After.consumed);
  ok("isValid(delId1) after exec",        await delegation.isValid(delId1));

  // Verify escrow received the lock
  const delegatedTask = await escrow.getTask(delTask1);
  ok("escrow.getTask(delTask1) — status", STATUS_NAMES[delegatedTask.status]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 9  HiveBidDelegation — createDelegation() → revoke()
  // ══════════════════════════════════════════════════════════════════════════
  sep("HiveBidDelegation — createDelegation() then revoke()");

  const delId2   = randomId();
  const delTask2 = randomId();

  log("createDelegation(id2, agent, taskId2, 5 USDC, +1h)…");
  const create2Tx = await delegation.createDelegation(
    delId2, agentWallet.address, delTask2, delCap, delExpiry
  );
  await create2Tx.wait();
  ok("createDelegation() tx", create2Tx.hash);
  ok("isValid(delId2) before revoke", await delegation.isValid(delId2));

  log("revoke(delId2)…");
  const revokeTx = await delegation.revoke(delId2);
  await revokeTx.wait();
  ok("revoke() tx", revokeTx.hash);
  ok("isValid(delId2) after revoke",  await delegation.isValid(delId2));

  const d2 = await delegation.delegations(delId2);
  ok("delegations — consumed after revoke", d2.consumed);

  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(62));
  console.log("  All functions called successfully!");
  console.log(`  View on Basescan: https://sepolia.basescan.org/address/${ESCROW_ADDR}`);
  console.log("═".repeat(62) + "\n");
}

async function runDelegationReads(delegation) {
  sep("HiveBidDelegation — Read Immutables");
  ok("delegation.usdc()",           await delegation.usdc());
  ok("delegation.escrowContract()", await delegation.escrowContract());
  ok("isValid(zeroHash)",           await delegation.isValid(ethers.ZeroHash));
}

main().catch((e) => { console.error("\n  ✗ Error:", e.shortMessage || e.message); process.exit(1); });
