"""
WebSocket server — pushes real-time events to the frontend and accepts commands.

Frontend connects to ws://localhost:8765
REST commands go to http://localhost:8766
"""
from __future__ import annotations
import asyncio
import json
import logging
from typing import Any, Callable, Awaitable

import websockets
from websockets.server import WebSocketServerProtocol
from aiohttp import web

logger = logging.getLogger(__name__)


class WSServer:
    """
    Manages WebSocket connections to the frontend and a lightweight REST API.
    """

    def __init__(
        self,
        ws_port: int = 8765,
        rest_port: int = 8766,
        command_handler: Callable[[dict], Awaitable[dict]] | None = None,
    ):
        self.ws_port = ws_port
        self.rest_port = rest_port
        self.command_handler = command_handler
        self._clients: set[WebSocketServerProtocol] = set()

    # ── Push to frontend ──────────────────────────────────────────────────────

    async def broadcast(self, event_type: str, data: dict):
        """Send an event to all connected frontend clients."""
        message = json.dumps({"event": event_type, "data": data})
        dead = set()
        for ws in list(self._clients):
            try:
                await ws.send(message)
            except Exception:
                dead.add(ws)
        self._clients -= dead
        if data:
            logger.debug(f"[WS] broadcast {event_type} → {len(self._clients)} clients")

    # ── WebSocket server ──────────────────────────────────────────────────────

    async def _ws_handler(self, ws: WebSocketServerProtocol):
        self._clients.add(ws)
        logger.info(f"[WS] client connected — {len(self._clients)} total")
        try:
            async for raw in ws:
                try:
                    cmd = json.loads(raw)
                    if self.command_handler:
                        result = await self.command_handler(cmd)
                        await ws.send(json.dumps({"response": result}))
                except json.JSONDecodeError:
                    await ws.send(json.dumps({"error": "invalid JSON"}))
                except Exception as e:
                    logger.error(f"[WS] command error: {e}", exc_info=True)
                    await ws.send(json.dumps({"error": str(e)}))
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self._clients.discard(ws)
            logger.info(f"[WS] client disconnected — {len(self._clients)} remaining")

    async def start_ws(self):
        logger.info(f"[WS] server starting on ws://localhost:{self.ws_port}")
        async with websockets.serve(self._ws_handler, "0.0.0.0", self.ws_port):
            await asyncio.Future()   # run forever

    # ── REST API ──────────────────────────────────────────────────────────────

    async def _rest_handler(self, request: web.Request) -> web.Response:
        try:
            body = await request.json()
        except Exception:
            body = {}
        cmd = {"action": request.match_info.get("action", ""), **body}
        if self.command_handler:
            result = await self.command_handler(cmd)
        else:
            result = {"error": "no handler"}
        return web.json_response(result)

    async def _health(self, request: web.Request) -> web.Response:
        return web.json_response({"status": "ok"})

    async def start_rest(self):
        app = web.Application()
        app.router.add_get("/health", self._health)
        app.router.add_post("/task", self._rest_handler)
        app.router.add_post("/task/{task_id}/accept", self._rest_handler)
        app.router.add_post("/task/{task_id}/cancel", self._rest_handler)
        app.router.add_get("/tasks", self._rest_handler)
        app.router.add_get("/task/{task_id}", self._rest_handler)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", self.rest_port)
        await site.start()
        logger.info(f"[REST] server started on http://localhost:{self.rest_port}")

    async def start(self):
        await asyncio.gather(self.start_ws(), self.start_rest())
