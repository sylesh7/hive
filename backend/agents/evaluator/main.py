"""Evaluator agent entry point — receives deliveries, verifies, returns verdicts."""
from __future__ import annotations
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from agents.shared.config import axl_base_url, axl_key_path
from agents.shared.axl_client import AXLClient
from agents.shared.message_types import EvaluationVerdict
from agents.shared.crypto import load_private_key, sign_message
from agents.evaluator.verifier import verify_deliverable

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [EVALUATOR] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


class EvaluatorAgent:
    def __init__(self):
        self.axl          = AXLClient(axl_base_url("evaluator"), agent_name="evaluator")
        self._private_key = load_private_key(axl_key_path("evaluator"))
        self._stop        = asyncio.Event()
        self._self_peer_id = ""

    async def start(self):
        async with self.axl:
            logger.info("Evaluator waiting for AXL…")
            await self.axl.wait_ready()
            self._self_peer_id = await self.axl.get_self_peer_id()
            logger.info(f"Evaluator ready — peer={self._self_peer_id[:8]}…")
            await self.axl.recv_loop(self._on_message, stop_event=self._stop)

    async def _on_message(self, sender_peer_id: str, raw: dict):
        msg_type = raw.get("type", "")
        if msg_type == "DELIVERY":
            await self._evaluate(sender_peer_id, raw)

    async def _evaluate(self, client_peer_id: str, delivery: dict):
        task_id   = delivery.get("task_id", "")
        task_spec = delivery.get("task_spec", {})
        logger.info(f"Evaluating delivery for task {task_id[:8]}…")

        try:
            verdict, reason = verify_deliverable(task_spec, delivery)
        except Exception as e:
            verdict = "FAIL"
            reason  = f"Evaluation error: {e}"
            logger.error(f"Evaluation failed: {e}", exc_info=True)

        logger.info(f"Verdict: {verdict} — {reason}")

        verdict_msg = EvaluationVerdict(
            task_id=task_id,
            verdict=verdict,
            reason=reason,
            evaluator_peer_id=self._self_peer_id,
        )
        payload = {"task_id": task_id, "verdict": verdict, "evaluator_peer_id": self._self_peer_id}
        verdict_msg.signature = sign_message(self._private_key, payload)

        # Send verdict back to the client agent
        await self.axl.send(client_peer_id, verdict_msg.to_dict())


async def main():
    agent = EvaluatorAgent()
    await agent.start()


if __name__ == "__main__":
    asyncio.run(main())
