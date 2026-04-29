"""
Auction manager — collects bids, manages countdown timer, selects winner.
"""
from __future__ import annotations
import asyncio
import logging
import time
from typing import Callable, Awaitable

from ..shared.message_types import Bid
from ..shared.config import DEFAULT_AUCTION_WINDOW_SECS

logger = logging.getLogger(__name__)


class AuctionManager:
    """
    Manages a single live auction for one task.

    Lifecycle:
      open() → [bids arrive via add_bid()] → auto-close on timer OR manual close()
    """

    def __init__(
        self,
        task_id: str,
        window_secs: int = DEFAULT_AUCTION_WINDOW_SECS,
        on_close: Callable[[str, dict | None], Awaitable[None]] | None = None,
    ):
        self.task_id = task_id
        self.window_secs = window_secs
        self.on_close = on_close   # callback(task_id, winning_bid_dict | None)

        self._bids: dict[str, dict] = {}   # worker_peer_id → latest bid
        self._start_time: float = 0.0
        self._end_time:   float = 0.0
        self._closed: bool = False
        self._timer_task: asyncio.Task | None = None
        self._scout_recommendations: dict[str, dict] = {}   # strategy → bid

    # ── Control ───────────────────────────────────────────────────────────────

    def open(self) -> float:
        """Start the auction countdown. Returns the closing timestamp."""
        self._start_time = time.time()
        self._end_time   = self._start_time + self.window_secs
        self._closed     = False
        self._timer_task = asyncio.create_task(self._countdown())
        logger.info(f"[Auction:{self.task_id}] opened — {self.window_secs}s window")
        return self._end_time

    async def close(self, winning_bid: dict | None = None) -> dict | None:
        """
        Close the auction immediately.

        Args:
            winning_bid: the bid to accept; if None, picks best from scout recommendations
                         falling back to lowest price.
        Returns:
            The winning bid dict, or None if no bids.
        """
        if self._closed:
            return None
        self._closed = True

        if self._timer_task and not self._timer_task.done():
            self._timer_task.cancel()

        if winning_bid is None:
            winning_bid = self._select_winner()

        logger.info(
            f"[Auction:{self.task_id}] closed — winner: "
            f"{winning_bid.get('worker_name','?') if winning_bid else 'none'}"
        )

        if self.on_close:
            await self.on_close(self.task_id, winning_bid)

        return winning_bid

    async def _countdown(self):
        """Auto-close after window expires."""
        remaining = self._end_time - time.time()
        if remaining > 0:
            await asyncio.sleep(remaining)
        if not self._closed:
            await self.close()

    # ── Bids ──────────────────────────────────────────────────────────────────

    def add_bid(self, bid: dict) -> bool:
        """
        Register an incoming bid. Re-bids from the same worker replace their old bid.
        Returns False if auction is closed.
        """
        if self._closed:
            return False
        worker_id = bid.get("worker_peer_id", "")
        self._bids[worker_id] = bid
        logger.debug(
            f"[Auction:{self.task_id}] bid from {bid.get('worker_name','?')}: "
            f"{bid.get('bid_price_usdc')} USDC"
        )
        return True

    def all_bids(self) -> list[dict]:
        return list(self._bids.values())

    def set_scout_recommendation(self, strategy: str, bid: dict):
        self._scout_recommendations[strategy] = bid

    def get_recommendations(self) -> dict[str, dict]:
        return dict(self._scout_recommendations)

    # ── Selection ─────────────────────────────────────────────────────────────

    def _select_winner(self) -> dict | None:
        """
        Select winner from scout recommendations or fallback to lowest bid.
        Priority: cost scout → quality scout → speed scout → raw lowest price.
        """
        for strategy in ("cost", "quality", "speed"):
            rec = self._scout_recommendations.get(strategy)
            if rec:
                return rec

        # Fallback: lowest price
        bids = self.all_bids()
        if not bids:
            return None
        return min(bids, key=lambda b: b.get("bid_price_usdc", float("inf")))

    # ── Status ────────────────────────────────────────────────────────────────

    def time_remaining(self) -> float:
        if self._closed:
            return 0.0
        return max(0.0, self._end_time - time.time())

    def is_closed(self) -> bool:
        return self._closed

    def status(self) -> dict:
        return {
            "task_id":         self.task_id,
            "closed":          self._closed,
            "time_remaining":  self.time_remaining(),
            "bid_count":       len(self._bids),
            "bids":            self.all_bids(),
            "recommendations": self.get_recommendations(),
        }
