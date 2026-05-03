"""Evaluator agent — receives deliveries, verifies, returns signed verdicts."""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path

# Module-level imports — avoids 2-5 s cold-import penalty inside _evaluate()
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct
import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from aiohttp import web

from agents.shared.config import axl_base_url, axl_key_path, AXL_PORTS, EVALUATOR_HTTP_PORT
from agents.shared.axl_client import AXLClient
from agents.shared.message_types import EvaluationVerdict
from agents.shared.crypto import load_private_key, sign_message
from agents.evaluator.verifier import verify_deliverable

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [EVALUATOR] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

EVALUATOR_PRIVATE_KEY = os.getenv("EVALUATOR_PRIVATE_KEY", os.getenv("CLIENT_WALLET_PRIVATE_KEY", ""))
ESCROW_ADDRESS        = os.getenv("ESCROW_ADDRESS", "")
REST_PORT             = int(os.getenv("REST_PORT", "8766"))


def _eth_sign_verdict(task_id: str, passed: bool, escrow_address: str) -> str:
    """
    ECDSA signature matching HiveBidEscrow._verifyVerdict():
        hash    = keccak256(abi.encodePacked(taskId bytes32, pass bool, escrow address))
        ethHash = keccak256("\\x19Ethereum Signed Message:\\n32" + hash)
        signer  = ecrecover(ethHash, v, r, s)
    Signature format: r (32) || s (32) || v (1) = 65 bytes.
    """
    task_bytes = bytes.fromhex(task_id.replace("-", "").ljust(64, "0")[:64])  # bytes32
    pass_byte  = b"\x01" if passed else b"\x00"                                # bool
    addr_bytes = bytes.fromhex(escrow_address.lower().removeprefix("0x"))      # address

    raw_hash = Web3.keccak(task_bytes + pass_byte + addr_bytes)
    signed   = Account.sign_message(encode_defunct(raw_hash), private_key=EVALUATOR_PRIVATE_KEY)

    r = signed.r.to_bytes(32, "big")
    s = signed.s.to_bytes(32, "big")
    v = bytes([signed.v])
    return "0x" + (r + s + v).hex()


