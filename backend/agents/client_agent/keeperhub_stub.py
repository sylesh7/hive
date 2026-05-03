"""
KeeperHub integration for HiveBid escrow operations.

All contract writes (lock, release, refund) go through KeeperHub's
Direct Execution API so retry logic, gas management, and audit trails
are handled externally.

USDC approval (one-time per session) is done directly from the client
wallet via web3.py, since KeeperHub's managed wallet only submits the
lockFor call — it does not need to hold USDC after the contract fix.

Required backend/.env:
  KH_API_KEY              — KeeperHub API key (kh_ prefix)
  KH_NETWORK              — "Base Sepolia"
  KH_WALLET_ADDRESS       — KeeperHub's managed wallet (caller of lockFor)
  ESCROW_ADDRESS          — deployed HiveBidEscrow address
  CLIENT_WALLET_PRIVATE_KEY — client wallet that holds USDC
  USDC_ADDRESS            — USDC token on Base Sepolia
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from functools import lru_cache
from pathlib import Path

import httpx
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger(__name__)

KH_BASE_URL        = "https://app.keeperhub.com/api"
KH_API_KEY         = os.getenv("KH_API_KEY", "").strip().strip('"')
KH_NETWORK         = os.getenv("KH_NETWORK", "Base Sepolia")
KH_WALLET_ADDRESS  = os.getenv("KH_WALLET_ADDRESS", "")
ESCROW_ADDRESS     = os.getenv("ESCROW_ADDRESS", "")
CLIENT_PRIVATE_KEY = os.getenv("CLIENT_WALLET_PRIVATE_KEY", "")
USDC_ADDRESS       = os.getenv("USDC_ADDRESS", "0x036CbD53842c5426634e7929541eC2318f3dCF7e")
RPC_URL            = os.getenv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org")
CHAIN_ID           = 84532

POLL_INTERVAL = 2.0
POLL_TIMEOUT  = 120.0

_ABI_PATH = (
    Path(__file__).resolve().parents[3]
    / "contracts" / "artifacts" / "src" / "HiveBidEscrow.sol" / "HiveBidEscrow.json"
)

_USDC_ABI = [
    {
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount",  "type": "uint256"},
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "owner",   "type": "address"},
            {"name": "spender", "type": "address"},
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


@lru_cache(maxsize=1)
def _escrow_abi() -> list:
    data = json.loads(_ABI_PATH.read_text())
    return data["abi"]


# ── KeeperHub helpers ─────────────────────────────────────────────────────────

def _headers() -> dict:
    if not KH_API_KEY:
        raise RuntimeError("KH_API_KEY not set in backend/.env")
    return {
        "Content-Type":  "application/json",
        "Authorization": f"Bearer {KH_API_KEY}",
    }


async def _kh_call(function_name: str, function_args: list) -> str:
    """POST to KeeperHub /execute/contract-call and poll until confirmed."""
    if not ESCROW_ADDRESS:
        raise RuntimeError(
            "ESCROW_ADDRESS not set. Run: python backend/deploy_contract.py"
        )

    payload = {
        "network":         KH_NETWORK,
        "contractAddress": ESCROW_ADDRESS,
        "functionName":    function_name,
        "functionArgs":    json.dumps(function_args),
        "abi":             json.dumps(_escrow_abi()),
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{KH_BASE_URL}/execute/contract-call",
            headers=_headers(),
            json=payload,
        )
        body = resp.json()
        if not resp.is_success:
            raise RuntimeError(f"KeeperHub API error {resp.status_code}: {body}")

        if "result" in body:
            return body["result"]

        execution_id = body.get("executionId") or body.get("id")
        if not execution_id:
            raise RuntimeError(f"KeeperHub returned no executionId: {body}")

        return await _kh_poll(client, execution_id)


async def _kh_poll(client: httpx.AsyncClient, execution_id: str) -> str:
    """Poll until KeeperHub confirms the transaction. Returns tx hash."""
    deadline = asyncio.get_event_loop().time() + POLL_TIMEOUT
    while asyncio.get_event_loop().time() < deadline:
        await asyncio.sleep(POLL_INTERVAL)
        resp = await client.get(
            f"{KH_BASE_URL}/execute/{execution_id}/status",
            headers=_headers(),
        )
        body   = resp.json()
        status = body.get("status", "")
        if status == "completed":
            tx = body.get("transactionHash") or body.get("txHash", "")
            logger.info(f"[KeeperHub] confirmed tx: {tx}")
            return tx
        if status == "failed":
            raise RuntimeError(f"KeeperHub execution failed: {body.get('error')}")
    raise RuntimeError(f"KeeperHub timed out (executionId={execution_id})")


# ── USDC helpers (direct web3, no KeeperHub) ──────────────────────────────────

def _to_bytes32(task_id: str) -> str:
    """UUID string → 0x-prefixed 32-byte hex (for contract call args)."""
    clean  = task_id.replace("-", "")
    padded = clean.ljust(64, "0")[:64]
    return "0x" + padded


def _usdc_units(amount_usdc: float) -> int:
    return int(round(amount_usdc * 1_000_000))


def _ensure_usdc_approval(amount_usdc: float) -> None:
    """
    Approve the escrow contract to spend USDC from the client wallet.
    Uses direct web3.py — runs synchronously in a thread executor.
    Only submits a transaction when the current allowance is insufficient.
    """
    w3          = Web3(Web3.HTTPProvider(RPC_URL))
    account     = Account.from_key(CLIENT_PRIVATE_KEY)
    escrow_addr = Web3.to_checksum_address(ESCROW_ADDRESS)
    usdc_addr   = Web3.to_checksum_address(USDC_ADDRESS)
    amount      = _usdc_units(amount_usdc)

    usdc      = w3.eth.contract(address=usdc_addr, abi=_USDC_ABI)
    allowance = usdc.functions.allowance(account.address, escrow_addr).call()
    if allowance >= amount:
        logger.info(f"[USDC] Allowance sufficient ({allowance / 1e6:.2f} USDC) — skipping approve")
        return

    logger.info(f"[USDC] Approving escrow to spend USDC from client wallet…")
    balance = usdc.functions.balanceOf(account.address).call()
    if balance < amount:
        raise RuntimeError(
            f"Insufficient USDC: wallet has {balance / 1e6:.2f}, need {amount_usdc:.2f}. "
            "Get test USDC at https://faucet.circle.com/"
        )

    nonce = w3.eth.get_transaction_count(account.address, "pending")
    txn   = usdc.functions.approve(escrow_addr, 2 ** 256 - 1).build_transaction({
        "from":     account.address,
        "nonce":    nonce,
        "gas":      80_000,
        "gasPrice": w3.eth.gas_price,
        "chainId":  CHAIN_ID,
    })
    signed  = account.sign_transaction(txn)
    raw     = getattr(signed, "raw_transaction", None) or signed.rawTransaction
    tx_hash = w3.eth.send_raw_transaction(raw)
    logger.info(f"[USDC] Approve tx: {tx_hash.hex()}")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    if receipt.status != 1:
        raise RuntimeError(f"USDC approve reverted: {tx_hash.hex()}")
    logger.info(f"[USDC] Approved — block {receipt.blockNumber}")


# ── Public async API ──────────────────────────────────────────────────────────

async def lock_escrow(
    task_id: str,
    amount_usdc: float,
    worker_wallet: str,
    deadline: int | None = None,
) -> str:
    """
    1. Approve escrow to spend USDC from client wallet (direct web3, idempotent).
    2. KeeperHub calls lockFor(taskId, clientAddr, workerAddr, amount, deadline).
    Returns the KeeperHub-confirmed on-chain transaction hash.
    """
    if not ESCROW_ADDRESS:
        raise RuntimeError(
            "ESCROW_ADDRESS not set. Run: python backend/deploy_contract.py"
        )

    if deadline is None:
        deadline = int(time.time()) + 86_400

    client_addr = Account.from_key(CLIENT_PRIVATE_KEY).address

    # Step 1: ensure USDC approval (sync, in thread)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _ensure_usdc_approval, amount_usdc)

    # Step 2: KeeperHub submits lockFor()
    logger.info(f"[KeeperHub] lock_escrow task={task_id[:8]}… amount={amount_usdc} USDC")
    tx_hash = await _kh_call(
        "lockFor",
        [
            _to_bytes32(task_id),
            client_addr,
            Web3.to_checksum_address(worker_wallet),
            str(_usdc_units(amount_usdc)),
            str(deadline),
        ],
    )
    logger.info(f"[KeeperHub] escrow locked — tx: {tx_hash}")
    return tx_hash


async def release_payment(
    task_id: str,
    worker_wallet: str,
    amount_usdc: float,
    evaluator_sig: str,
) -> str:
    """
    KeeperHub calls release(taskId, evaluatorSig).
    evaluator_sig must be a real 65-byte ECDSA hex from the evaluator agent.
    """
    if not evaluator_sig:
        raise RuntimeError(
            "evaluator_sig is required — evaluator must sign the verdict with its Ethereum key"
        )
    logger.info(f"[KeeperHub] release_payment task={task_id[:8]}… → {worker_wallet}")
    tx_hash = await _kh_call(
        "release",
        [_to_bytes32(task_id), evaluator_sig],
    )
    logger.info(f"[KeeperHub] payment released — tx: {tx_hash}")
    return tx_hash


async def refund(
    task_id: str,
    user_wallet: str,
    amount_usdc: float,
    evaluator_sig: str,
) -> str:
    """
    KeeperHub calls refund(taskId, evaluatorSig).
    evaluator_sig must be a real 65-byte ECDSA hex from the evaluator agent.
    """
    if not evaluator_sig:
        raise RuntimeError(
            "evaluator_sig is required — evaluator must sign the verdict with its Ethereum key"
        )
    logger.info(f"[KeeperHub] refund task={task_id[:8]}…")
    tx_hash = await _kh_call(
        "refund",
        [_to_bytes32(task_id), evaluator_sig],
    )
    logger.info(f"[KeeperHub] refund complete — tx: {tx_hash}")
    return tx_hash
