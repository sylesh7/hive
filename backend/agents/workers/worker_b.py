"""Worker B — CodeAudit Pro: smart contract and code audit specialist."""
from __future__ import annotations
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from agents.workers.base_worker import BaseWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [WORKER-B/CodeAuditPro] %(levelname)s %(message)s",
)


class WorkerB(BaseWorker):
    def __init__(self):
        super().__init__("worker_b")

    @property
    def worker_name(self) -> str:
        return "CodeAudit Pro"

    @property
    def capabilities(self) -> list[str]:
        return ["code_audit", "other"]

    @property
    def reputation_score(self) -> float:
        return 4.8   # Highest reputation

    @property
    def wallet_address(self) -> str:
        return "0xCodeAuditPro22222222222222222222222222"

    @property
    def nft_token_id(self) -> str:
        return "102"

    @property
    def base_delivery_secs(self) -> int:
        return 240   # 4 minutes — thorough

    def bid_strategy(self, max_budget: float) -> float:
        # High-quality specialist — bids at 85% (premium)
        return round(max_budget * 0.85, 2)

    def build_prompt(self, task_spec: dict) -> str:
        title       = task_spec.get("title", "code audit")
        description = task_spec.get("description", "")
        spec        = task_spec.get("deliverable_spec", {})
        target_url  = spec.get("target_file_url", "the provided codebase")

        return f"""Perform a comprehensive code audit for: {title}

Audit Target: {target_url}
Description: {description}
Scope: {spec}

Deliver a professional security and quality audit report including:

## Executive Summary
Brief overview of findings and risk level.

## Scope & Methodology
What was reviewed and how.

## Critical Findings (Severity: Critical)
Issues that must be fixed immediately with exploit scenarios.

## High Severity Findings
Significant vulnerabilities requiring urgent attention.

## Medium Severity Findings
Issues that should be addressed in the next release.

## Low Severity / Informational
Best practice improvements and optimizations.

## Gas Optimization (if applicable)
Opportunities to reduce transaction costs.

## Recommendations
Prioritized remediation steps.

## Conclusion
Overall security posture and recommended next steps.

For each finding, include:
- Finding ID and title
- Location in code
- Severity rating
- Description of vulnerability
- Proof of concept
- Recommended fix

Provide a thorough, production-quality audit report."""


async def main():
    worker = WorkerB()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())
