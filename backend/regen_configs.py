"""Regenerate AXL node configs with tcp_port=7000 for all nodes."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from agents.shared.config import AXL_PORTS, AXL_NODES_DIR

ALL_AGENTS = list(AXL_PORTS.keys())

for agent_name in ALL_AGENTS:
    ports = AXL_PORTS[agent_name]
    cfg_dir = AXL_NODES_DIR / agent_name
    cfg_dir.mkdir(parents=True, exist_ok=True)

    peers = [
        "tls://127.0.0.1:{}".format(AXL_PORTS[other]["tls_port"])
        for other in ALL_AGENTS
        if other != agent_name
    ]

    config = {
        "PrivateKeyPath": str(AXL_NODES_DIR / agent_name / "private.pem"),
        "Peers": peers,
        "Listen": ["tls://0.0.0.0:{}".format(ports["tls_port"])],
        "api_port": ports["api_port"],
        "tcp_port": ports["tcp_port"],
        "bridge_addr": "127.0.0.1",
    }

    cfg_path = cfg_dir / "node-config.json"
    cfg_path.write_text(json.dumps(config, indent=2))
    print("Written {}: api={} tls={} tcp={}".format(
        agent_name, ports["api_port"], ports["tls_port"], ports["tcp_port"]))

print("All 9 AXL configs regenerated with tcp_port=7000!")
