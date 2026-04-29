"""
HiveBid Master Launcher
=======================
Starts all 9 AXL nodes and all 9 Python agent processes with a single command.

Usage:
  python start.py

Prerequisites:
  1. Copy .env.example to .env and fill in your values
  2. Run: pip install -r requirements.txt
  3. AXL binary must exist at axl/node.exe (built from axl-src/)

What this does:
  1. Generates ed25519 keys for each agent (skips if already exist)
  2. Writes node-config.json for each AXL node (unique port, correct peers)
  3. Starts all 9 AXL node subprocesses
  4. Waits until all AXL nodes respond to /topology
  5. Starts all 9 Python agent subprocesses
  6. Streams all output with coloured prefix tags
  7. On Ctrl+C: graceful shutdown of everything
"""
from __future__ import annotations
import asyncio
import json
import logging
import os
import subprocess
import sys
import time
from pathlib import Path

# ── Ensure we run from backend/ ──────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from agents.shared.config import AXL_PORTS, AXL_NODES_DIR, AXL_BINARY, BACKEND_ROOT

logging.basicConfig(level=logging.INFO, format="%(asctime)s [LAUNCHER] %(message)s")
logger = logging.getLogger(__name__)

# ── Terminal colours ──────────────────────────────────────────────────────────
COLOURS = {
    "client":        "\033[96m",    # cyan
    "scout_cost":    "\033[93m",    # yellow
    "scout_quality": "\033[95m",    # magenta
    "scout_speed":   "\033[94m",    # blue
    "worker_a":      "\033[92m",    # green
    "worker_b":      "\033[91m",    # red
    "worker_c":      "\033[32m",    # dark green
    "worker_d":      "\033[33m",    # orange
    "evaluator":     "\033[90m",    # grey
}
RESET = "\033[0m"

# ── Agent → Python module mapping ─────────────────────────────────────────────
AGENT_MODULES = {
    "client":        "agents.client_agent.main",
    "scout_cost":    "agents.scouts.cost_scout",
    "scout_quality": "agents.scouts.quality_scout",
    "scout_speed":   "agents.scouts.speed_scout",
    "worker_a":      "agents.workers.worker_a",
    "worker_b":      "agents.workers.worker_b",
    "worker_c":      "agents.workers.worker_c",
    "worker_d":      "agents.workers.worker_d",
    "evaluator":     "agents.evaluator.main",
}

ALL_AGENTS = list(AGENT_MODULES.keys())


# =============================================================================
# Key generation
# =============================================================================

def generate_ed25519_key_python(agent_name: str) -> Path:
    """
    Generate an ed25519 private key using Python's cryptography library.
    Saves as a PEM file compatible with AXL.
    """
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import (
        Encoding, PrivateFormat, NoEncryption
    )

    key_path = AXL_NODES_DIR / agent_name / "private.pem"
    if key_path.exists():
        logger.debug(f"Key already exists for {agent_name}")
        return key_path

    key_path.parent.mkdir(parents=True, exist_ok=True)
    private_key = Ed25519PrivateKey.generate()
    pem = private_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
    key_path.write_bytes(pem)
    logger.info(f"Generated key for {agent_name}: {key_path}")
    return key_path


# =============================================================================
# AXL config generation
# =============================================================================

def write_axl_config(agent_name: str):
    """Write node-config.json for one AXL node using correct field names."""
    ports   = AXL_PORTS[agent_name]
    cfg_dir = AXL_NODES_DIR / agent_name
    cfg_dir.mkdir(parents=True, exist_ok=True)

    # Peer list: all other agents via their TLS listen ports
    # Use absolute path for PrivateKeyPath since AXL may run from any CWD
    peers = [
        f"tls://127.0.0.1:{AXL_PORTS[other]['tls_port']}"
        for other in ALL_AGENTS
        if other != agent_name
    ]

    config = {
        # Yggdrasil settings (capital-case per docs)
        "PrivateKeyPath": str(AXL_NODES_DIR / agent_name / "private.pem"),
        "Peers":          peers,
        "Listen":         [f"tls://0.0.0.0:{ports['tls_port']}"],

        # Node settings (lowercase per docs/configuration.md)
        "api_port":  ports["api_port"],
        "tcp_port":  ports["tcp_port"],
        "bridge_addr": "127.0.0.1",
    }

    cfg_path = cfg_dir / "node-config.json"
    cfg_path.write_text(json.dumps(config, indent=2))
    logger.debug(f"AXL config written: {cfg_path} (api={ports['api_port']} tls={ports['tls_port']})")



# =============================================================================
# Process management
# =============================================================================

