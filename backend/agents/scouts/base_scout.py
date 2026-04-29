"""
Base scout agent — subscribe to bid stream, rank bids, push recommendation.
"""
from __future__ import annotations
import asyncio
import logging
import sys
from abc import ABC, abstractmethod
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from agents.shared.config import AXL_PORTS, axl_base_url, axl_key_path
from agents.shared.axl_client import AXLClient
from agents.shared.message_types import (
    BidForward, ScoutRecommendation, parse_message
)
from agents.shared.crypto import load_private_key, sign_message

logger = logging.getLogger(__name__)


class BaseScout(ABC):
    """
    Abstract base for all scout agents.

    Subclasses implement:
      - strategy_name  (str property)
      - rank_bids(bids, task_spec) -> list[dict]   sorted best → worst
    """

    def __init__(self, agent_name: str):
        self.agent_name   = agent_name
        self.axl          = AXLClient(axl_base_url(agent_name), agent_name=agent_name)
        self._private_key = load_private_key(axl_key_path(agent_name))
        self._stop        = asyncio.Event()
        self._self_peer_id = ""
        # task_id → list of bid dicts accumulated so far
        self._bids: dict[str, list[dict]] = {}
        # task_id → task spec
        self._specs: dict[str, dict] = {}

    @property
    @abstractmethod
    def strategy_name(self) -> str: ...

    @abstractmethod
    def rank_bids(self, bids: list[dict], task_spec: dict) -> list[dict]:
        """Return bids sorted from best to worst according to this strategy."""
        ...

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def start(self):
        async with self.axl:
            logger.info(f"[{self.agent_name}] waiting for AXL…")
            await self.axl.wait_ready()
            self._self_peer_id = await self.axl.get_self_peer_id()
            logger.info(f"[{self.agent_name}] ready — peer={self._self_peer_id[:8]}…")
            await self.axl.recv_loop(self._on_message, stop_event=self._stop)

    # ── Message handling ──────────────────────────────────────────────────────

    async def _on_message(self, sender_peer_id: str, raw: dict):
        msg_type = raw.get("type", "")
        if msg_type == "BID_FORWARD":
            await self._handle_bid_forward(sender_peer_id, raw)

    async def _handle_bid_forward(self, sender_peer_id: str, raw: dict):
        task_id   = raw.get("task_id", "")
        bid       = raw.get("bid", {})
        task_spec = raw.get("task_spec", {})

        if not task_id or not bid:
            return

        # Store spec and deduplicate bids by worker
        self._specs[task_id] = task_spec
        bids_for_task = self._bids.setdefault(task_id, [])
        worker_id = bid.get("worker_peer_id", "")
        bids_for_task[:] = [b for b in bids_for_task if b.get("worker_peer_id") != worker_id]
        bids_for_task.append(bid)

        ranked = self.rank_bids(list(bids_for_task), task_spec)
        if not ranked:
            return

        top_bid = ranked[0]
        reason  = self._explain(top_bid, ranked, task_spec)

        rec = ScoutRecommendation(
            task_id=task_id,
            strategy=self.strategy_name,
            top_bid=top_bid,
            ranked_bids=ranked[:5],   # top 5
            reason=reason,
            scout_peer_id=self._self_peer_id,
        )

        # Reply directly to client agent
        await self.axl.send(sender_peer_id, rec.to_dict())
        logger.info(
            f"[{self.agent_name}] → {self.strategy_name} top: "
            f"{top_bid.get('worker_name')} @ {top_bid.get('bid_price_usdc')} USDC"
        )

    @abstractmethod
    def _explain(self, top_bid: dict, ranked: list[dict], task_spec: dict) -> str:
        """Return a human-readable reason for this recommendation."""
        ...
