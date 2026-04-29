"""Cost Scout — ranks by lowest bid price meeting the deliverable spec."""
from __future__ import annotations
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from agents.scouts.base_scout import BaseScout

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SCOUT-COST] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


class CostScout(BaseScout):
    def __init__(self):
        super().__init__("scout_cost")

    @property
    def strategy_name(self) -> str:
        return "cost"

    def rank_bids(self, bids: list[dict], task_spec: dict) -> list[dict]:
        """Sort ascending by bid price. Filter obviously invalid bids."""
        valid = [b for b in bids if b.get("bid_price_usdc", 0) > 0]
        return sorted(valid, key=lambda b: b.get("bid_price_usdc", float("inf")))

    def _explain(self, top_bid: dict, ranked: list[dict], task_spec: dict) -> str:
        price  = top_bid.get("bid_price_usdc", 0)
        name   = top_bid.get("worker_name", "?")
        others = len(ranked) - 1
        return (
            f"{name} offers the lowest price at {price:.2f} USDC"
            + (f" — {others} other bid(s) were more expensive" if others else "")
        )


async def main():
    scout = CostScout()
    await scout.start()


if __name__ == "__main__":
    asyncio.run(main())
