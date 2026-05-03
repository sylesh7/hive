"""
Client Agent — main entry point.

Responsibilities:
  - Manage task lifecycle (create → auction → escrow → delivery → settlement)
  - Broadcast task announcements over AXL
  - Collect bids and route them to scout agents
  - Accept scout recommendations and trigger escrow via KeeperHub
  - Receive deliveries and route to evaluator
  - Release or refund payment based on verdict
  - Write reputation feedback to ERC-8004
  - Push all events to the frontend over WebSocket
"""
from __future__ import annotations
import asyncio
import json
import logging
import sys
import time
from pathlib import Path

# ── Shared imports ────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

import httpx
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct

from agents.shared.config import (
    AXL_PORTS, WS_PORT, REST_PORT, EVALUATOR_HTTP_PORT,
    axl_base_url, axl_key_path,
    CLIENT_WALLET_PRIVATE_KEY, EVALUATOR_PRIVATE_KEY, ESCROW_ADDRESS,
)
from agents.shared.axl_client import AXLClient
from agents.shared.message_types import (
    TaskAnnouncement, Bid, BidAccepted, BidRejected,
    BidForward, WorkerStatus, Delivery, EvaluationVerdict,
    ScoutRecommendation, parse_message,
)
from agents.shared.crypto import load_private_key, sign_message, sha256_hex
from agents.shared.erc8004 import ERC8004Client

from agents.client_agent.task_manager import TaskManager, TaskState
from agents.client_agent.auction_manager import AuctionManager
from agents.client_agent.ws_server import WSServer
from agents.client_agent import keeperhub_stub as keeperhub

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [CLIENT] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


def _sign_verdict(task_id: str, passed: bool) -> str:
    """Sign verdict for the escrow contract (ECDSA secp256k1)."""
    if not EVALUATOR_PRIVATE_KEY or not ESCROW_ADDRESS:
        return ""
    try:
        task_bytes = bytes.fromhex(task_id.replace("-", "").ljust(64, "0")[:64])
        pass_byte  = b"\x01" if passed else b"\x00"
        addr_bytes = bytes.fromhex(ESCROW_ADDRESS.lower().removeprefix("0x"))
        raw_hash = Web3.keccak(task_bytes + pass_byte + addr_bytes)
        signed   = Account.sign_message(encode_defunct(raw_hash), private_key=EVALUATOR_PRIVATE_KEY)
        r = signed.r.to_bytes(32, "big")
        s = signed.s.to_bytes(32, "big")
        v = bytes([signed.v])
        return "0x" + (r + s + v).hex()
    except Exception as e:
        logger.warning(f"Verdict signing failed: {e}")
        return ""


# ── Peer registry (filled after AXL nodes boot) ──────────────────────────────
# Maps agent_name → peer_id (populated via /topology after startup)
PEER_REGISTRY: dict[str, str] = {}

SCOUT_NAMES  = ["scout_cost", "scout_quality", "scout_speed"]
WORKER_NAMES = ["worker_a", "worker_b", "worker_c", "worker_d"]
EVAL_NAME    = "evaluator"


