"""
Task lifecycle state machine.

States:
  CREATED → BROADCASTING → AUCTION_OPEN → AUCTION_CLOSED
  → ESCROW_PENDING → ESCROW_LOCKED → DELIVERY_PENDING
  → DELIVERY_RECEIVED → EVALUATING → SETTLED | REFUNDED | CANCELLED
"""
from __future__ import annotations
import asyncio
import json
import logging
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Any

from ..shared.config import TASKS_DIR
from ..shared.message_types import TaskAnnouncement, Bid, Delivery, EvaluationVerdict

logger = logging.getLogger(__name__)


class TaskState(str, Enum):
    CREATED           = "CREATED"
    BROADCASTING      = "BROADCASTING"
    AUCTION_OPEN      = "AUCTION_OPEN"
    AUCTION_CLOSED    = "AUCTION_CLOSED"
    ESCROW_PENDING    = "ESCROW_PENDING"
    ESCROW_LOCKED     = "ESCROW_LOCKED"
    DELIVERY_PENDING  = "DELIVERY_PENDING"
    DELIVERY_RECEIVED = "DELIVERY_RECEIVED"
    EVALUATING        = "EVALUATING"
    SETTLED           = "SETTLED"
    REFUNDED          = "REFUNDED"
    CANCELLED         = "CANCELLED"


@dataclass
class TaskRecord:
    task_id: str
    state: str = TaskState.CREATED
    spec: dict = field(default_factory=dict)

    # Auction
    bids: list[dict] = field(default_factory=list)
    scout_recommendations: dict = field(default_factory=dict)  # strategy → bid dict
    auction_start: float = 0.0
    auction_end: float = 0.0

    # Settlement
    winning_bid: dict | None = None
    escrow_tx_hash: str = ""
    release_tx_hash: str = ""
    refund_tx_hash: str = ""

    # Delivery
    delivery: dict | None = None

    # Evaluation
    verdict: str = ""
    verdict_reason: str = ""

    # Meta
    worker_nft_id: str = ""
    reputation_tx_hash: str = ""
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        d = asdict(self)
        return d

    def save(self):
        TASKS_DIR.mkdir(parents=True, exist_ok=True)
        path = TASKS_DIR / f"{self.task_id}.json"
        path.write_text(json.dumps(self.to_dict(), indent=2))

    @classmethod
    def load(cls, task_id: str) -> "TaskRecord | None":
        path = TASKS_DIR / f"{task_id}.json"
        if not path.exists():
            return None
        data = json.loads(path.read_text())
        return cls(**data)

    @classmethod
    def load_all(cls) -> list["TaskRecord"]:
        TASKS_DIR.mkdir(parents=True, exist_ok=True)
        records = []
        for p in sorted(TASKS_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
            try:
                records.append(cls(**json.loads(p.read_text())))
            except Exception as e:
                logger.warning(f"Could not load task {p}: {e}")
        return records


class TaskManager:
    """Manages all task records and state transitions."""

    def __init__(self):
        self._tasks: dict[str, TaskRecord] = {}
        self._load_existing()

    def _load_existing(self):
        for rec in TaskRecord.load_all():
            self._tasks[rec.task_id] = rec
        logger.info(f"TaskManager loaded {len(self._tasks)} existing tasks")

    def create_task(self, spec: dict) -> TaskRecord:
        from ..shared.message_types import _uid
        task_id = spec.get("task_id") or _uid()
        spec["task_id"] = task_id
        rec = TaskRecord(task_id=task_id, spec=spec, state=TaskState.CREATED)
        self._tasks[task_id] = rec
        rec.save()
        logger.info(f"Task created: {task_id}")
        return rec

    def get(self, task_id: str) -> TaskRecord | None:
        return self._tasks.get(task_id)

    def list_active(self) -> list[TaskRecord]:
        terminal = {TaskState.SETTLED, TaskState.REFUNDED, TaskState.CANCELLED}
        return [t for t in self._tasks.values() if t.state not in terminal]

    def list_history(self) -> list[TaskRecord]:
        terminal = {TaskState.SETTLED, TaskState.REFUNDED, TaskState.CANCELLED}
        return [t for t in self._tasks.values() if t.state in terminal]

    def transition(self, task_id: str, new_state: TaskState, **updates) -> TaskRecord | None:
        rec = self._tasks.get(task_id)
        if not rec:
            logger.warning(f"transition: task {task_id} not found")
            return None
        rec.state = new_state
        rec.updated_at = time.time()
        for k, v in updates.items():
            if hasattr(rec, k):
                setattr(rec, k, v)
        rec.save()
        logger.info(f"Task {task_id}: → {new_state}")
        return rec

    def add_bid(self, task_id: str, bid: dict) -> TaskRecord | None:
        rec = self._tasks.get(task_id)
        if not rec:
            return None
        # Deduplicate / update: same worker may re-bid lower
        worker_id = bid.get("worker_peer_id", "")
        existing = next((b for b in rec.bids if b.get("worker_peer_id") == worker_id), None)
        if existing:
            rec.bids.remove(existing)
        rec.bids.append(bid)
        rec.updated_at = time.time()
        rec.save()
        return rec

    def set_scout_recommendation(self, task_id: str, strategy: str, bid: dict):
        rec = self._tasks.get(task_id)
        if rec:
            rec.scout_recommendations[strategy] = bid
            rec.updated_at = time.time()
            rec.save()
