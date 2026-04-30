/**
 * HiveBid escrow actions via KeeperHub.
 * Person A's client agent imports these and calls them after auction events.
 *
 * Required env vars:
 *   KH_API_KEY          — KeeperHub org API key (kh_ prefix)
 *   ESCROW_ADDRESS      — deployed HiveBidEscrow contract address
 *   KH_NETWORK          — KeeperHub network name (check GET /api/chains for exact slug)
 */

import { contractCall } from "./client.js";
import ESCROW_ABI from "./abi/HiveBidEscrow.json" assert { type: "json" };

const network = process.env.KH_NETWORK || "Base Sepolia";
const contractAddress = process.env.ESCROW_ADDRESS;

if (!contractAddress) throw new Error("ESCROW_ADDRESS not set");

/**
 * Lock USDC into escrow after auction closes and bid is accepted.
 *
 * @param {object} params
 * @param {string} params.taskId     - bytes32 hex task ID (0x prefixed)
 * @param {string} params.clientAddr - user's wallet address (for refund path)
 * @param {string} params.workerAddr - winning worker's wallet address
 * @param {string} params.amountUsdc - amount in USDC with 6 decimals, e.g. "25000000" for $25
 * @param {number} params.deadline   - unix timestamp of task deadline
 * @returns {{ executionId, txHash, txLink }}
 */
export async function lockEscrow({ taskId, clientAddr, workerAddr, amountUsdc, deadline }) {
  return contractCall({
    network,
    contractAddress,
    functionName: "lockFor",
    functionArgs: [taskId, clientAddr, workerAddr, amountUsdc, deadline.toString()],
    abi: ESCROW_ABI,
  });
}

/**
 * Release escrowed USDC to the worker after evaluator passes delivery.
 *
 * @param {object} params
 * @param {string} params.taskId       - bytes32 hex task ID
 * @param {string} params.evaluatorSig - evaluator's signature (hex, 0x prefixed)
 * @returns {{ executionId, txHash, txLink }}
 */
export async function releaseEscrow({ taskId, evaluatorSig }) {
  return contractCall({
    network,
    contractAddress,
    functionName: "release",
    functionArgs: [taskId, evaluatorSig],
    abi: ESCROW_ABI,
  });
}

/**
 * Refund escrowed USDC to the client after evaluator fails delivery.
 *
 * @param {object} params
 * @param {string} params.taskId       - bytes32 hex task ID
 * @param {string} params.evaluatorSig - evaluator's signature (hex, 0x prefixed)
 * @returns {{ executionId, txHash, txLink }}
 */
export async function refundEscrow({ taskId, evaluatorSig }) {
  return contractCall({
    network,
    contractAddress,
    functionName: "refund",
    functionArgs: [taskId, evaluatorSig],
    abi: ESCROW_ABI,
  });
}

/**
 * Emergency refund after deadline passes with no verdict.
 * No evaluator signature required.
 *
 * @param {string} taskId
 * @returns {{ executionId, txHash, txLink }}
 */
export async function refundExpired(taskId) {
  return contractCall({
    network,
    contractAddress,
    functionName: "refundExpired",
    functionArgs: [taskId],
    abi: ESCROW_ABI,
  });
}
