"use client"

/**
 * BackendStore — React context that holds all live state from the backend.
 *
 * Connects the backend WebSocket singleton, listens to all events,
 * and exposes a typed store that any page/component can consume.
 */

import {
  createContext, useContext, useEffect, useState, useRef,
  useCallback, type ReactNode,
} from "react"
import { backend, type TaskRecord, type Bid, type ScoutRecommendation, type WorkerStatus } from "@/lib/backend"

// ── Types ──────────────────────────────────────────────────────────────────────

interface AgentEvent {
  event: string
  data: unknown
  ts: number
}

interface BackendStoreValue {
  connected: boolean
  backendOnline: boolean
  activeTasks: TaskRecord[]
  historyTasks: TaskRecord[]
  events: AgentEvent[]       // last 100 events for the live feed
  taskBids: Record<string, Bid[]>
  taskScouts: Record<string, ScoutRecommendation[]>
  taskWorkerStatus: Record<string, WorkerStatus>
  refresh: () => Promise<void>
}

const BackendStoreContext = createContext<BackendStoreValue>({
  connected: false,
  backendOnline: false,
  activeTasks: [],
  historyTasks: [],
  events: [],
  taskBids: {},
  taskScouts: {},
  taskWorkerStatus: {},
  refresh: async () => {},
})

