"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { PageShell } from "@/components/page-shell"
import { useBackendStore } from "@/context/backend-store"
import { backend, type Bid, type ScoutRecommendation } from "@/lib/backend"

function formatTime(secs: number): string {
  if (secs <= 0) return "0:00"
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`
}
function formatEta(secs: number): string {
  return secs < 3600 ? `${Math.round(secs / 60)}m` : `${(secs / 3600).toFixed(1)}h`
}

function ScoutCard({ strategy, rec, onAccept, accepting }: {
  strategy: "cost" | "quality" | "speed"
  rec: ScoutRecommendation | undefined
  onAccept: (s: "cost" | "quality" | "speed") => void
  accepting: string | null
}) {
  const labels = { cost:"Cost Scout", quality:"Quality Scout", speed:"Speed Scout" }
  const tags   = { cost:"CHEAPEST",   quality:"BEST REP",      speed:"FASTEST" }
  const border = { cost:"border-amber-500/30 bg-amber-500/5", quality:"border-blue-500/30 bg-blue-500/5", speed:"border-purple-500/30 bg-purple-500/5" }
  const dot    = { cost:"bg-amber-400", quality:"bg-blue-400", speed:"bg-purple-400" }
  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-4 ${border[strategy]}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className={`w-2 h-2 rounded-full mb-2 ${dot[strategy]}`} />
          <div className="text-[9px] font-mono text-white/35 tracking-widest">{tags[strategy]}</div>
          <div className="text-sm font-light text-white/90 mt-0.5">{labels[strategy]}</div>
        </div>
        {rec && <div className="text-right"><div className="text-2xl font-light font-mono text-white">{rec.top_bid.bid_price_usdc.toFixed(2)}</div><div className="text-[9px] font-mono text-white/35">USDC</div></div>}
      </div>
      {rec ? (
        <>
          <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3 space-y-2">
            {[
              { k:"WORKER", v: rec.top_bid.worker_name },
              { k:"REP", v: `${rec.top_bid.worker_reputation_score}/100` },
              { k:"ETA", v: formatEta(rec.top_bid.delivery_time_secs) },
            ].map(r=>(
              <div key={r.k} className="flex justify-between text-[10px] font-mono">
                <span className="text-white/40">{r.k}</span><span className="text-white/70">{r.v}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/40 leading-relaxed">{rec.reason}</p>
          <button onClick={()=>onAccept(strategy)} disabled={!!accepting}
            className="w-full py-2.5 rounded-xl bg-white text-[#0B0B09] text-[11px] font-mono font-medium tracking-widest hover:bg-white/90 transition-colors disabled:opacity-50">
            {accepting===strategy ? "LOCKING ESCROW…" : "ACCEPT THIS BID →"}
          </button>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-6">
          <div className="text-center">
            <div className="w-5 h-5 rounded-full border border-white/20 border-t-white/60 animate-spin mx-auto mb-2" />
            <div className="text-[10px] font-mono text-white/30">Awaiting bids…</div>
          </div>
        </div>
      )}
    </div>
  )
}

function BidRow({ bid, rank }: { bid: Bid; rank: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02] transition-colors">
      <span className="text-[10px] font-mono text-white/25 w-5 shrink-0">#{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-light text-white/85">{bid.worker_name}</div>
        <div className="text-[10px] font-mono text-white/35 mt-0.5">ETA {formatEta(bid.delivery_time_secs)} · rep {bid.worker_reputation_score}/100</div>
      </div>
      <div className="text-base font-mono text-white/80 shrink-0">{bid.bid_price_usdc.toFixed(2)} USDC</div>
    </div>
  )
}

export default function AuctionPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const taskId = params.id
  const { activeTasks, taskBids, taskScouts } = useBackendStore()
  const task   = activeTasks.find(t => t.task_id === taskId)
  const bids   = taskBids[taskId]  ?? []
  const scouts = taskScouts[taskId] ?? []
  const [timeLeft, setTimeLeft]   = useState(0)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [escrowTx, setEscrowTx]   = useState<string | null>(null)

  useEffect(() => {
    if (!task) return
    const update = () => setTimeLeft(Math.max(0, Math.round(task.auction_end - Date.now() / 1000)))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [task])

  const handleAccept = useCallback(async (strategy: "cost" | "quality" | "speed") => {
    setAccepting(strategy)
    try {
      const r = await backend.acceptBid(taskId, strategy)
      setEscrowTx(r?.escrow_tx_hash ?? r?.tx_hash ?? "pending")
      setTimeout(() => router.push(`/tasks/${taskId}/delivery`), 2500)
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`)
      setAccepting(null)
    }
  }, [taskId, router])

  const scoutMap: Record<string, ScoutRecommendation> = {}
  scouts.forEach(r => { scoutMap[r.strategy] = r })

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-24 pb-20">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-white/40 text-[10px] font-mono tracking-widest mb-1">LIVE AUCTION</div>
            <h1 className="text-2xl font-light tracking-tight" style={{ fontFamily:'"IBM Plex Sans", sans-serif' }}>
              {task?.spec.title ?? "Loading…"}
            </h1>
            <div className="text-white/35 text-xs font-mono mt-1">
              {task?.spec.task_type?.replace(/_/g," ").toUpperCase()} · max {task?.spec.max_budget_usdc ?? "—"} USDC
            </div>
          </div>
          <div className={`rounded-2xl border px-6 py-4 text-center shrink-0 ${timeLeft===0 ? "border-white/[0.08]" : "border-amber-500/30 bg-amber-500/[0.06]"}`}>
            <div className="text-[9px] font-mono text-white/40 tracking-widest mb-1">{timeLeft===0 ? "CLOSED" : "CLOSES IN"}</div>
            <div className={`text-3xl font-light font-mono ${timeLeft===0 ? "text-white/40" : "text-amber-300"}`}>{timeLeft===0 ? "—:——" : formatTime(timeLeft)}</div>
            <div className="text-[9px] font-mono text-white/30 mt-1">{bids.length} bid{bids.length!==1?"s":""}</div>
          </div>
        </div>

        {escrowTx && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div>
              <p className="text-sm font-light text-emerald-300">Escrow locked — redirecting to delivery tracking…</p>
              {escrowTx!=="pending" && <p className="text-[10px] font-mono text-emerald-400/60 mt-0.5">tx: {escrowTx.slice(0,24)}…</p>}
            </div>
          </div>
        )}

        {!task ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-12 text-center">
            <p className="text-white/40 text-sm mb-4">Task not found. It may have already closed.</p>
            <button onClick={()=>router.push("/dashboard")} className="text-[10px] font-mono text-white/40 hover:text-white/60 tracking-widest">← DASHBOARD</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Scout panels */}
            <div className="lg:col-span-4 flex flex-col gap-3">
              <div className="text-[10px] font-mono text-white/40 tracking-widest">SCOUT RECOMMENDATIONS</div>
              {(["cost","quality","speed"] as const).map(s=>(
                <ScoutCard key={s} strategy={s} rec={scoutMap[s]} onAccept={handleAccept} accepting={accepting} />
              ))}
            </div>

            {/* Bid feed + spec */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="rounded-2xl border border-white/[0.12] bg-[#111110] overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-white/[0.07] flex items-center justify-between">
                  <div className="text-[10px] font-mono text-white/40 tracking-widest">LIVE BID FEED</div>
                  {bids.length > 0 && <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/><span className="text-[9px] font-mono text-amber-300/70">LIVE</span></div>}
                </div>
                {bids.length===0 ? (
                  <div className="p-16 text-center">
                    <div className="w-6 h-6 rounded-full border border-white/20 border-t-amber-400/60 animate-spin mx-auto mb-3" />
                    <p className="text-white/30 text-sm">Waiting for worker agents to discover task…</p>
                    <p className="text-[10px] font-mono text-white/20 mt-2">May take up to 30 seconds</p>
                  </div>
                ) : bids.map((bid,i)=>(<BidRow key={bid.worker_peer_id} bid={bid} rank={i+1} />))}
              </div>

              <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5">
                <div className="text-[10px] font-mono text-white/40 tracking-widest mb-3">DELIVERABLE SPEC</div>
                <p className="text-sm text-white/60 leading-relaxed">{task.spec.description ?? "No spec provided."}</p>
              </div>

              <div className="flex gap-4">
                {!escrowTx && !accepting && (
                  <button onClick={()=>backend.cancelAuction(taskId).then(()=>router.push("/dashboard"))}
                    className="text-[10px] font-mono text-white/25 hover:text-red-400/60 transition-colors tracking-widest">
                    CANCEL AUCTION
                  </button>
                )}
                <button onClick={()=>router.push("/dashboard")} className="text-[10px] font-mono text-white/25 hover:text-white/50 transition-colors tracking-widest">← DASHBOARD</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