async def _post_verdict_rest(verdict_payload: dict) -> bool:
    """
    POST verdict directly to the client agent's REST API.
    Bypasses AXL entirely — guaranteed localhost delivery.
    Returns True on success.
    """
    url = f"http://127.0.0.1:{REST_PORT}/verdict"
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            resp = await http.post(url, json=verdict_payload)
            if resp.status_code == 200:
                logger.info(f"[REST] verdict delivered to client via REST ✓")
                return True
            logger.warning(f"[REST] /verdict returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"[REST] verdict POST failed: {e}")
    return False


class EvaluatorAgent:
    def __init__(self):
        self.axl           = AXLClient(axl_base_url("evaluator"), agent_name="evaluator")
        self._private_key  = load_private_key(axl_key_path("evaluator"))
        self._stop         = asyncio.Event()
        self._self_peer_id = ""
        self._client_peer_id = ""

    async def start(self):
        async with self.axl:
            logger.info("Evaluator waiting for AXL…")
            await self.axl.wait_ready()
            self._self_peer_id = await self.axl.get_self_peer_id()
            logger.info(f"Evaluator ready — peer={self._self_peer_id[:8]}…")

            if not EVALUATOR_PRIVATE_KEY:
                logger.warning("EVALUATOR_PRIVATE_KEY not set — verdicts will lack ETH sig")
            if not ESCROW_ADDRESS:
                logger.warning("ESCROW_ADDRESS not set — verdicts will lack ETH sig")

            await self._announce_hello()
            await asyncio.gather(
                self.axl.recv_loop(self._on_message, poll_interval=0.05, stop_event=self._stop),
                self._start_http_server(),
            )

    async def _start_http_server(self):
        """Direct HTTP endpoint so the client can POST deliveries without AXL latency."""
        app = web.Application()
        app.router.add_post("/evaluate", self._http_evaluate)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "127.0.0.1", EVALUATOR_HTTP_PORT)
        await site.start()
        logger.info(f"[Evaluator] HTTP server listening on http://127.0.0.1:{EVALUATOR_HTTP_PORT}")
        # Keep running until stop event
        await self._stop.wait()
        await runner.cleanup()

    async def _http_evaluate(self, request: web.Request) -> web.Response:
        try:
            delivery = await request.json()
        except Exception as e:
            return web.json_response({"error": f"invalid JSON: {e}"}, status=400)
        asyncio.create_task(self._evaluate("http-direct", delivery))
        return web.json_response({"accepted": True})

    async def _announce_hello(self):
        client_api = f"http://127.0.0.1:{AXL_PORTS['client']['api_port']}"
        hello = {
            "type":         "HELLO",
            "agent_name":   "evaluator",
            "worker_name":  "HiveBid Evaluator",
            "peer_id":      self._self_peer_id,
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
                logger.debug(f"Evaluator HELLO attempt {attempt + 1} failed: {e}")
            await asyncio.sleep(2)
        logger.warning("Evaluator could not send HELLO to client")

    async def _on_message(self, sender_peer_id: str, raw: dict):
        msg_type = raw.get("type", "")
        if msg_type == "DELIVERY" or "deliverable_content" in raw or "deliverable_hash" in raw:
            await self._evaluate(sender_peer_id, raw)

    async def _evaluate(self, sender_peer_id: str, delivery: dict):
        task_id        = delivery.get("task_id", "")
        task_spec      = delivery.get("task_spec", {})
        client_peer_id = delivery.get("client_peer_id", "") or sender_peer_id or self._client_peer_id

        logger.info(f"Evaluating delivery for task {task_id[:8]}…")

        # 1. Structural verification (fast, synchronous)
        try:
            verdict, reason = verify_deliverable(task_spec, delivery)
        except Exception as e:
            verdict = "FAIL"
            reason  = f"Evaluation error: {e}"
            logger.error(f"Evaluation exception: {e}", exc_info=True)

        logger.info(f"Verdict: {verdict} — {reason}")

        # 2. Ethereum ECDSA signature for escrow contract
        eth_sig = ""
        if EVALUATOR_PRIVATE_KEY and ESCROW_ADDRESS:
            try:
                eth_sig = _eth_sign_verdict(task_id, verdict == "PASS", ESCROW_ADDRESS)
                logger.info(f"ETH sig: {eth_sig[:22]}…")
            except Exception as e:
                logger.error(f"ETH signing failed: {e}")

        # 3. AXL Ed25519 signature (peer authentication)
        axl_payload = {"task_id": task_id, "verdict": verdict, "evaluator_peer_id": self._self_peer_id}

        verdict_msg = EvaluationVerdict(
            task_id=task_id,
            verdict=verdict,
            reason=reason,
            evaluator_peer_id=self._self_peer_id,
            evaluator_eth_sig=eth_sig,
        )
        verdict_msg.signature = sign_message(self._private_key, axl_payload)

        verdict_dict = verdict_msg.to_dict()

        # 4a. Primary delivery: REST API (reliable, no AXL mesh dependency)
        rest_ok = await _post_verdict_rest(verdict_dict)

        # 4b. Secondary delivery: AXL (for completeness / if REST fails)
        if not rest_ok and client_peer_id:
            sent = await self.axl.send(client_peer_id, verdict_dict)
            if sent:
                logger.info(f"Verdict sent via AXL to client ({client_peer_id[:8]}…)")
            else:
                logger.error("Verdict delivery failed — both REST and AXL failed")
        elif not rest_ok:
            logger.error("Cannot deliver verdict: client_peer_id unknown and REST failed")


async def main():
    agent = EvaluatorAgent()
    await agent.start()


if __name__ == "__main__":
    asyncio.run(main())