export function useBackendStore() {
  return useContext(BackendStoreContext)
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function BackendStoreProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected]         = useState(false)
  const [backendOnline, setBackendOnline] = useState(false)
  const [activeTasks, setActiveTasks]     = useState<TaskRecord[]>([])
  const [historyTasks, setHistoryTasks]   = useState<TaskRecord[]>([])
  const [events, setEvents]               = useState<AgentEvent[]>([])
  const [taskBids, setTaskBids]           = useState<Record<string, Bid[]>>({})
  const [taskScouts, setTaskScouts]       = useState<Record<string, ScoutRecommendation[]>>({})
  const [taskWorkerStatus, setTaskWorkerStatus] = useState<Record<string, WorkerStatus>>({})
  const mounted = useRef(true)

  const pushEvent = useCallback((event: string, data: unknown) => {
    setEvents(prev => [{ event, data, ts: Date.now() }, ...prev].slice(0, 100))
  }, [])

  // Load all tasks from backend REST
  const refresh = useCallback(async () => {
    try {
      const result = await backend.getTasks()
      if (!mounted.current) return
      setBackendOnline(true)
      setActiveTasks(result.active ?? [])
      setHistoryTasks(result.history ?? [])
      // Seed bids + scout recs from REST response (covers missed WS events)
      setTaskBids(prev => {
        const next = { ...prev }
        for (const task of [...(result.active ?? []), ...(result.history ?? [])]) {
          if (task.bids && task.bids.length > 0) {
            const existing = prev[task.task_id] ?? []
            const merged = [...existing]
            for (const b of task.bids) {
              if (!merged.some(x => x.worker_peer_id === b.worker_peer_id && x.bid_price_usdc <= b.bid_price_usdc)) {
                merged.push(b)
              }
            }
            next[task.task_id] = merged.sort((a, b) => a.bid_price_usdc - b.bid_price_usdc)
          }
        }
        return next
      })
      setTaskScouts(prev => {
        const next = { ...prev }
        for (const task of [...(result.active ?? []), ...(result.history ?? [])]) {
          if (task.scout_recommendations && Object.keys(task.scout_recommendations).length > 0) {
            const recs = Object.entries(task.scout_recommendations).map(([strategy, top_bid]) => ({
              task_id: task.task_id,
              strategy: strategy as "cost" | "quality" | "speed",
              top_bid: top_bid as Bid,
              ranked_bids: [],
              reason: "",
            }))
            next[task.task_id] = recs
          }
        }
        return next
      })
    } catch {
      setBackendOnline(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    backend.connect()

    // ── WebSocket state ────────────────────────────────────────────────────
    const offConn = backend.on("WS_CONNECTED", () => {
      setConnected(true)
      setBackendOnline(true)
      refresh()
    })
    const offDisc = backend.on("WS_DISCONNECTED", () => setConnected(false))
    const offErr  = backend.on("WS_ERROR", () => setConnected(false))

    // ── Auction events ─────────────────────────────────────────────────────
    const offBid = backend.on("NEW_BID", (raw) => {
      // Backend sends: { task_id, bid: { ...bid fields } }
      const envelope = raw as { task_id?: string; bid?: Bid }
      const taskId   = envelope.task_id ?? (raw as Bid).task_id
      const bid      = envelope.bid ?? (raw as Bid)
      if (!taskId || !bid) return
      pushEvent("NEW_BID", { taskId, bid })
      setTaskBids(prev => {
        const existing = prev[taskId] ?? []
        const others = existing.filter(b => b.worker_peer_id !== bid.worker_peer_id)
        return { ...prev, [taskId]: [...others, bid].sort((a, b) => a.bid_price_usdc - b.bid_price_usdc) }
      })
    })

    const offScout = backend.on("SCOUT_UPDATE", (raw) => {
      // Backend sends: { task_id, strategy, top_bid, reason, ranked_bids? }
      const d = raw as { task_id?: string; strategy?: string; top_bid?: Bid; reason?: string }
      const taskId = d.task_id
      if (!taskId || !d.strategy || !d.top_bid) return
      const rec: ScoutRecommendation = {
        task_id:     taskId,
        strategy:    d.strategy as "cost" | "quality" | "speed",
        top_bid:     d.top_bid,
        ranked_bids: [],
        reason:      d.reason ?? "",
      }
      pushEvent("SCOUT_UPDATE", rec)
      setTaskScouts(prev => {
        const existing = (prev[taskId] ?? []).filter(r => r.strategy !== rec.strategy)
        return { ...prev, [taskId]: [...existing, rec] }
      })
    })

    const offAuctionEnd = backend.on("AUCTION_CLOSED", (raw) => {
      pushEvent("AUCTION_CLOSED", raw)
      refresh()
    })

    // When a new worker comes online mid-auction, refresh task list
    const offPeerReg = backend.on("PEER_REGISTERED", (raw) => {
      pushEvent("PEER_REGISTERED", raw)
      refresh()
    })

    // ── Task lifecycle events ──────────────────────────────────────────────
    const offTaskCreated  = backend.on("TASK_CREATED",  (d) => { pushEvent("TASK_CREATED",  d); refresh() })
    const offTaskAccepted = backend.on("TASK_ACCEPTED", (d) => { pushEvent("TASK_ACCEPTED", d); refresh() })
    const offEscrowLocked = backend.on("ESCROW_LOCKED", (d) => { pushEvent("ESCROW_LOCKED", d); refresh() })

    // ── Worker delivery events ─────────────────────────────────────────────
    const offWorkerStatus = backend.on("WORKER_STATUS", (raw) => {
      const ws = raw as WorkerStatus
      pushEvent("WORKER_STATUS", ws)
      setTaskWorkerStatus(prev => ({ ...prev, [ws.task_id]: ws }))
    })

    const offDelivery  = backend.on("DELIVERY_RECEIVED",  (d) => { pushEvent("DELIVERY_RECEIVED",  d); refresh() })
    const offVerdict   = backend.on("EVALUATION_VERDICT", (d) => { pushEvent("EVALUATION_VERDICT", d); refresh() })
    const offReleased  = backend.on("PAYMENT_RELEASED",   (d) => { pushEvent("PAYMENT_RELEASED",   d); refresh() })
    const offRefunded  = backend.on("PAYMENT_REFUNDED",   (d) => { pushEvent("PAYMENT_REFUNDED",   d); refresh() })

    // Initial load attempt (even if WS not connected yet)
    refresh()

    return () => {
      mounted.current = false
      offConn(); offDisc(); offErr()
      offBid(); offScout(); offAuctionEnd(); offPeerReg()
      offTaskCreated(); offTaskAccepted(); offEscrowLocked()
      offWorkerStatus(); offDelivery(); offVerdict(); offReleased(); offRefunded()
    }
  }, [refresh, pushEvent])

  return (
    <BackendStoreContext.Provider value={{
      connected, backendOnline,
      activeTasks, historyTasks,
      events, taskBids, taskScouts, taskWorkerStatus,
      refresh,
    }}>
      {children}
    </BackendStoreContext.Provider>
  )
}
