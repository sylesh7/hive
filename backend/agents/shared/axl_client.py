"""
Async HTTP client wrapper for the AXL node local API.

AXL HTTP API (from docs/api.md):
  GET  /topology              → {our_ipv6, our_public_key, peers, tree}
  POST /send                  → Header: X-Destination-Peer-Id (hex public key)
                                Body: raw binary
  GET  /recv                  → 204 if empty, 200 with X-From-Peer-Id header + binary body

Each agent has its own AXL node on localhost:api_port.
"""
from __future__ import annotations
import asyncio
import json
import logging
from typing import Callable, Awaitable

import httpx

logger = logging.getLogger(__name__)


class AXLClient:
    """
    Async wrapper for a single AXL node's local HTTP API.

    Args:
        base_url: e.g. "http://127.0.0.1:9002"
        agent_name: human-readable label for logging
    """

    def __init__(self, base_url: str, agent_name: str = "agent"):
        self.base_url = base_url.rstrip("/")
        self.agent_name = agent_name
        self._client: httpx.AsyncClient | None = None
        self._peer_id: str | None = None   # our_public_key (hex, 64 chars)

    async def __aenter__(self):
        self._client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, *args):
        if self._client:
            await self._client.aclose()

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            raise RuntimeError("AXLClient must be used as an async context manager")
        return self._client

    # ── Topology ──────────────────────────────────────────────────────────────

    async def get_topology(self) -> dict:
        """Query the AXL node for its peer topology."""
        resp = await self.client.get(f"{self.base_url}/topology")
        resp.raise_for_status()
        return resp.json()

    async def get_self_peer_id(self) -> str:
        """
        Return this node's own peer ID (our_public_key — 64 hex chars).
        This is the address used in X-Destination-Peer-Id header.
        """
        if self._peer_id:
            return self._peer_id
        topology = await self.get_topology()
        # Per docs/api.md: topology returns our_public_key
        self._peer_id = topology.get("our_public_key", "")
        return self._peer_id

    async def list_peers(self) -> list[dict]:
        """Return all known peers in the mesh (may have duplicates for inbound+outbound)."""
        topology = await self.get_topology()
        return topology.get("peers", [])

    async def list_peer_ids(self) -> list[str]:
        """Return unique peer IDs from the mesh tree, excluding self."""
        topology = await self.get_topology()
        self_id = topology.get("our_public_key", "")
        # tree has one entry per unique peer node
        tree = topology.get("tree", [])
        seen = set()
        peer_ids = []
        for node in tree:
            pid = node.get("public_key", "")
            if pid and pid != self_id and pid not in seen:
                seen.add(pid)
                peer_ids.append(pid)
        # Fallback to peers list if tree empty
        if not peer_ids:
            for p in topology.get("peers", []):
                pid = p.get("public_key", p.get("key", p.get("id", "")))
                if pid and pid != self_id and pid not in seen:
                    seen.add(pid)
                    peer_ids.append(pid)
        return peer_ids

    # ── Send ──────────────────────────────────────────────────────────────────

    async def send(self, peer_id: str, message: dict) -> bool:
        """
        Send a JSON message to a specific peer via AXL.

        Per docs: POST /send with header X-Destination-Peer-Id = hex public key.
        Body is raw binary (we send JSON-encoded bytes).

        Args:
            peer_id: destination peer's hex-encoded ed25519 public key (64 chars)
            message: dict to send (JSON-encoded)
        """
        try:
            payload = json.dumps(message).encode()
            resp = await self.client.post(
                f"{self.base_url}/send",
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Destination-Peer-Id": peer_id,
                },
            )
            resp.raise_for_status()
            logger.debug(
                f"[{self.agent_name}] sent {message.get('type','?')} → {peer_id[:8]}…"
            )
            return True
        except Exception as e:
            logger.warning(f"[{self.agent_name}] send failed to {peer_id[:8]}…: {e}")
            return False

    async def broadcast(self, peer_ids: list[str], message: dict) -> int:
        """Send a message to multiple peers. Returns success count."""
        results = await asyncio.gather(
            *[self.send(pid, message) for pid in peer_ids],
            return_exceptions=True,
        )
        return sum(1 for r in results if r is True)

    # ── Receive ───────────────────────────────────────────────────────────────

    async def recv_once(self) -> tuple[str, dict] | None:
        """
        Poll AXL for one incoming message.

        Per docs:
          - 204 No Content → queue empty
          - 200 OK → raw binary body + X-From-Peer-Id header

        Returns:
            (sender_peer_id, message_dict) or None if no messages pending
        """
        try:
            resp = await self.client.get(f"{self.base_url}/recv", timeout=2.0)
            if resp.status_code == 204:
                return None
            resp.raise_for_status()

            # Sender is in the response header
            sender = resp.headers.get("X-From-Peer-Id", "unknown")

            # Body is raw binary — we JSON-encode all our messages
            raw_bytes = resp.content
            if not raw_bytes:
                return None

            try:
                payload = json.loads(raw_bytes.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                logger.warning(f"[{self.agent_name}] recv: could not parse body as JSON: {e}")
                return None

            return sender, payload

        except httpx.TimeoutException:
            return None
        except Exception as e:
            logger.debug(f"[{self.agent_name}] recv error: {e}")
            return None

    async def recv_loop(
        self,
        callback: Callable[[str, dict], Awaitable[None]],
        poll_interval: float = 0.05,
        stop_event: asyncio.Event | None = None,
    ) -> None:
        """
        Continuously poll for messages and dispatch to callback.

        Args:
            callback: async function(sender_peer_id, message_dict)
            poll_interval: seconds to sleep when queue is empty
            stop_event: set this to stop the loop
        """
        logger.info(f"[{self.agent_name}] recv_loop started")
        while True:
            if stop_event and stop_event.is_set():
                break
            result = await self.recv_once()
            if result:
                sender, msg = result
                try:
                    await callback(sender, msg)
                except Exception as e:
                    logger.error(
                        f"[{self.agent_name}] callback error: {e}", exc_info=True
                    )
            else:
                await asyncio.sleep(poll_interval)

    # ── Readiness ─────────────────────────────────────────────────────────────

    async def wait_ready(self, retries: int = 30, delay: float = 1.0) -> bool:
        """Wait until the AXL node responds to /topology."""
        for i in range(retries):
            try:
                topo = await self.get_topology()
                if topo:
                    logger.info(
                        f"[{self.agent_name}] AXL node ready at {self.base_url}"
                    )
                    return True
            except Exception:
                if i < retries - 1:
                    await asyncio.sleep(delay)
        logger.error(
            f"[{self.agent_name}] AXL node never became ready at {self.base_url}"
        )
        return False
