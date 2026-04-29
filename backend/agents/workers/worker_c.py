"""Worker C — ResearchBot: research reports and content specialist."""
from __future__ import annotations
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from agents.workers.base_worker import BaseWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [WORKER-C/ResearchBot] %(levelname)s %(message)s",
)


class WorkerC(BaseWorker):
    def __init__(self):
        super().__init__("worker_c")

    @property
    def worker_name(self) -> str:
        return "ResearchBot"

    @property
    def capabilities(self) -> list[str]:
        return ["research_report", "content_writing", "other"]

    @property
    def reputation_score(self) -> float:
        return 4.2

    @property
    def wallet_address(self) -> str:
        return "0xResearchBot333333333333333333333333333"

    @property
    def nft_token_id(self) -> str:
        return "103"

    @property
    def base_delivery_secs(self) -> int:
        return 300   # 5 minutes — thorough research

    def bid_strategy(self, max_budget: float) -> float:
        # Mid-range pricing — bids at 70%
        return round(max_budget * 0.70, 2)

    def build_prompt(self, task_spec: dict) -> str:
        title       = task_spec.get("title", "research report")
        description = task_spec.get("description", "")
        spec        = task_spec.get("deliverable_spec", {})
        word_count  = spec.get("word_count", 1000)
        sections    = spec.get("sections", [])

        sections_text = "\n".join(f"- {s}" for s in sections) if sections else "- Introduction\n- Analysis\n- Findings\n- Conclusion"

        return f"""Write a comprehensive research report on: {title}

Description: {description}
Target Length: approximately {word_count} words
Required Sections:
{sections_text}

Additional Specifications: {spec}

Deliver a well-structured, thoroughly researched report that:
1. Opens with a compelling executive summary
2. Covers each required section with depth and supporting evidence
3. Includes relevant data points, statistics, and citations where appropriate
4. Maintains an analytical, objective tone throughout
5. Concludes with actionable insights and recommendations
6. Uses clear headers, subheaders, and bullet points for readability

The report should be suitable for professional publication."""


async def main():
    worker = WorkerC()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())
