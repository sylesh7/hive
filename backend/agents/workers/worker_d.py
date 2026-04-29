"""Worker D — SwiftTask: general-purpose aggressive bidder."""
from __future__ import annotations
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from agents.workers.base_worker import BaseWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [WORKER-D/SwiftTask] %(levelname)s %(message)s",
)


class WorkerD(BaseWorker):
    def __init__(self):
        super().__init__("worker_d")

    @property
    def worker_name(self) -> str:
        return "SwiftTask"

    @property
    def capabilities(self) -> list[str]:
        # Accepts everything — true generalist
        return ["logo_design", "code_audit", "research_report", "content_writing", "other"]

    @property
    def reputation_score(self) -> float:
        return 3.9   # Lower reputation — compensates with price

    @property
    def wallet_address(self) -> str:
        return "0xSwiftTask4444444444444444444444444444444"

    @property
    def nft_token_id(self) -> str:
        return "104"

    @property
    def base_delivery_secs(self) -> int:
        return 120   # Fastest — 2 minutes

    def bid_strategy(self, max_budget: float) -> float:
        # Aggressive — bids at 60%, the lowest start
        return round(max_budget * 0.60, 2)

    def build_prompt(self, task_spec: dict) -> str:
        title       = task_spec.get("title", "the task")
        description = task_spec.get("description", "")
        task_type   = task_spec.get("task_type", "other")
        spec        = task_spec.get("deliverable_spec", {})

        return f"""Complete the following task quickly and effectively: {title}

Task Type: {task_type}
Description: {description}
Specifications: {spec}

As SwiftTask, deliver a complete, professional result. While speed is your advantage,
do not sacrifice quality — the deliverable must fully meet all specified requirements.

Structure your response clearly with:
1. A brief approach summary
2. The complete deliverable
3. Any important notes or caveats

Deliver comprehensive, usable output now."""


async def main():
    worker = WorkerD()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())
