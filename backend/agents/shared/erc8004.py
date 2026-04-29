"""
ERC-8004 on-chain identity and reputation integration.

Contracts (Base Sepolia):
  Identity Registry  : 0x8004AA63c570c570eBF15376c0dB199918BFe9Fb
  Reputation Registry: 0x8004bd8daB57f14Ed299135749a5CB5c42d341BF
"""
from __future__ import annotations
import json
import logging
from typing import Any

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
from eth_account import Account

from .config import (
    BASE_SEPOLIA_RPC_URL,
    BASE_SEPOLIA_CHAIN_ID,
    ERC8004_IDENTITY_ADDRESS,
    ERC8004_REPUTATION_ADDRESS,
    CLIENT_WALLET_PRIVATE_KEY,
)

logger = logging.getLogger(__name__)

# ── Minimal ABIs ──────────────────────────────────────────────────────────────

IDENTITY_ABI = json.loads("""[
  {
    "name": "registerAgent",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {"name": "name",         "type": "string"},
      {"name": "metadataURI",  "type": "string"},
      {"name": "capabilities", "type": "string[]"}
    ],
    "outputs": [{"name": "tokenId", "type": "uint256"}]
  },
  {
    "name": "getAgent",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{"name": "tokenId", "type": "uint256"}],
    "outputs": [
      {"name": "owner",        "type": "address"},
      {"name": "name",         "type": "string"},
      {"name": "metadataURI",  "type": "string"},
      {"name": "capabilities", "type": "string[]"},
      {"name": "registeredAt", "type": "uint256"}
    ]
  },
  {
    "name": "ownerOf",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{"name": "tokenId", "type": "uint256"}],
    "outputs": [{"name": "", "type": "address"}]
  },
  {
    "name": "AgentRegistered",
    "type": "event",
    "inputs": [
      {"name": "tokenId",  "type": "uint256", "indexed": true},
      {"name": "owner",    "type": "address",  "indexed": true},
      {"name": "name",     "type": "string",   "indexed": false}
    ]
  }
]""")

REPUTATION_ABI = json.loads("""[
  {
    "name": "submitFeedback",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {"name": "agentTokenId", "type": "uint256"},
      {"name": "score",        "type": "uint8"},
      {"name": "tags",         "type": "string[]"},
      {"name": "evidenceURL",  "type": "string"}
    ],
    "outputs": []
  },
  {
    "name": "getFeedback",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{"name": "agentTokenId", "type": "uint256"}],
    "outputs": [
      {
        "name": "feedbackList",
        "type": "tuple[]",
        "components": [
          {"name": "reviewer",    "type": "address"},
          {"name": "score",       "type": "uint8"},
          {"name": "tags",        "type": "string[]"},
          {"name": "evidenceURL", "type": "string"},
          {"name": "timestamp",   "type": "uint256"}
        ]
      }
    ]
  },
  {
    "name": "getAverageScore",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{"name": "agentTokenId", "type": "uint256"}],
    "outputs": [{"name": "avgScore", "type": "uint256"}]
  }
]""")


# ── Client ────────────────────────────────────────────────────────────────────

