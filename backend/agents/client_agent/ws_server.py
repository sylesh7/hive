"""
WebSocket server — pushes real-time events to the frontend and accepts commands.

Frontend connects to ws://localhost:8765
REST commands go to http://localhost:8766
"""
from __future__ import annotations
import asyncio
import json
import logging
from typing import Callable, Awaitable

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
        import socket, asyncio as _a
        for attempt in range(8):
            try:
                async with websockets.serve(
                    self._ws_handler,
                    "0.0.0.0",
                    self.ws_port,
                    reuse_address=True,
                ):
                    logger.info(f"[WS] server listening on ws://localhost:{self.ws_port}")
                    await _a.Future()   # run forever
                return
            except OSError as e:
                if attempt < 7:
                    logger.warning(f"[WS] port {self.ws_port} busy (attempt {attempt+1}/8) — retrying in 2s…")
                    await _a.sleep(2)
                else:
                    raise RuntimeError(f"[WS] Could not bind port {self.ws_port} after 8 attempts: {e}") from e

    # ── REST API ──────────────────────────────────────────────────────────────

    def _cors(self, response: web.Response) -> web.Response:
        response.headers["Access-Control-Allow-Origin"]  = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    async def _options(self, request: web.Request) -> web.Response:
        return self._cors(web.Response(status=204))

    async def _health(self, request: web.Request) -> web.Response:
        return self._cors(web.json_response({"status": "ok"}))

    async def _rest_handler(self, request: web.Request) -> web.Response:
        try:
            body = await request.json()
        except Exception:
            body = {}

        # Derive action from path and path params
        task_id = request.match_info.get("task_id", "")
        path    = request.path

        if path == "/tasks":
            action = "GET_TASKS"
        elif path == "/verdict":
            action = "SUBMIT_VERDICT"
        elif path == "/task" or path == "/task/":
            action = "CREATE_TASK"
        elif task_id and path.endswith("/accept"):
            action = "ACCEPT_BID"
        elif task_id and path.endswith("/cancel"):
            action = "CANCEL_AUCTION"
        elif task_id:
            action = "GET_TASK"
        else:
            action = body.get("action", "")

        cmd = {"action": action, "task_id": task_id, **body}
        if self.command_handler:
            result = await self.command_handler(cmd)
        else:
            result = {"error": "no handler"}

        return self._cors(web.json_response(result))

    async def start_rest(self):
        app = web.Application()
        # CORS preflight for all routes
        app.router.add_route("OPTIONS", "/{tail:.*}",        self._options)
        app.router.add_get("/health",                         self._health)
        app.router.add_post("/task",                          self._rest_handler)
        app.router.add_get("/tasks",                          self._rest_handler)
        app.router.add_get("/task/{task_id}",                 self._rest_handler)
        app.router.add_post("/task/{task_id}/accept",         self._rest_handler)
        app.router.add_post("/task/{task_id}/cancel",         self._rest_handler)
        # Direct verdict injection from evaluator (bypasses AXL)
        app.router.add_post("/verdict",                       self._rest_handler)

        runner = web.AppRunner(app)
        await runner.setup()

        for attempt in range(8):
            try:
                site = web.TCPSite(runner, "0.0.0.0", self.rest_port, reuse_address=True)
                await site.start()
                logger.info(f"[REST] server started on http://localhost:{self.rest_port}")
                return
            except OSError as e:
                if attempt < 7:
                    logger.warning(f"[REST] port {self.rest_port} busy (attempt {attempt+1}/8) — retrying in 2s…")
                    await asyncio.sleep(2)
                else:
                    raise RuntimeError(f"[REST] Could not bind port {self.rest_port} after 8 attempts: {e}") from e

    async def start(self):
        await asyncio.gather(self.start_ws(), self.start_rest())