class ManagedProcess:
    def __init__(self, name: str, cmd: list[str], cwd: Path, colour: str):
        self.name   = name
        self.cmd    = cmd
        self.cwd    = cwd
        self.colour = colour
        self.proc: subprocess.Popen | None = None

    def start(self):
        self.proc = subprocess.Popen(
            self.cmd,
            cwd=str(self.cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        logger.info(f"Started {self.name} (PID {self.proc.pid})")

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
            logger.info(f"Stopped {self.name}")

    def is_alive(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    async def stream_output(self):
        """Stream stdout lines with a coloured prefix."""
        if not self.proc:
            return
        loop = asyncio.get_event_loop()
        while self.is_alive():
            line = await loop.run_in_executor(None, self.proc.stdout.readline)
            if not line:
                break
            print(f"{self.colour}[{self.name:15s}]{RESET} {line}", end="")


# =============================================================================
# AXL readiness check
# =============================================================================

async def wait_for_axl_node(agent_name: str, retries: int = 40, delay: float = 1.0) -> bool:
    """Poll the AXL node's /topology until it responds."""
    import httpx
    api_port = AXL_PORTS[agent_name]["api_port"]
    url      = f"http://127.0.0.1:{api_port}/topology"
    async with httpx.AsyncClient() as client:
        for i in range(retries):
            try:
                resp = await client.get(url, timeout=3.0)
                if resp.status_code == 200:
                    logger.info(f"AXL node ready: {agent_name} (api:{api_port})")
                    return True
            except Exception:
                pass
            await asyncio.sleep(delay)
    logger.error(f"AXL node never ready: {agent_name} (api:{api_port})")
    return False


# =============================================================================
# Main
# =============================================================================

async def main():
    # Force UTF-8 output on Windows
    import sys, io
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    print("\n" + "=" * 60)
    print("  [HiveBid] Agent Network Starting")
    print("=" * 60 + "\n")

    if not AXL_BINARY.exists():
        logger.error(
            f"AXL binary not found at {AXL_BINARY}\n"
            "Build it first:\n"
            "  cd backend/axl-src\n"
            "  go build -o ../axl/node.exe ./cmd/node/"
        )
        sys.exit(1)

    # ── Phase 1: Keys & configs ───────────────────────────────────────────────
    print("[docs] Generating keys and AXL configs...")
    for agent in ALL_AGENTS:
        generate_ed25519_key_python(agent)
        write_axl_config(agent)
    print("   OK Keys and configs ready\n")

    axl_procs:    list[ManagedProcess] = []
    agent_procs:  list[ManagedProcess] = []

    try:
        # ── Phase 2: Start AXL nodes ──────────────────────────────────────────
        print("[link] Starting AXL nodes...")
        for agent in ALL_AGENTS:
            colour  = COLOURS.get(agent, "")
            cfg_path = AXL_NODES_DIR / agent / "node-config.json"
            proc = ManagedProcess(
                name   = f"axl:{agent}",
                cmd    = [str(AXL_BINARY), "-config", str(cfg_path)],
                cwd    = BACKEND_ROOT,
                colour = colour,
            )
            proc.start()
            axl_procs.append(proc)

        # ── Phase 3: Wait for all AXL nodes ──────────────────────────────────
        print("[wait] Waiting for AXL nodes to be ready...")
        ready_checks = await asyncio.gather(
            *[wait_for_axl_node(agent) for agent in ALL_AGENTS]
        )
        if not all(ready_checks):
            failed = [a for a, r in zip(ALL_AGENTS, ready_checks) if not r]
            logger.error(f"Some AXL nodes failed to start: {failed}")
            sys.exit(1)
        print("   OK All AXL nodes ready\n")

        # ── Phase 4: Print peer table ─────────────────────────────────────────
        import httpx
        print("[net] Peer ID Table:")
        async with httpx.AsyncClient() as client:
            for agent in ALL_AGENTS:
                api_port = AXL_PORTS[agent]["api_port"]
                tls_port = AXL_PORTS[agent]["tls_port"]
                try:
                    resp = await client.get(f"http://127.0.0.1:{api_port}/topology", timeout=3.0)
                    topo = resp.json()
                    # Per docs: our_public_key is the peer ID
                    peer_id = topo.get("our_public_key", "???")[:16] + "..."
                except Exception:
                    peer_id = "???"
                colour = COLOURS.get(agent, "")
                print(f"  {colour}{agent:20s}{RESET}  api={api_port}  tls={tls_port}  peer={peer_id}")
        print()

        # ── Phase 5: Start Python agents ──────────────────────────────────────
        print("[bot] Starting agent processes...")
        python_exe = sys.executable
        for agent, module in AGENT_MODULES.items():
            colour = COLOURS.get(agent, "")
            proc = ManagedProcess(
                name   = agent,
                cmd    = [python_exe, "-m", module],
                cwd    = BACKEND_ROOT,
                colour = colour,
            )
            proc.start()
            agent_procs.append(proc)
            await asyncio.sleep(0.3)   # stagger starts

        print("   OK All agents started\n")
        print("=" * 60)
        print("  [hive]  HiveBid is LIVE")
        print(f"  WebSocket : ws://localhost:8765")
        print(f"  REST API  : http://localhost:8766")
        print(f"  Health    : http://localhost:8766/health")
        print("  Press Ctrl+C to stop")
        print("=" * 60 + "\n")

        # ── Phase 6: Stream all output ────────────────────────────────────────
        stream_tasks = [
            asyncio.create_task(p.stream_output())
            for p in axl_procs + agent_procs
        ]

        # Monitor process health
        while True:
            await asyncio.sleep(5)
            dead = [p.name for p in agent_procs if not p.is_alive()]
            if dead:
                logger.warning(f"Agent(s) died: {dead}")

    except KeyboardInterrupt:
        print("\n\n[stop] Shutting down HiveBid...")
    finally:
        for p in reversed(agent_procs):
            p.stop()
        await asyncio.sleep(1)
        for p in reversed(axl_procs):
            p.stop()
        print("   OK Shutdown complete\n")


if __name__ == "__main__":
    asyncio.run(main())
