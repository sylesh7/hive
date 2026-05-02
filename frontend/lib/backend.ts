/**
 * HiveBid Backend Client
 *
 * Single source of truth for all frontend ↔ backend communication.
 * - WebSocket (ws://localhost:8765) for real-time event streaming
 * - REST (http://localhost:8766) for commands
 *
 * Usage:
 *   import { backend } from "@/lib/backend"
 *   backend.on("NEW_BID", handler)
 *   const task = await backend.postTask({...})
 */

const WS_URL   = "ws://localhost:8765"
const REST_URL = "http://localhost:8766"

type EventHandler = (data: unknown) => void

class BackendClient {
  private ws: WebSocket | null = null
  private listeners = new Map<string, Set<EventHandler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _connected = false

  // ── WebSocket ────────────────────────────────────────────────────────────

  connect() {
    if (typeof window === "undefined") return   // SSR guard
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return

    try {
      this.ws = new WebSocket(WS_URL)

      this.ws.onopen = () => {
        this._connected = true
        this._emit("WS_CONNECTED", {})
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
      }

      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          // Backend sends either { event, data } (push) or { response } (reply)
          if (msg.event) this._emit(msg.event, msg.data)
        } catch {/* ignore malformed */}
      }

      this.ws.onclose = () => {
        this._connected = false
        this._emit("WS_DISCONNECTED", {})
        // Reconnect after 3s
        this.reconnectTimer = setTimeout(() => this.connect(), 3000)
      }

      this.ws.onerror = () => {
        this._connected = false
        this._emit("WS_ERROR", {})
      }
    } catch {
      // Backend not running — schedule retry
      this.reconnectTimer = setTimeout(() => this.connect(), 3000)
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  get isConnected() { return this._connected }

  // ── Event bus ─────────────────────────────────────────────────────────────

  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
    return () => this.listeners.get(event)?.delete(handler)
  }

  private _emit(event: string, data: unknown) {
    this.listeners.get(event)?.forEach(h => h(data))
    // Also emit a wildcard "*" event
    this.listeners.get("*")?.forEach(h => h({ event, data }))
  }

  // ── REST helpers ──────────────────────────────────────────────────────────

  private async _post(path: string, body?: object) {
    const res = await fetch(`${REST_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`Backend error ${res.status}: ${await res.text()}`)
    return res.json()
  }

  private async _get(path: string) {
    const res = await fetch(`${REST_URL}${path}`)
    if (!res.ok) throw new Error(`Backend error ${res.status}: ${await res.text()}`)
    return res.json()
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  /** Health check — returns true if backend is reachable */
  async ping(): Promise<boolean> {
    try {
      await this._get("/health")
      return true
    } catch { return false }
  }

  /** Post a new task. Returns the created task record. */
  async postTask(spec: {
    title: string
    description: string
    task_type: string
    max_budget_usdc: number
    auction_window_secs: number
    deliverable_spec?: object
    required_capabilities?: string[]
  }) {
    return this._post("/task", {
      action: "CREATE_TASK",
      ...spec,
      deadline_unix: Date.now() / 1000 + 3600,
    })
  }

  /** Accept a bid using a scout strategy recommendation. */
  async acceptBid(taskId: string, strategy?: "cost" | "quality" | "speed") {
    return this._post(`/task/${taskId}/accept`, { strategy })
  }

  /** Cancel an in-progress auction. */
  async cancelAuction(taskId: string) {
    return this._post(`/task/${taskId}/cancel`, {})
  }

  /** Fetch all tasks (active + history). */
  async getTasks(): Promise<{ active: TaskRecord[]; history: TaskRecord[] }> {
    return this._get("/tasks")
  }

  /** Fetch a single task by ID. */
  async getTask(taskId: string): Promise<TaskRecord> {
    return this._get(`/task/${taskId}`)
  }

  /** Get backend status (peer IDs, active tasks, etc.). */
  async getStatus() {
    return this._post("/task", { action: "GET_STATUS" })
  }
}

// ── Shared types (mirrors backend message_types.py) ───────────────────────────

export interface Bid {
  type: "BID"
  task_id: string
  bid_price_usdc: number
  delivery_time_secs: number
  worker_peer_id: string
  worker_identity_nft_id: string
  worker_wallet: string
  worker_name: string
  worker_reputation_score: number
  capabilities: string[]
  signature: string
  timestamp: number
}

export interface ScoutRecommendation {
  task_id: string
  strategy: "cost" | "quality" | "speed"
  top_bid: Bid
  ranked_bids: Bid[]
  reason: string
}

export interface TaskRecord {
  task_id: string
  state: string
  spec: {
    title: string
    description: string
    task_type: string
    max_budget_usdc: number
    auction_window_secs: number
  }
  bids: Bid[]
  scout_recommendations: Record<string, Bid>
  auction_start: number
  auction_end: number
  winning_bid: Bid | null
  escrow_tx_hash: string
  release_tx_hash: string
  refund_tx_hash: string
  delivery: Record<string, unknown> | null
  verdict: string
  verdict_reason: string
  created_at: number
  updated_at: number
}

export interface WorkerStatus {
  task_id: string
  status: string
  progress_pct: number
  message: string
  worker_peer_id: string
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const backend = new BackendClient()