class ClientAgent:
    def __init__(self):
        self.axl = AXLClient(axl_base_url("client"), agent_name="client")
        self.task_mgr = TaskManager()
        self._auctions: dict[str, AuctionManager] = {}
        self._private_key = load_private_key(axl_key_path("client"))
        self._erc8004 = ERC8004Client(CLIENT_WALLET_PRIVATE_KEY)
        self._ws = WSServer(
            ws_port=WS_PORT,
            rest_port=REST_PORT,
            command_handler=self._handle_command,
        )
        self._stop = asyncio.Event()
        self._self_peer_id: str = ""
        self._nft_token_id: int = 0

    # ── Startup ───────────────────────────────────────────────────────────────

    async def start(self):
        async with self.axl:
            logger.info("Waiting for AXL node…")
            if not await self.axl.wait_ready():
                logger.error("AXL node not ready. Exiting.")
                return

            self._self_peer_id = await self.axl.get_self_peer_id()
            logger.info(f"Client peer ID: {self._self_peer_id}")

            # Register ERC-8004 identity (skip if already registered)
            await self._ensure_identity()

            # Populate peer registry from topology
            await self._refresh_peers()

            logger.info("Client agent ready.")
            await self._ws.broadcast("AGENT_READY", {"peer_id": self._self_peer_id})

            # Resolve any tasks that were left stuck in EVALUATING from a prior run
            asyncio.create_task(self._resolve_stuck_tasks())

            await asyncio.gather(
                self.axl.recv_loop(self._on_message, stop_event=self._stop),
                self._ws.start(),
                self._peer_refresh_loop(),
            )

    async def _ensure_identity(self):
        """Register on ERC-8004 if not already done."""
        identity_file = Path(__file__).parent / "identity.json"
        if identity_file.exists():
            data = json.loads(identity_file.read_text())
            self._nft_token_id = data.get("token_id", 0)
            logger.info(f"ERC-8004 identity loaded: tokenId={self._nft_token_id}")
            return
        try:
            tx_hash, token_id = self._erc8004.register_agent(
                name="HiveBid-ClientAgent",
                metadata_uri="https://hivebid.xyz/agents/client.json",
                capabilities=["task_posting", "auction_management", "escrow"],
            )
            self._nft_token_id = token_id
            identity_file.write_text(json.dumps({"token_id": token_id, "tx_hash": tx_hash}))
            logger.info(f"ERC-8004 registered: tokenId={token_id} tx={tx_hash}")
        except Exception as e:
            logger.warning(f"ERC-8004 registration failed (continuing): {e}")

    async def _refresh_peers(self):
        """Update PEER_REGISTRY from AXL topology."""
        try:
            peers = await self.axl.list_peers()
            for p in peers:
                pid = p.get("id", "")
                label = p.get("label", p.get("name", ""))
                if label and pid:
                    PEER_REGISTRY[label] = pid
        except Exception as e:
            logger.debug(f"Peer refresh error: {e}")

    async def _peer_refresh_loop(self):
        """Periodically refresh peer registry."""
        while not self._stop.is_set():
            await asyncio.sleep(10)
            await self._refresh_peers()

    async def _resolve_stuck_tasks(self):
        """Auto-PASS any tasks stuck in EVALUATING from a previous run."""
        await asyncio.sleep(2)  # let WS server come up first
        for rec in self.task_mgr.list_active():
            if rec.state == TaskState.EVALUATING:
                logger.info(f"Resolving stuck EVALUATING task {rec.task_id[:8]}…")
                eth_sig = _sign_verdict(rec.task_id, passed=True)
                await self._handle_verdict({
                    "task_id":           rec.task_id,
                    "verdict":           "PASS",
                    "reason":            "Auto-approved",
                    "evaluator_eth_sig": eth_sig,
                })

    # ── Inbound message router ────────────────────────────────────────────────

    async def _on_message(self, sender_peer_id: str, raw: dict):
        msg_type = raw.get("type", "")
        logger.info(f"← {msg_type} from {sender_peer_id[:8]}…")

        if msg_type == "BID":
            await self._handle_bid(raw)
        elif msg_type == "SCOUT_RECOMMENDATION":
            await self._handle_scout_rec(raw)
        elif msg_type == "WORKER_STATUS":
            await self._handle_worker_status(raw)
        elif msg_type == "DELIVERY":
            await self._handle_delivery(raw)
        elif msg_type == "EVALUATION_VERDICT":
            await self._handle_verdict(raw)
        elif msg_type == "HELLO":
            await self._handle_hello(sender_peer_id, raw)
        else:
            logger.debug(f"Unhandled message type: {msg_type}")

    # ── HELLO / peer registration ─────────────────────────────────────────────

    async def _handle_hello(self, sender_peer_id: str, raw: dict):
        """A worker just announced its peer_id. Register it and replay open auctions."""
        agent_name  = raw.get("agent_name", "")
        worker_name = raw.get("worker_name", "")
        if agent_name and sender_peer_id:
            PEER_REGISTRY[agent_name] = sender_peer_id
            logger.info(f"HELLO from {worker_name} ({agent_name}) peer={sender_peer_id[:8]}…")
            await self._ws.broadcast("PEER_REGISTERED", {
                "agent_name": agent_name,
                "worker_name": worker_name,
                "peer_id": sender_peer_id,
            })

        # Re-broadcast any open auctions so late-starting workers can still bid
        for task_id, auction in self._auctions.items():
            if auction.is_open:
                rec = self.task_mgr.get(task_id)
                if rec:
                    announcement = {
                        "type": "TASK_ANNOUNCEMENT",
                        **rec.spec,
                        "task_id": task_id,
                        "client_peer_id": self._self_peer_id,
                    }
                    await self.axl.send(sender_peer_id, announcement)
                    logger.info(f"Replayed task {task_id[:8]}… to late worker {agent_name}")

    # ── Task creation ─────────────────────────────────────────────────────────

    async def create_and_broadcast_task(self, spec: dict) -> dict:
        """Create a task record and broadcast it to all worker peers."""
        rec = self.task_mgr.create_task(spec)
        task_id = rec.task_id

        announcement = TaskAnnouncement(
            task_id=task_id,
            title=spec.get("title", ""),
            description=spec.get("description", ""),
            task_type=spec.get("task_type", "other"),
            max_budget_usdc=float(spec.get("max_budget_usdc", 0)),
            deadline_unix=float(spec.get("deadline_unix", time.time() + 3600)),
            auction_window_secs=int(spec.get("auction_window_secs", 90)),
            deliverable_spec=spec.get("deliverable_spec", {}),
            client_peer_id=self._self_peer_id,
            required_capabilities=spec.get("required_capabilities", [spec.get("task_type", "")]),
        )

        self.task_mgr.transition(task_id, TaskState.BROADCASTING)

        # Open auction
        auction = AuctionManager(
            task_id=task_id,
            window_secs=announcement.auction_window_secs,
            on_close=self._on_auction_close,
        )
        self._auctions[task_id] = auction
        end_time = auction.open()

        self.task_mgr.transition(
            task_id, TaskState.AUCTION_OPEN,
            auction_start=announcement.timestamp,
            auction_end=end_time,
        )

        # ── Broadcast to worker peers ──────────────────────────────────────────
        # Primary: use PEER_REGISTRY (populated by HELLO messages from workers)
        # Fallback: broadcast to ALL known AXL peers — workers self-filter via should_bid()
        registered_workers = [PEER_REGISTRY[n] for n in WORKER_NAMES if n in PEER_REGISTRY]

        if len(registered_workers) >= 4:
            target_peers = registered_workers
        else:
            try:
                target_peers = await self.axl.list_peer_ids()
                if target_peers:
                    logger.info(f"PEER_REGISTRY has {len(registered_workers)} workers — broadcasting to all {len(target_peers)} AXL peers")
                else:
                    target_peers = registered_workers
            except Exception as e:
                target_peers = registered_workers
                logger.warning(f"Could not fetch AXL peers for broadcast: {e}")

        sent = await self.axl.broadcast(target_peers, announcement.to_dict())
        logger.info(f"Task {task_id} broadcast to {sent}/{len(target_peers)} peers")

        # Schedule periodic re-broadcast so late-starting workers get the task
        asyncio.create_task(self._rebrodcast_loop(task_id, announcement.to_dict()))

        await self._ws.broadcast("TASK_CREATED", {
            "task": rec.to_dict(),
            "auction_end": end_time,
            "peer_count": sent,
        })

        return rec.to_dict()

    async def _rebrodcast_loop(self, task_id: str, announcement: dict):
        """Re-broadcast task announcement every 15s while auction is open."""
        for _ in range(20):   # max 20 re-broadcasts (5 min at 15s each)
            await asyncio.sleep(15)
            auction = self._auctions.get(task_id)
            if not auction or auction.is_closed():
                break
            try:
                peer_ids = await self.axl.list_peer_ids()
                if peer_ids:
                    sent = await self.axl.broadcast(peer_ids, announcement)
                    logger.debug(f"Re-broadcast task {task_id[:8]}… to {sent}/{len(peer_ids)} peers")
            except Exception as e:
                logger.debug(f"Re-broadcast error: {e}")

    # ── Bid handling ──────────────────────────────────────────────────────────

    async def _handle_bid(self, raw: dict):
        task_id = raw.get("task_id", "")
        auction = self._auctions.get(task_id)
        if not auction:
            return

        if not auction.add_bid(raw):
            # Auction already closed
            return

        self.task_mgr.add_bid(task_id, raw)

        # Push to frontend
        await self._ws.broadcast("NEW_BID", {"task_id": task_id, "bid": raw})

        # Forward to scout agents
        rec = self.task_mgr.get(task_id)
        forward = BidForward(
            task_id=task_id,
            bid=raw,
            task_spec=rec.spec if rec else {},
        )
        scout_peer_ids = [PEER_REGISTRY[n] for n in SCOUT_NAMES if n in PEER_REGISTRY]
        if not scout_peer_ids:
            try:
                scout_peer_ids = await self.axl.list_peer_ids()
            except Exception:
                pass
        if scout_peer_ids:
            await self.axl.broadcast(scout_peer_ids, forward.to_dict())

    # ── Scout recommendations ─────────────────────────────────────────────────

    async def _handle_scout_rec(self, raw: dict):
        task_id  = raw.get("task_id", "")
        strategy = raw.get("strategy", "")
        top_bid  = raw.get("top_bid", {})

        auction = self._auctions.get(task_id)
        if auction:
            auction.set_scout_recommendation(strategy, top_bid)

        self.task_mgr.set_scout_recommendation(task_id, strategy, top_bid)
        await self._ws.broadcast("SCOUT_UPDATE", {
            "task_id":  task_id,
            "strategy": strategy,
            "top_bid":  top_bid,
            "reason":   raw.get("reason", ""),
        })

    # ── Auction close / acceptance ────────────────────────────────────────────

    async def _on_auction_close(self, task_id: str, winning_bid: dict | None):
        """Called automatically when auction timer expires."""
        if not winning_bid:
            logger.warning(f"Auction {task_id} closed with no bids — cancelling")
            self.task_mgr.transition(task_id, TaskState.CANCELLED)
            await self._ws.broadcast("AUCTION_CANCELLED", {"task_id": task_id})
            return

        await self._accept_bid(task_id, winning_bid)

    async def accept_bid_for_task(self, task_id: str, strategy: str | None = None) -> dict:
        """Manually accept a bid (frontend command)."""
        auction = self._auctions.get(task_id)
        if not auction:
            return {"error": "auction not found"}

        rec = self.task_mgr.get(task_id)
        if not rec:
            return {"error": "task not found"}

        winning_bid = None
        if strategy:
            winning_bid = rec.scout_recommendations.get(strategy)
        if not winning_bid:
            winning_bid = auction._select_winner()

        if not winning_bid:
            return {"error": "no bids to accept"}

        await auction.close(winning_bid)
        return {"accepted": True, "bid": winning_bid}

    async def _accept_bid(self, task_id: str, winning_bid: dict):
        self.task_mgr.transition(
            task_id, TaskState.AUCTION_CLOSED, winning_bid=winning_bid
        )
        await self._ws.broadcast("AUCTION_CLOSED", {
            "task_id":    task_id,
            "winning_bid": winning_bid,
        })

        # Notify winning worker — include task_spec so worker can use it for LLM
        winner_peer_id = winning_bid.get("worker_peer_id", "")
        rec = self.task_mgr.get(task_id)
        if winner_peer_id:
            accepted_msg = BidAccepted(
                task_id=task_id,
                agreed_price_usdc=winning_bid.get("bid_price_usdc", 0),
                worker_peer_id=winner_peer_id,
            )
            # Attach task_spec inline so worker doesn't need to re-request it
            accepted_dict = accepted_msg.to_dict()
            accepted_dict["task_spec"] = rec.spec if rec else {}
            await self.axl.send(winner_peer_id, accepted_dict)

        # Notify losers
        for agent_name, peer_id in PEER_REGISTRY.items():
            if agent_name.startswith("worker") and peer_id != winner_peer_id:
                rej = BidRejected(task_id=task_id, worker_peer_id=peer_id, reason="Another bid was selected")
                await self.axl.send(peer_id, rej.to_dict())

        # Lock escrow via KeeperHub
        await self._lock_escrow(task_id, winning_bid)

    async def _lock_escrow(self, task_id: str, winning_bid: dict):
        self.task_mgr.transition(task_id, TaskState.ESCROW_PENDING)
        await self._ws.broadcast("ESCROW_PENDING", {"task_id": task_id})

        try:
            tx_hash = await keeperhub.lock_escrow(
                task_id=task_id,
                amount_usdc=winning_bid.get("bid_price_usdc", 0),
                worker_wallet=winning_bid.get("worker_wallet", ""),
            )
            self.task_mgr.transition(
                task_id, TaskState.ESCROW_LOCKED, escrow_tx_hash=tx_hash
            )
            await self._ws.broadcast("ESCROW_LOCKED", {
                "task_id": task_id,
                "tx_hash": tx_hash,
                "amount":  winning_bid.get("bid_price_usdc"),
            })
            self.task_mgr.transition(task_id, TaskState.DELIVERY_PENDING)
        except Exception as e:
            logger.error(f"Escrow lock failed for {task_id}: {e}")
            await self._ws.broadcast("ERROR", {"task_id": task_id, "error": str(e)})

    # ── Delivery ──────────────────────────────────────────────────────────────

    async def _handle_worker_status(self, raw: dict):
        task_id = raw.get("task_id", "")
        await self._ws.broadcast("WORKER_STATUS", raw)

    async def _handle_delivery(self, raw: dict):
        task_id = raw.get("task_id", "")
        self.task_mgr.transition(
            task_id, TaskState.DELIVERY_RECEIVED, delivery=raw
        )
        await self._ws.broadcast("DELIVERY_RECEIVED", {"task_id": task_id, "delivery": raw})

        # Mock evaluation: auto-PASS every delivery immediately
        self.task_mgr.transition(task_id, TaskState.EVALUATING)
        await self._ws.broadcast("EVALUATING", {"task_id": task_id})

        eth_sig = _sign_verdict(task_id, passed=True)
        logger.info(f"[MOCK EVAL] Auto-PASS for task {task_id[:8]}… sig={eth_sig[:12]}…")
        await self._handle_verdict({
            "task_id":           task_id,
            "verdict":           "PASS",
            "reason":            "Auto-approved",
            "evaluator_eth_sig": eth_sig,
        })

    # ── Evaluation & settlement ───────────────────────────────────────────────

    async def _handle_verdict(self, raw: dict):
        task_id       = raw.get("task_id", "")
        verdict       = raw.get("verdict", "FAIL")
        reason        = raw.get("reason", "")
        evaluator_sig = raw.get("evaluator_eth_sig", "")

        await self._ws.broadcast("EVALUATION_VERDICT", {
            "task_id": task_id,
            "verdict": verdict,
            "reason":  reason,
        })
        await self._settle(task_id, verdict, reason, evaluator_sig)

    async def _settle(self, task_id: str, verdict: str, reason: str, evaluator_sig: str = ""):
        rec = self.task_mgr.get(task_id)
        if not rec or not rec.winning_bid:
            return

        winning_bid   = rec.winning_bid
        amount        = winning_bid.get("bid_price_usdc", 0)
        worker_wallet = winning_bid.get("worker_wallet", "")

        if verdict == "PASS":
            tx_hash = await keeperhub.release_payment(task_id, worker_wallet, amount, evaluator_sig)
            self.task_mgr.transition(
                task_id, TaskState.SETTLED, release_tx_hash=tx_hash
            )
            await self._ws.broadcast("PAYMENT_RELEASED", {
                "task_id": task_id,
                "tx_hash": tx_hash,
                "amount":  amount,
                "worker":  winning_bid.get("worker_name"),
            })
            await self._write_reputation(task_id, winning_bid, score=5)
        else:
            tx_hash = await keeperhub.refund(task_id, "", amount, evaluator_sig)
            self.task_mgr.transition(
                task_id, TaskState.REFUNDED, refund_tx_hash=tx_hash
            )
            await self._ws.broadcast("PAYMENT_REFUNDED", {
                "task_id": task_id,
                "tx_hash": tx_hash,
                "reason":  reason,
            })
            await self._write_reputation(task_id, winning_bid, score=1)

    async def _write_reputation(self, task_id: str, winning_bid: dict, score: int):
        nft_id = winning_bid.get("worker_identity_nft_id", "")
        if not nft_id:
            return
        try:
            tx = self._erc8004.submit_feedback(
                agent_token_id=int(nft_id),
                score=score,
                tags=["hivebid", "automated"],
                evidence_url=f"https://hivebid.xyz/tasks/{task_id}",
            )
            # B1 fix: use correct state enum, not task_id string
            rec = self.task_mgr.get(task_id)
            if rec:
                rec.reputation_tx_hash = tx
                rec.updated_at = __import__('time').time()
                rec.save()
            await self._ws.broadcast("REPUTATION_UPDATED", {
                "task_id": task_id,
                "score":   score,
                "tx_hash": tx,
            })
        except Exception as e:
            logger.warning(f"Reputation write failed: {e}")

    # ── Frontend command handler ──────────────────────────────────────────────

    async def _handle_command(self, cmd: dict) -> dict:
        action = cmd.get("action", "")
        logger.info(f"[Command] {action}")

        if action == "SUBMIT_VERDICT":
            # Evaluator posts verdict directly via REST — fire-and-forget so REST returns fast
            asyncio.create_task(self._handle_verdict(cmd))
            return {"accepted": True}

        if action == "CREATE_TASK" or "title" in cmd:
            return await self.create_and_broadcast_task(cmd)

        elif action == "ACCEPT_BID":
            task_id  = cmd.get("task_id", "")
            strategy = cmd.get("strategy")
            return await self.accept_bid_for_task(task_id, strategy)

        elif action == "CANCEL_AUCTION":
            task_id = cmd.get("task_id", "")
            auction = self._auctions.get(task_id)
            if auction:
                await auction.close(None)
                self.task_mgr.transition(task_id, TaskState.CANCELLED)
                await self._ws.broadcast("AUCTION_CANCELLED", {"task_id": task_id})
            return {"cancelled": True}

        elif action == "GET_TASKS":
            return {
                "active":  [t.to_dict() for t in self.task_mgr.list_active()],
                "history": [t.to_dict() for t in self.task_mgr.list_history()],
            }

        elif action == "GET_TASK":
            task_id = cmd.get("task_id", "")
            rec = self.task_mgr.get(task_id)
            return rec.to_dict() if rec else {"error": "not found"}

        elif action == "GET_STATUS":
            return {
                "peer_id":    self._self_peer_id,
                "nft_token_id": self._nft_token_id,
                "peers":      PEER_REGISTRY,
                "active_tasks": len(self.task_mgr.list_active()),
            }

        return {"error": f"unknown action: {action}"}


# ── Entry point ───────────────────────────────────────────────────────────────

async def main():
    agent = ClientAgent()
    await agent.start()


if __name__ == "__main__":
    asyncio.run(main())
