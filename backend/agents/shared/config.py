"""
Shared configuration for all HiveBid agents.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend/ root
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_ENV_PATH)

# ── Paths ─────────────────────────────────────────────────────────────────────
BACKEND_ROOT = Path(__file__).resolve().parents[2]
AXL_NODES_DIR = BACKEND_ROOT / "axl_nodes"
TASKS_DIR = BACKEND_ROOT / "tasks"
AXL_BINARY = BACKEND_ROOT / os.getenv("AXL_BINARY_PATH", "axl/node.exe")

# ── Network ───────────────────────────────────────────────────────────────────
BASE_SEPOLIA_RPC_URL = os.getenv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org")
BASE_SEPOLIA_CHAIN_ID = 84532

# ── ERC-8004 Contract Addresses (Base Sepolia) ────────────────────────────────
ERC8004_IDENTITY_ADDRESS  = "0x8004AA63c570c570eBF15376c0dB199918BFe9Fb"
ERC8004_REPUTATION_ADDRESS = "0x8004bd8daB57f14Ed299135749a5CB5c42d341BF"

# ── Wallets ───────────────────────────────────────────────────────────────────
CLIENT_WALLET_PRIVATE_KEY = os.getenv("CLIENT_WALLET_PRIVATE_KEY", "")
# Ethereum key used by evaluator to sign verdicts for the escrow contract.
# Defaults to the client key for demo — use a separate key in production.
EVALUATOR_PRIVATE_KEY = os.getenv("EVALUATOR_PRIVATE_KEY", CLIENT_WALLET_PRIVATE_KEY)

# ── Contracts ─────────────────────────────────────────────────────────────────
ESCROW_ADDRESS = os.getenv("ESCROW_ADDRESS", "")
# Base Sepolia USDC (Circle): https://developers.circle.com/developer/docs/usdc-on-testnet
USDC_ADDRESS   = os.getenv("USDC_ADDRESS", "0x036CbD53842c5426634e7929541eC2318f3dCF7e")

# ── Groq ─────────────────────────────────────────────────────────────────────
GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL    = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# ── AXL node ports ────────────────────────────────────────────────────────────
# api_port  = HTTP API port (Python agent talks to this)
# tls_port  = P2P listen port (AXL nodes peer with each other over TLS)
# tcp_port  = gVisor TCP port: ALL nodes MUST use the same value (7000).
#             DialPeerConnection dials [remote_ygg_ipv6]:tcp_port using the
#             SENDER's tcp_port, so sender and receiver must agree on this port.
AXL_PORTS = {
    "client":        {"api_port": 9002, "tls_port": 9102, "tcp_port": 7000},
    "scout_cost":    {"api_port": 9012, "tls_port": 9112, "tcp_port": 7000},
    "scout_quality": {"api_port": 9013, "tls_port": 9113, "tcp_port": 7000},
    "scout_speed":   {"api_port": 9014, "tls_port": 9114, "tcp_port": 7000},
    "worker_a":      {"api_port": 9015, "tls_port": 9115, "tcp_port": 7000},
    "worker_b":      {"api_port": 9016, "tls_port": 9116, "tcp_port": 7000},
    "worker_c":      {"api_port": 9017, "tls_port": 9117, "tcp_port": 7000},
    "worker_d":      {"api_port": 9018, "tls_port": 9118, "tcp_port": 7000},
    "evaluator":     {"api_port": 9019, "tls_port": 9119, "tcp_port": 7000},
}

# ── WebSocket / REST ──────────────────────────────────────────────────────────
WS_PORT            = int(os.getenv("WS_PORT", "8765"))
REST_PORT          = int(os.getenv("REST_PORT", "8766"))
EVALUATOR_HTTP_PORT = int(os.getenv("EVALUATOR_HTTP_PORT", "9500"))

# ── Auction ───────────────────────────────────────────────────────────────────
DEFAULT_AUCTION_WINDOW_SECS = int(os.getenv("DEFAULT_AUCTION_WINDOW_SECS", "90"))

# ── AXL peer-to-peer config helpers ──────────────────────────────────────────
def axl_base_url(agent_name: str) -> str:
    """HTTP API base URL for a given agent's AXL node."""
    return f"http://127.0.0.1:{AXL_PORTS[agent_name]['api_port']}"

def axl_tls_url(agent_name: str) -> str:
    """TLS peer address for a given agent's AXL node (used in Peers list)."""
    return f"tls://127.0.0.1:{AXL_PORTS[agent_name]['tls_port']}"

def axl_config_path(agent_name: str) -> Path:
    return AXL_NODES_DIR / agent_name / "node-config.json"

def axl_key_path(agent_name: str) -> Path:
    return AXL_NODES_DIR / agent_name / "private.pem"
