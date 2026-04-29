# HiveBid — Backend Agent System

> **Person A** — Agents, AXL P2P Network, ERC-8004 Identity, Groq LLM workers

## Architecture

```
9 AXL nodes (Go binary, one per agent, ports 9002–9010)
  + Client Agent     — task lifecycle, WebSocket server for frontend
  + 3 Scout Agents   — Cost / Quality / Speed bid ranking
  + 4 Worker Agents  — BrandCraft / CodeAudit Pro / ResearchBot / SwiftTask
  + 1 Evaluator      — deterministic delivery verification
```

All agents communicate peer-to-peer over AXL. No central server.

## Prerequisites

- Python 3.11+ (`python --version`)
- Go 1.25+ (for AXL binary, already built)
- Funded Base Sepolia wallet (get test ETH: https://www.alchemy.com/faucets/base-sepolia)
- Groq API key: https://console.groq.com

## Setup

### 1. Copy and fill in .env

```powershell
Copy-Item .env.example .env
# Edit .env with your actual keys
```

Required values:
```
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
CLIENT_WALLET_PRIVATE_KEY=0xYOUR_KEY
GROQ_API_KEY=gsk_your_key
```

### 2. Build AXL binary (if needed)

```powershell
cd axl-src
$env:GOTOOLCHAIN="go1.25.9"
go build -o ../axl/node.exe ./cmd/node/
cd ..
```

### 3. Install Python dependencies

```powershell
pip install -r requirements.txt
```

### 4. Start everything

```powershell
python start.py
```

This single command:
- Generates ed25519 keys for all 9 agents (first run only)
- Writes AXL node configs
- Starts 9 AXL nodes (ports 9002–9010)
- Waits for all nodes to be ready
- Starts all 9 Python agent processes
- Streams all output with colour-coded prefixes

## WebSocket API (for Person B / Frontend)

Connect to `ws://localhost:8765`

### Events pushed from server → frontend

| Event | Payload |
|---|---|
| `AGENT_READY` | `{peer_id}` |
| `TASK_CREATED` | `{task, auction_end, peer_count}` |
| `NEW_BID` | `{task_id, bid}` |
| `SCOUT_UPDATE` | `{task_id, strategy, top_bid, reason}` |
| `AUCTION_CLOSED` | `{task_id, winning_bid}` |
| `ESCROW_PENDING` | `{task_id}` |
| `ESCROW_LOCKED` | `{task_id, tx_hash, amount}` |
| `WORKER_STATUS` | `{task_id, status, progress_pct, message}` |
| `DELIVERY_RECEIVED` | `{task_id, delivery}` |
| `EVALUATING` | `{task_id}` |
| `EVALUATION_VERDICT` | `{task_id, verdict, reason}` |
| `PAYMENT_RELEASED` | `{task_id, tx_hash, amount, worker}` |
| `PAYMENT_REFUNDED` | `{task_id, tx_hash, reason}` |
| `REPUTATION_UPDATED` | `{task_id, score, tx_hash}` |
| `ERROR` | `{task_id, error}` |

### Commands sent from frontend → server (via WS or REST)

**Create a task (POST http://localhost:8766/task)**
```json
{
  "title": "Design a logo for HiveBid",
  "description": "...",
  "task_type": "logo_design",
  "max_budget_usdc": 50.0,
  "deadline_unix": 1714321200,
  "auction_window_secs": 90,
  "deliverable_spec": {"format": "SVG", "dimensions": "512x512"}
}
```

**Accept a bid (POST http://localhost:8766/task/{task_id}/accept)**
```json
{ "strategy": "cost" }
```

**Cancel auction (POST http://localhost:8766/task/{task_id}/cancel)**
```json
{}
```

**Get all tasks (GET http://localhost:8766/tasks)**

## Agent Personalities

| Agent | Name | Reputation | Start Bid | Speciality |
|---|---|---|---|---|
| worker_a | BrandCraft | 4.6 ⭐ | 75% of budget | Logo design, content |
| worker_b | CodeAudit Pro | 4.8 ⭐ | 85% of budget | Code audits (premium) |
| worker_c | ResearchBot | 4.2 ⭐ | 70% of budget | Research, content |
| worker_d | SwiftTask | 3.9 ⭐ | 60% of budget | Everything (aggressive) |

## On-Chain Integration

- **Network**: Base Sepolia (Chain ID: 84532)
- **ERC-8004 Identity**: `0x8004AA63c570c570eBF15376c0dB199918BFe9Fb`
- **ERC-8004 Reputation**: `0x8004bd8daB57f14Ed299135749a5CB5c42d341BF`
- Agents register their identity on first boot (client agent only)
- Reputation feedback written to chain after each settled task
- All other chain interactions (escrow) handled by Person B via KeeperHub

## KeeperHub Integration Point (Person B)

Replace the stub in `agents/client_agent/keeperhub_stub.py`:

```python
async def lock_escrow(task_id, amount_usdc, worker_wallet) -> str:
    # TODO: Person B replaces with real KeeperHub MCP call
    ...

async def release_payment(task_id, worker_wallet, amount_usdc) -> str:
    # TODO: Person B replaces with real KeeperHub MCP call
    ...
```

## Directory Structure

```
backend/
├── agents/
│   ├── shared/          # Config, AXL client, messages, crypto, ERC-8004
│   ├── client_agent/    # Main orchestrator + WebSocket server
│   ├── scouts/          # Cost / Quality / Speed scouts
│   ├── workers/         # BrandCraft / CodeAudit Pro / ResearchBot / SwiftTask
│   └── evaluator/       # Delivery verification + verdict signing
├── axl/                 # AXL binary (node.exe)
├── axl-src/             # AXL Go source (for rebuilding)
├── axl_nodes/           # Per-agent AXL configs and ed25519 keys
├── tasks/               # Persisted task JSON records
├── start.py             # Master launcher
├── requirements.txt
└── .env.example
```
