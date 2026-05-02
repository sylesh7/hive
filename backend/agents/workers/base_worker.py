"""
Base worker agent — listens for task announcements, bids, performs work via Groq, delivers.
"""
from __future__ import annotations
import asyncio
import hashlib
import logging
import random
import sys
import time
from abc import ABC, abstractmethod
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from groq import AsyncGroq

from agents.shared.config import axl_base_url, axl_key_path, GROQ_API_KEY, GROQ_MODEL
from agents.shared.axl_client import AXLClient
from agents.shared.message_types import (
    TaskAnnouncement, Bid, BidAccepted, BidRejected,
    WorkerStatus, Delivery, parse_message,
)
from agents.shared.crypto import load_private_key, sign_message, sha256_hex, get_public_key_hex
from agents.shared.erc8004 import ERC8004Client
from agents.shared.config import CLIENT_WALLET_PRIVATE_KEY

logger = logging.getLogger(__name__)


class BaseWorker(ABC):
    """
    Abstract base for all worker agents.

    Subclasses implement:
      - worker_name         (str)
      - capabilities        (list[str])
      - reputation_score    (float, self-reported)
      - wallet_address      (str)
      - nft_token_id        (str)
      - base_delivery_secs  (int) — base delivery time before LLM
      - bid_strategy(max_budget) → float  — compute bid price
      - build_prompt(task_spec)  → str    — LLM prompt for this worker
      - should_bid(task)         → bool   — accept/reject task
    """

    def __init__(self, agent_name: str):
        self.agent_name    = agent_name
        self.axl           = AXLClient(axl_base_url(agent_name), agent_name=agent_name)
        self._private_key  = load_private_key(axl_key_path(agent_name))
        self._public_key_hex = get_public_key_hex(self._private_key)
        self._groq         = AsyncGroq(api_key=GROQ_API_KEY)
        self._stop         = asyncio.Event()
        self._self_peer_id = ""
        # task_id → accepted task spec
        self._active_tasks: dict[str, dict] = {}

    # ── Abstract interface ────────────────────────────────────────────────────

    @property
    @abstractmethod
    def worker_name(self) -> str: ...

    @property
    @abstractmethod
    def capabilities(self) -> list[str]: ...

    @property
    @abstractmethod
    def reputation_score(self) -> float: ...

    @property
    @abstractmethod
    def wallet_address(self) -> str: ...

    @property
    @abstractmethod
    def nft_token_id(self) -> str: ...

    @property
    @abstractmethod
    def base_delivery_secs(self) -> int: ...

    @abstractmethod
    def bid_strategy(self, max_budget: float) -> float:
        """Return the bid price given the task's max budget."""
        ...

    @abstractmethod
    def build_prompt(self, task_spec: dict) -> str:
        """Build the LLM prompt for this task."""
        ...

    def should_bid(self, task: dict) -> bool:
        """Return True if this worker should bid on the task."""
        task_type = task.get("task_type", "other")
        return task_type in self.capabilities or "other" in self.capabilities

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def start(self):
        async with self.axl:
            logger.info(f"[{self.agent_name}] waiting for AXL…")
            await self.axl.wait_ready()
            self._self_peer_id = await self.axl.get_self_peer_id()
            logger.info(f"[{self.agent_name}] ready — {self.worker_name} @ peer={self._self_peer_id[:8]}…")

            # ── Announce ourselves to the client agent ──────────────────────────
            # The client needs to map agent_name → peer_id to build its PEER_REGISTRY.
            # Retry a few times in case the client hasn't started yet.
            await self._announce_hello()

            await self.axl.recv_loop(self._on_message, stop_event=self._stop)

    async def _announce_hello(self):
        """Send HELLO to client so it can register our peer_id in PEER_REGISTRY."""
        from agents.shared.config import AXL_PORTS
        import httpx as _httpx

        client_api = f"http://127.0.0.1:{AXL_PORTS['client']['api_port']}"
        hello = {
            "type":       "HELLO",
            "agent_name": self.agent_name,
            "worker_name": self.worker_name,
            "peer_id":    self._self_peer_id,
            "capabilities": self.capabilities,
            "wallet_address": self.wallet_address,
        }

        # Get client's peer_id from its AXL topology
        for attempt in range(10):
            try:
                async with _httpx.AsyncClient(timeout=3.0) as http:
                    resp = await http.get(f"{client_api}/topology")
                    if resp.status_code == 200:
                        client_peer_id = resp.json().get("our_public_key", "")
                        if client_peer_id:
                            await self.axl.send(client_peer_id, hello)
                            logger.info(f"[{self.agent_name}] HELLO sent to client ({client_peer_id[:8]}…)")
                            return
            except Exception as e:
                logger.debug(f"[{self.agent_name}] HELLO attempt {attempt+1} failed: {e}")
            await asyncio.sleep(2)

        logger.warning(f"[{self.agent_name}] could not send HELLO to client after 10 attempts")


    # ── Message routing ───────────────────────────────────────────────────────

    async def _on_message(self, sender_peer_id: str, raw: dict):
        msg_type = raw.get("type", "")
        if msg_type == "TASK_ANNOUNCEMENT":
            await self._handle_announcement(sender_peer_id, raw)
        elif msg_type == "BID_ACCEPTED":
            await self._handle_accepted(sender_peer_id, raw)
        elif msg_type == "BID_REJECTED":
            logger.info(f"[{self.agent_name}] bid rejected for task {raw.get('task_id','?')}")

    # ── Bidding ───────────────────────────────────────────────────────────────

    async def _handle_announcement(self, client_peer_id: str, raw: dict):
        task_id = raw.get("task_id", "")
        if not self.should_bid(raw):
            logger.debug(f"[{self.agent_name}] skipping task {task_id} — not in capabilities")
            return

        max_budget = float(raw.get("max_budget_usdc", 0))
        if max_budget <= 0:
            return

        # Slight random delay so workers don't all bid at once (realistic)
        await asyncio.sleep(random.uniform(0.5, 3.0))

        bid_price = self.bid_strategy(max_budget)
        delivery_time = self.base_delivery_secs + random.randint(-30, 60)

        bid = Bid(
            task_id=task_id,
            bid_price_usdc=round(bid_price, 2),
            delivery_time_secs=delivery_time,
            worker_peer_id=self._self_peer_id,
            worker_identity_nft_id=self.nft_token_id,
            worker_wallet=self.wallet_address,
            worker_name=self.worker_name,
            worker_reputation_score=self.reputation_score,
            capabilities=self.capabilities,
        )

        # Sign the bid
        payload_to_sign = {
            "task_id": task_id,
            "bid_price_usdc": bid.bid_price_usdc,
            "worker_peer_id": self._self_peer_id,
        }
        bid.signature = sign_message(self._private_key, payload_to_sign)

        logger.info(
            f"[{self.agent_name}] bidding {bid.bid_price_usdc} USDC "
            f"on task {task_id[:8]}… (delivery: {delivery_time}s)"
        )
        await self.axl.send(client_peer_id, bid.to_dict())

        # Schedule an aggressive re-bid after a short window
        asyncio.create_task(
            self._rebid_loop(task_id, client_peer_id, bid_price, max_budget, raw)
        )

    async def _rebid_loop(
        self,
        task_id: str,
        client_peer_id: str,
        initial_price: float,
        max_budget: float,
        raw: dict,
    ):
        """Re-bid up to 2 times at lower prices to simulate competition."""
        for i in range(2):
            await asyncio.sleep(random.uniform(8, 20))

            if task_id in self._active_tasks:
                # Already accepted — stop bidding
                break

            # Lower bid by 5–15%
            discount = random.uniform(0.05, 0.15)
            new_price = max(1.0, initial_price * (1 - discount * (i + 1)))
            new_price = round(new_price, 2)

            bid = Bid(
                task_id=task_id,
                bid_price_usdc=new_price,
                delivery_time_secs=self.base_delivery_secs,
                worker_peer_id=self._self_peer_id,
                worker_identity_nft_id=self.nft_token_id,
                worker_wallet=self.wallet_address,
                worker_name=self.worker_name,
                worker_reputation_score=self.reputation_score,
                capabilities=self.capabilities,
            )
            payload = {"task_id": task_id, "bid_price_usdc": new_price, "worker_peer_id": self._self_peer_id}
            bid.signature = sign_message(self._private_key, payload)

            logger.info(f"[{self.agent_name}] re-bid: {new_price} USDC on {task_id[:8]}…")
            await self.axl.send(client_peer_id, bid.to_dict())

    # ── Work execution ────────────────────────────────────────────────────────

    async def _handle_accepted(self, client_peer_id: str, raw: dict):
        task_id = raw.get("task_id", "")
        agreed_price = raw.get("agreed_price_usdc", 0)
        logger.info(f"[{self.agent_name}] BID ACCEPTED — task={task_id} price={agreed_price} USDC")

        self._active_tasks[task_id] = raw

        # Send started status
        await self._send_status(client_peer_id, task_id, "started", 0, "Starting work…")

        try:
            deliverable = await self._do_work(client_peer_id, task_id)
        except Exception as e:
            logger.error(f"[{self.agent_name}] work failed for {task_id}: {e}", exc_info=True)
            await self._send_status(client_peer_id, task_id, "failed", 0, f"Error: {e}")
            return

        # Submit delivery
        content_hash = sha256_hex(deliverable)
        delivery = Delivery(
            task_id=task_id,
            deliverable_ref=f"ipfs://QmHiveBid{content_hash[:32]}",
            deliverable_hash=f"sha256:{content_hash}",
            deliverable_content=deliverable,
            worker_peer_id=self._self_peer_id,
        )
        payload = {"task_id": task_id, "deliverable_hash": delivery.deliverable_hash, "worker_peer_id": self._self_peer_id}
        delivery.signature = sign_message(self._private_key, payload)

        logger.info(f"[{self.agent_name}] submitting delivery for task {task_id[:8]}…")
        await self.axl.send(client_peer_id, delivery.to_dict())
        await self._send_status(client_peer_id, task_id, "completed", 100, "Delivery submitted.")

        del self._active_tasks[task_id]

    async def _do_work(self, client_peer_id: str, task_id: str) -> str:
        """
        Call Groq LLM to perform the actual task.
        Sends incremental WORKER_STATUS updates.
        Returns the deliverable content as a string.
        """
        # Get task spec from our local cache or from the accepted message
        accepted = self._active_tasks.get(task_id, {})
        task_spec = accepted.get("task_spec", {})

        prompt = self.build_prompt(task_spec or accepted)
        logger.info(f"[{self.agent_name}] calling Groq ({GROQ_MODEL})…")

        await self._send_status(client_peer_id, task_id, "in_progress", 25, "Analyzing task requirements…")

        # Groq streaming for realistic progress updates
        chunks = []
        stream = await self._groq.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are {self.worker_name}, a professional AI agent specializing in "
                        f"{', '.join(self.capabilities)}. Deliver high-quality, structured work. "
                        "Be thorough and professional."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            stream=True,
            max_tokens=2048,
            temperature=0.7,
        )

        await self._send_status(client_peer_id, task_id, "in_progress", 50, "Generating deliverable…")

        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                chunks.append(delta)

        await self._send_status(client_peer_id, task_id, "in_progress", 90, "Finalizing output…")
        await asyncio.sleep(1.0)   # brief pause for realism

        return "".join(chunks)

    async def _send_status(
        self,
        client_peer_id: str,
        task_id: str,
        status: str,
        progress: int,
        message: str,
    ):
        msg = WorkerStatus(
            task_id=task_id,
            status=status,
            progress_pct=progress,
            message=f"{self.worker_name}: {message}",
            worker_peer_id=self._self_peer_id,
        )
        await self.axl.send(client_peer_id, msg.to_dict())
        logger.debug(f"[{self.agent_name}] status: {status} {progress}% — {message}")
