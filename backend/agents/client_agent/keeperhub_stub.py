"""
KeeperHub stub — placeholder for Person B's real MCP integration.

Person B replaces these implementations with actual KeeperHub MCP calls.
All functions return fake tx hashes so the rest of the system works end-to-end.
"""
from __future__ import annotations
import asyncio
import logging
import time
import hashlib

logger = logging.getLogger(__name__)


def _fake_tx(label: str, task_id: str) -> str:
    """Generate a deterministic fake tx hash for demo purposes."""
    raw = f"{label}:{task_id}:{time.time()}".encode()
    return "0x" + hashlib.sha256(raw).hexdigest()


async def lock_escrow(
    task_id: str,
    amount_usdc: float,
    worker_wallet: str,
    delegation_sig: str = "",
) -> str:
    """
    Lock `amount_usdc` USDC into escrow for `task_id`.
    Returns the escrow lock transaction hash.

    STUB: Simulates a 2-second chain confirmation delay.
    Person B: replace with KeeperHub MCP call:
        mcp.call("keeperhub", "lock_escrow", {...})
    """
    logger.info(f"[KeeperHub STUB] lock_escrow task={task_id} amount={amount_usdc} USDC → {worker_wallet}")
    await asyncio.sleep(2.0)   # simulate confirmation
    tx_hash = _fake_tx("lock", task_id)
    logger.info(f"[KeeperHub STUB] escrow locked — tx: {tx_hash}")
    return tx_hash


async def release_payment(
    task_id: str,
    worker_wallet: str,
    amount_usdc: float,
) -> str:
    """
    Release escrowed USDC to the worker.
    Returns the release transaction hash.

    STUB: Simulates a 2-second confirmation.
    """
    logger.info(f"[KeeperHub STUB] release_payment task={task_id} → {worker_wallet} ({amount_usdc} USDC)")
    await asyncio.sleep(2.0)
    tx_hash = _fake_tx("release", task_id)
    logger.info(f"[KeeperHub STUB] payment released — tx: {tx_hash}")
    return tx_hash


async def refund(
    task_id: str,
    user_wallet: str,
    amount_usdc: float,
) -> str:
    """
    Refund escrowed USDC back to the user.
    Returns the refund transaction hash.

    STUB: Simulates a 2-second confirmation.
    """
    logger.info(f"[KeeperHub STUB] refund task={task_id} → {user_wallet} ({amount_usdc} USDC)")
    await asyncio.sleep(2.0)
    tx_hash = _fake_tx("refund", task_id)
    logger.info(f"[KeeperHub STUB] refund complete — tx: {tx_hash}")
    return tx_hash
