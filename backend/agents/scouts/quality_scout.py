"""Quality Scout — ranks by on-chain reputation score weighted against price."""
from __future__ import annotations
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from agents.scouts.base_scout import BaseScout
from agents.shared.erc8004 import ERC8004Client
from agents.shared.config import CLIENT_WALLET_PRIVATE_KEY

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SCOUT-QUALITY] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


class QualityScout(BaseScout):
    def __init__(self):
        super().__init__("scout_quality")
        # Read-only ERC-8004 client for reputation lookups
        self._erc8004 = ERC8004Client(CLIENT_WALLET_PRIVATE_KEY)
        self._rep_cache: dict[str, float] = {}   # nft_id → score

    @property
    def strategy_name(self) -> str:
        return "quality"

    def _get_reputation(self, bid: dict) -> float:
        """
        Get reputation score for a worker.
        Uses the on-chain average score if the NFT ID is available,
        otherwise falls back to the self-reported score in the bid.
        """
        nft_id = bid.get("worker_identity_nft_id", "")
        if nft_id and nft_id in self._rep_cache:
            return self._rep_cache[nft_id]

        if nft_id:
            try:
                score = self._erc8004.get_average_score(int(nft_id))
                if score > 0:
                    self._rep_cache[nft_id] = score
                    return score
            except Exception as e:
                logger.debug(f"ERC-8004 reputation lookup failed for {nft_id}: {e}")

        # Fallback to self-reported score
        return bid.get("worker_reputation_score", 3.0)

    def rank_bids(self, bids: list[dict], task_spec: dict) -> list[dict]:
        """
        Rank by reputation-per-dollar: higher score / lower price wins.
        Score = reputation (1–5) / price_usdc
        """
        def score(b: dict) -> float:
            rep   = self._get_reputation(b)
            price = b.get("bid_price_usdc", float("inf"))
            if price <= 0:
                return 0.0
            return rep / price

        valid = [b for b in bids if b.get("bid_price_usdc", 0) > 0]
        return sorted(valid, key=score, reverse=True)

    def _explain(self, top_bid: dict, ranked: list[dict], task_spec: dict) -> str:
        rep   = self._get_reputation(top_bid)
        price = top_bid.get("bid_price_usdc", 0)
        name  = top_bid.get("worker_name", "?")
        score = rep / price if price else 0
        return (
            f"{name} has the best reputation-per-dollar: "
            f"{rep:.1f} rep / {price:.2f} USDC = {score:.4f} quality score"
        )


async def main():
    scout = QualityScout()
    await scout.start()


if __name__ == "__main__":
    asyncio.run(main())
