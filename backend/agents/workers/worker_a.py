"""Worker A — BrandCraft: logo design & content writing specialist."""
from __future__ import annotations
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from agents.workers.base_worker import BaseWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [WORKER-A/BrandCraft] %(levelname)s %(message)s",
)


class WorkerA(BaseWorker):
    def __init__(self):
        super().__init__("worker_a")

    @property
    def worker_name(self) -> str:
        return "BrandCraft"

    @property
    def capabilities(self) -> list[str]:
        return ["logo_design", "content_writing", "other"]

    @property
    def reputation_score(self) -> float:
        return 4.6

    @property
    def wallet_address(self) -> str:
        return "0xBrandCraft1111111111111111111111111111111"

    @property
    def nft_token_id(self) -> str:
        return "101"

    @property
    def base_delivery_secs(self) -> int:
        return 180   # 3 minutes

    def bid_strategy(self, max_budget: float) -> float:
        # Start at 75% of max budget, competitive
        return round(max_budget * 0.75, 2)

    def build_prompt(self, task_spec: dict) -> str:
        title       = task_spec.get("title", "the requested task")
        description = task_spec.get("description", "")
        task_type   = task_spec.get("task_type", "logo_design")
        spec        = task_spec.get("deliverable_spec", {})

        if task_type == "logo_design":
            return f"""Create a detailed logo design specification for: {title}

Task Description: {description}

Deliverable Requirements: {spec}

Please provide:
1. **Concept & Vision**: Core design concept and visual metaphor
2. **Color Palette**: Primary, secondary, and accent colors with hex codes
3. **Typography**: Font families and their usage (display vs body)
4. **Design Elements**: Shapes, icons, and graphic elements
5. **Variations**: Light mode, dark mode, icon-only versions
6. **Usage Guidelines**: Minimum sizes, clear space rules, don'ts
7. **SVG Structure**: Describe the SVG layers and structure
8. **Brand Voice**: How the design communicates the brand personality

Deliver a comprehensive, production-ready design specification."""
        else:
            return f"""Create high-quality content for: {title}

Description: {description}
Specifications: {spec}

Deliver polished, professional content ready for immediate use."""


async def main():
    worker = WorkerA()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())
