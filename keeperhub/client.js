/**
 * KeeperHub Direct Execution API client.
 * Wraps contract-call submissions and polls for completion.
 */

const BASE_URL = "https://app.keeperhub.com/api";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

function headers() {
  const key = process.env.KH_API_KEY;
  if (!key) throw new Error("KH_API_KEY not set");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

/**
 * Call a smart contract function via KeeperHub.
 * For read functions returns the result immediately.
 * For write functions polls until confirmed and returns { executionId, txHash, txLink }.
 */
export async function contractCall({ network, contractAddress, functionName, functionArgs = [], abi }) {
  const res = await fetch(`${BASE_URL}/execute/contract-call`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      network,
      contractAddress,
      functionName,
      functionArgs: JSON.stringify(functionArgs),
      abi: JSON.stringify(abi),
    }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`KeeperHub error: ${JSON.stringify(body)}`);

  // Read functions return result immediately
  if (body.result !== undefined) return { result: body.result };

  // Write functions return executionId — poll for completion
  return poll(body.executionId);
}

async function poll(executionId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const res = await fetch(`${BASE_URL}/execute/${executionId}/status`, {
      headers: headers(),
    });
    const body = await res.json();

    if (body.status === "completed") {
      return {
        executionId,
        txHash: body.transactionHash,
        txLink: body.transactionLink,
      };
    }

    if (body.status === "failed") {
      throw new Error(`KeeperHub execution failed: ${JSON.stringify(body.error)}`);
    }
    // pending / running → keep polling
  }

  throw new Error(`KeeperHub execution timed out (id: ${executionId})`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
