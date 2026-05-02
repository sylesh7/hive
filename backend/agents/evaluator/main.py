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
        self._client_peer_id = ""  # populated when delivery arrives

    async def start(self):
        async with self.axl:
            logger.info("Evaluator waiting for AXL…")
            await self.axl.wait_ready()
            self._self_peer_id = await self.axl.get_self_peer_id()
            logger.info(f"Evaluator ready — peer={self._self_peer_id[:8]}…")

            # Announce to client so PEER_REGISTRY knows our peer_id
            await self._announce_hello()

            await self.axl.recv_loop(self._on_message, stop_event=self._stop)

    async def _announce_hello(self):
        """Send HELLO to client agent so it registers us in PEER_REGISTRY."""
        import httpx
        from agents.shared.config import AXL_PORTS
        client_api = f"http://127.0.0.1:{AXL_PORTS['client']['api_port']}"
        hello = {
            "type": "HELLO",
            "agent_name": "evaluator",
            "worker_name": "HiveBid Evaluator",
            "peer_id": self._self_peer_id,
            "capabilities": ["evaluation"],
        }
        for attempt in range(10):
            try:
                async with httpx.AsyncClient(timeout=3.0) as http:
                    resp = await http.get(f"{client_api}/topology")
                    if resp.status_code == 200:
                        client_peer_id = resp.json().get("our_public_key", "")
                        if client_peer_id:
                            self._client_peer_id = client_peer_id
                            await self.axl.send(client_peer_id, hello)
                            logger.info(f"Evaluator HELLO sent to client ({client_peer_id[:8]}…)")
                            return
            except Exception as e:
                logger.debug(f"Evaluator HELLO attempt {attempt+1} failed: {e}")
            await asyncio.sleep(2)
        logger.warning("Evaluator could not send HELLO to client")

    async def _on_message(self, sender_peer_id: str, raw: dict):
        msg_type = raw.get("type", "")
        # Accept both the typed DELIVERY message and inline delivery dicts
        if msg_type == "DELIVERY" or "deliverable_content" in raw or "deliverable_hash" in raw:
            await self._evaluate(sender_peer_id, raw)

    async def _evaluate(self, sender_peer_id: str, delivery: dict):
        task_id   = delivery.get("task_id", "")
        task_spec = delivery.get("task_spec", {})

        # client_peer_id is embedded in the delivery payload by the client agent
        client_peer_id = delivery.get("client_peer_id", "") or sender_peer_id
        if not client_peer_id:
            client_peer_id = self._client_peer_id

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
        if client_peer_id:
            await self.axl.send(client_peer_id, verdict_msg.to_dict())
            logger.info(f"Verdict sent to client ({client_peer_id[:8]}…)")
        else:
            logger.error("Cannot send verdict: client_peer_id unknown")


async def main():
    agent = EvaluatorAgent()
    await agent.start()


if __name__ == "__main__":
    asyncio.run(main())
