"""
Dataclasses for every message type in the HiveBid agent-to-agent protocol.
All messages travel over AXL as JSON.
"""
from __future__ import annotations
import time
import uuid
from dataclasses import dataclass, field, asdict
from typing import Any


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now() -> float:
    return time.time()

def _uid() -> str:
    return str(uuid.uuid4())


# ── Base ──────────────────────────────────────────────────────────────────────

@dataclass
class BaseMessage:
    type: str
    timestamp: float = field(default_factory=_now)

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "BaseMessage":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


# ── Task Announcement ─────────────────────────────────────────────────────────

@dataclass
class TaskAnnouncement(BaseMessage):
    type: str = "TASK_ANNOUNCEMENT"
    task_id: str = field(default_factory=_uid)
    title: str = ""
    description: str = ""
    task_type: str = ""           # logo_design | code_audit | research_report | content_writing | other
    max_budget_usdc: float = 0.0
    deadline_unix: float = 0.0
    auction_window_secs: int = 90
    deliverable_spec: dict = field(default_factory=dict)
    client_peer_id: str = ""
    required_capabilities: list = field(default_factory=list)


# ── Bid ──────────────────────────────────────────────────────────────────────

@dataclass
class Bid(BaseMessage):
    type: str = "BID"
    task_id: str = ""
    bid_price_usdc: float = 0.0
    delivery_time_secs: int = 300
    worker_peer_id: str = ""
    worker_identity_nft_id: str = ""
    worker_wallet: str = ""
    worker_name: str = ""
    worker_reputation_score: float = 4.0
    capabilities: list = field(default_factory=list)
    signature: str = ""


# ── Bid Accepted ─────────────────────────────────────────────────────────────

@dataclass
class BidAccepted(BaseMessage):
    type: str = "BID_ACCEPTED"
    task_id: str = ""
    agreed_price_usdc: float = 0.0
    worker_peer_id: str = ""
    escrow_tx_hash: str = ""


# ── Bid Rejected ─────────────────────────────────────────────────────────────

@dataclass
class BidRejected(BaseMessage):
    type: str = "BID_REJECTED"
    task_id: str = ""
    worker_peer_id: str = ""
    reason: str = ""


# ── Worker Status ─────────────────────────────────────────────────────────────

@dataclass
class WorkerStatus(BaseMessage):
    type: str = "WORKER_STATUS"
    task_id: str = ""
    status: str = "started"      # started | in_progress | completed
    progress_pct: int = 0
    message: str = ""
    worker_peer_id: str = ""


# ── Delivery ─────────────────────────────────────────────────────────────────

@dataclass
class Delivery(BaseMessage):
    type: str = "DELIVERY"
    task_id: str = ""
    deliverable_ref: str = ""    # IPFS CID or URL
    deliverable_hash: str = ""   # sha256 hex
    deliverable_content: str = ""  # inline content for demo
    worker_peer_id: str = ""
    signature: str = ""


# ── Evaluation Verdict ────────────────────────────────────────────────────────

@dataclass
class EvaluationVerdict(BaseMessage):
    type: str = "EVALUATION_VERDICT"
    task_id: str = ""
    verdict: str = "PASS"        # PASS | FAIL
    reason: str = ""
    evaluator_peer_id: str = ""
    signature: str = ""


# ── Scout Recommendation ──────────────────────────────────────────────────────

@dataclass
class ScoutRecommendation(BaseMessage):
    type: str = "SCOUT_RECOMMENDATION"
    task_id: str = ""
    strategy: str = ""           # cost | quality | speed
    top_bid: dict = field(default_factory=dict)
    ranked_bids: list = field(default_factory=list)
    reason: str = ""
    scout_peer_id: str = ""


# ── Bid Forward (client → scouts) ────────────────────────────────────────────

@dataclass
class BidForward(BaseMessage):
    type: str = "BID_FORWARD"
    task_id: str = ""
    bid: dict = field(default_factory=dict)
    task_spec: dict = field(default_factory=dict)


# ── Registry ─────────────────────────────────────────────────────────────────

MSG_TYPES: dict[str, type] = {
    "TASK_ANNOUNCEMENT":   TaskAnnouncement,
    "BID":                 Bid,
    "BID_ACCEPTED":        BidAccepted,
    "BID_REJECTED":        BidRejected,
    "WORKER_STATUS":       WorkerStatus,
    "DELIVERY":            Delivery,
    "EVALUATION_VERDICT":  EvaluationVerdict,
    "SCOUT_RECOMMENDATION": ScoutRecommendation,
    "BID_FORWARD":         BidForward,
}


def parse_message(d: dict) -> BaseMessage:
    """Parse a raw dict into a typed message object."""
    msg_type = d.get("type", "")
    cls = MSG_TYPES.get(msg_type, BaseMessage)
    valid_fields = cls.__dataclass_fields__.keys()
    return cls(**{k: v for k, v in d.items() if k in valid_fields})