class ERC8004Client:
    """
    Wraps ERC-8004 Identity and Reputation registries on Base Sepolia.
    """

    def __init__(self, private_key: str | None = None):
        self.w3 = Web3(Web3.HTTPProvider(BASE_SEPOLIA_RPC_URL))
        self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        pk = private_key or CLIENT_WALLET_PRIVATE_KEY
        if pk and pk.startswith("0x"):
            self.account = Account.from_key(pk)
        else:
            self.account = None
            logger.warning("ERC8004Client: no wallet key — read-only mode")

        self.identity = self.w3.eth.contract(
            address=Web3.to_checksum_address(ERC8004_IDENTITY_ADDRESS),
            abi=IDENTITY_ABI,
        )
        self.reputation = self.w3.eth.contract(
            address=Web3.to_checksum_address(ERC8004_REPUTATION_ADDRESS),
            abi=REPUTATION_ABI,
        )

    def _send_tx(self, fn, value: int = 0) -> str:
        """Build, sign and send a transaction. Returns tx hash."""
        if not self.account:
            raise RuntimeError("No wallet configured — cannot send transactions")

        nonce = self.w3.eth.get_transaction_count(self.account.address)
        gas_price = self.w3.eth.gas_price

        tx = fn.build_transaction({
            "chainId":  BASE_SEPOLIA_CHAIN_ID,
            "from":     self.account.address,
            "nonce":    nonce,
            "gasPrice": gas_price,
            "value":    value,
        })
        tx["gas"] = self.w3.eth.estimate_gas(tx)

        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        logger.info(f"ERC8004 tx confirmed: {tx_hash.hex()} block={receipt.blockNumber}")
        return tx_hash.hex()

    # ── Identity ──────────────────────────────────────────────────────────────

    def register_agent(
        self,
        name: str,
        metadata_uri: str,
        capabilities: list[str],
    ) -> tuple[str, int]:
        """
        Mint an ERC-8004 identity NFT for an agent.

        Returns:
            (tx_hash, token_id)
        """
        logger.info(f"Registering agent '{name}' on ERC-8004…")
        fn = self.identity.functions.registerAgent(name, metadata_uri, capabilities)
        tx_hash = self._send_tx(fn)

        # Parse token ID from AgentRegistered event logs
        receipt = self.w3.eth.get_transaction_receipt(tx_hash)
        token_id = 0
        try:
            logs = self.identity.events.AgentRegistered().process_receipt(receipt)
            if logs:
                token_id = logs[0]["args"]["tokenId"]
        except Exception as e:
            logger.warning(f"Could not parse tokenId from logs: {e}")

        logger.info(f"Agent '{name}' registered — tokenId={token_id}")
        return tx_hash, token_id

    def get_agent(self, token_id: int) -> dict:
        """Fetch agent identity data by token ID."""
        try:
            result = self.identity.functions.getAgent(token_id).call()
            return {
                "owner":        result[0],
                "name":         result[1],
                "metadata_uri": result[2],
                "capabilities": result[3],
                "registered_at": result[4],
            }
        except Exception as e:
            logger.error(f"getAgent({token_id}) failed: {e}")
            return {}

    # ── Reputation ────────────────────────────────────────────────────────────

    def submit_feedback(
        self,
        agent_token_id: int,
        score: int,          # 1–5
        tags: list[str],
        evidence_url: str,
    ) -> str:
        """Write signed feedback to the Reputation Registry. Returns tx hash."""
        score_clamped = max(1, min(5, score))
        fn = self.reputation.functions.submitFeedback(
            agent_token_id, score_clamped, tags, evidence_url
        )
        return self._send_tx(fn)

    def get_feedback(self, agent_token_id: int) -> list[dict]:
        """Read all feedback for an agent."""
        try:
            raw = self.reputation.functions.getFeedback(agent_token_id).call()
            return [
                {
                    "reviewer":     entry[0],
                    "score":        entry[1],
                    "tags":         entry[2],
                    "evidence_url": entry[3],
                    "timestamp":    entry[4],
                }
                for entry in raw
            ]
        except Exception as e:
            logger.error(f"getFeedback({agent_token_id}) failed: {e}")
            return []

    def get_average_score(self, agent_token_id: int) -> float:
        """Return the on-chain average reputation score (1.0–5.0 scale)."""
        try:
            raw = self.reputation.functions.getAverageScore(agent_token_id).call()
            # Contract returns score × 100 for precision (e.g. 480 = 4.80)
            return raw / 100.0 if raw > 10 else float(raw)
        except Exception as e:
            logger.warning(f"getAverageScore({agent_token_id}) failed: {e}")
            return 0.0
