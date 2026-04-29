"""Speed Scout — ranks by fastest delivery time, with price as tiebreaker."""
from __future__ import annotations
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from agents.scouts.base_scout import BaseScout

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SCOUT-SPEED] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


class SpeedScout(BaseScout):
    def __init__(self):
        super().__init__("scout_speed")

    @property
    def strategy_name(self) -> str:
        return "speed"

    def rank_bids(self, bids: list[dict], task_spec: dict) -> list[dict]:
        """
        Composite score weighting speed 60%, price 40%.
        Normalise both dimensions across the current bid set before combining.
        """
        valid = [b for b in bids if b.get("bid_price_usdc", 0) > 0]
        if not valid:
            return []
        if len(valid) == 1:
            return valid

        min_t = min(b.get("delivery_time_secs", 1) for b in valid)
        max_t = max(b.get("delivery_time_secs", 1) for b in valid)
        min_p = min(b.get("bid_price_usdc", 1)     for b in valid)
        max_p = max(b.get("bid_price_usdc", 1)     for b in valid)

        t_range = max_t - min_t or 1
        p_range = max_p - min_p or 1

        def score(b: dict) -> float:
            t = b.get("delivery_time_secs", max_t)
            p = b.get("bid_price_usdc",    max_p)
            # Lower time → higher speed_norm; lower price → higher price_norm
            speed_norm = 1.0 - (t - min_t) / t_range
            price_norm = 1.0 - (p - min_p) / p_range
            return 0.6 * speed_norm + 0.4 * price_norm

        return sorted(valid, key=score, reverse=True)

    def _explain(self, top_bid: dict, ranked: list[dict], task_spec: dict) -> str:
        t    = top_bid.get("delivery_time_secs", 0)
        name = top_bid.get("worker_name", "?")
        mins = t // 60
        secs = t % 60
        time_str = f"{mins}m {secs}s" if mins else f"{secs}s"
        return (
            f"{name} promises the fastest delivery at {time_str} "
            f"({top_bid.get('bid_price_usdc', 0):.2f} USDC)"
        )


async def main():
    scout = SpeedScout()
    await scout.start()


if __name__ == "__main__":
    asyncio.run(main())
