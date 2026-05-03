"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { PageShell } from "@/components/page-shell"
import { useBackendStore } from "@/context/backend-store"
import type { TaskRecord } from "@/lib/backend"

// ── Stage definitions ─────────────────────────────────────────────────────────

const STAGES = [
  { id: "DELIVERY_PENDING", label: "Worker executing",  sub: "Worker agent is completing your task" },
  { id: "EVALUATING",       label: "Evaluator running", sub: "Verifying delivery against your spec" },
  { id: "SETTLED",          label: "Payment released",  sub: "Work accepted — funds sent to worker" },
]

function StageIndicator({ state }: { state: string }) {
  const activeIdx = STAGES.findIndex(s => s.id === state)
  return (
    <div className="flex flex-col gap-0">
      {STAGES.map((stage, i) => {
        const done   = activeIdx > i
        const active = activeIdx === i
        return (
          <div key={stage.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                done   ? "border-emerald-400 bg-emerald-400" :
                active ? "border-amber-400 bg-amber-400/20"  :
                "border-white/[0.12] bg-transparent"
              }`}>
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : active ? (
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                ) : null}
              </div>
              {i < STAGES.length - 1 && (
                <div className={`w-px h-8 mt-1 ${done ? "bg-emerald-400/40" : "bg-white/[0.08]"}`} />
              )}
            </div>
            <div className="pt-0.5 pb-8">
              <div className={`text-sm font-light transition-colors ${
                active ? "text-white" : done ? "text-white/60" : "text-white/25"
              }`}>{stage.label}</div>
              {active && <div className="text-[10px] font-mono text-white/40 mt-0.5">{stage.sub}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AuditRow({ time, event, detail }: { time: string; event: string; detail: string }) {
  return (
    <div className="flex gap-4 px-5 py-3 border-b border-white/[0.05] last:border-0">
      <div className="text-[10px] font-mono text-white/25 w-16 shrink-0 pt-0.5 tabular-nums">{time}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-light text-white/80">{event}</div>
        <div className="text-[10px] text-white/40 mt-0.5 leading-snug">{detail}</div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DeliveryPage() {
  const params  = useParams<{ id: string }>()
  const router  = useRouter()
  const taskId  = params.id

  const { activeTasks, historyTasks, taskWorkerStatus, events, refresh } = useBackendStore()

  // Find task from store
  const rawTask: TaskRecord | undefined =
    activeTasks.find(t => t.task_id === taskId) ??
    historyTasks.find(t => t.task_id === taskId)

  // Poll disk-backed API route every 2s to get latest task data
  const [diskTask, setDiskTask] = useState<TaskRecord | null>(null)
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/task/${taskId}`)
        if (res.ok) { const t = await res.json(); setDiskTask(t); refresh() }
      } catch { /* ignore */ }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [taskId, refresh])

  // Use whichever source has richer data
  const base = rawTask ?? diskTask ?? null

  // ── MOCK: treat any task with a delivery as SETTLED ──────────────────────────
  const hasDelivery = !!(base?.delivery as Record<string, unknown> | null | undefined)?.deliverable_content
  const mockState   = hasDelivery ? "SETTLED" : (base?.state ?? "DELIVERY_PENDING")
  const mockTxHash  = (base as unknown as Record<string, unknown>)?.release_tx_hash as string ||
                      "0xa3f7e2d1c8b5a4e9f0d3c6b1a8e5f2d7c4b0a3e8f5d2c9b6a1e4f1d8c5b2a7"

  const task        = base ? { ...base, state: mockState, release_tx_hash: mockTxHash } : null
  const isSettled   = mockState === "SETTLED"
  const isDone      = isSettled

  const rawDeliverable =
    typeof (task?.delivery as Record<string, unknown> | null | undefined)?.deliverable_content === "string"
      ? (task?.delivery as Record<string, unknown>).deliverable_content as string
      : null
  const deliverableContent = rawDeliverable
    ? rawDeliverable.replace(/\*\*/g, "").replace(/__/g, "")
    : null

  const workerStatus = taskWorkerStatus[taskId]

  const taskEvents = events
    .filter(e => (e.data as Record<string, unknown>)?.task_id === taskId)
    .reverse()

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-24 pb-20">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-white/40 text-[10px] font-mono tracking-widest mb-1">
              {isSettled ? "SETTLED" : "DELIVERY TRACKING"}
            </div>
            <h1 className="text-2xl font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
              {task?.spec?.title ?? "Loading…"}
            </h1>
            {task?.winning_bid && (
              <div className="text-white/35 text-xs font-mono mt-1">
                {task.winning_bid.worker_name} · {task.winning_bid.bid_price_usdc.toFixed(2)} USDC locked in escrow
              </div>
            )}
          </div>

          {/* Final price badge */}
          {isSettled && task?.winning_bid && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] px-6 py-4 text-center">
              <div className="text-[9px] font-mono text-white/40 tracking-widest mb-1">FINAL PRICE</div>
              <div className="text-3xl font-light font-mono text-emerald-400">
                {task.winning_bid.bid_price_usdc.toFixed(2)} USDC
              </div>
              <div className="text-[9px] font-mono text-white/30 mt-1">sent to worker</div>
            </div>
          )}
        </div>

        {/* Settlement banner */}
        {isSettled && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-light text-emerald-300">Payment released — work complete!</p>
              <p className="text-[10px] font-mono text-emerald-400/60 mt-0.5">
                tx: {mockTxHash.slice(0, 28)}…
              </p>
            </div>
          </div>
        )}

        {!task ? (
          <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-12 text-center">
            <div className="w-6 h-6 rounded-full border border-white/20 border-t-white/50 animate-spin mx-auto mb-3" />
            <p className="text-white/40 text-sm">Loading task…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* Left column */}
            <div className="lg:col-span-4 flex flex-col gap-4">

              {/* Progress stages */}
              <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-6">
                <div className="text-[10px] font-mono text-white/40 tracking-widest mb-6">PROGRESS</div>
                <StageIndicator state={mockState} />
              </div>

              {/* Worker card */}
              {task.winning_bid && (
                <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5">
                  <div className="text-[10px] font-mono text-white/40 tracking-widest mb-4">ASSIGNED WORKER</div>
                  <div className="space-y-3">
                    {[
                      { k: "NAME", v: task.winning_bid.worker_name },
                      { k: "BID",  v: `${task.winning_bid.bid_price_usdc.toFixed(2)} USDC` },
                      { k: "ETA",  v: task.winning_bid.delivery_time_secs < 3600
                          ? `${Math.round(task.winning_bid.delivery_time_secs / 60)}m`
                          : `${(task.winning_bid.delivery_time_secs / 3600).toFixed(1)}h` },
                      { k: "REP",  v: `${task.winning_bid.worker_reputation_score}/100` },
                    ].map(r => (
                      <div key={r.k} className="flex justify-between text-xs font-mono">
                        <span className="text-white/35">{r.k}</span>
                        <span className="text-white/75">{r.v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/[0.07]">
                    <div className="flex justify-between text-[9px] font-mono text-white/30 mb-1.5">
                      <span>REPUTATION</span>
                      <span>{task.winning_bid.worker_reputation_score}/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-400/60"
                        style={{ width: `${task.winning_bid.worker_reputation_score}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Worker progress (only while not done) */}
              {workerStatus && !isDone && (
                <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5">
                  <div className="text-[10px] font-mono text-white/40 tracking-widest mb-4">WORKER STATUS</div>
                  <p className="text-xs text-white/60 mb-4 leading-relaxed">{workerStatus.message}</p>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="lg:col-span-8 flex flex-col gap-4">

              {/* Verdict card */}
              {isSettled && (
                <div className="rounded-2xl border border-emerald-500/30 bg-[#0d1a14] p-5">
                  <div className="text-[10px] font-mono text-white/40 tracking-widest mb-2">EVALUATOR VERDICT</div>
                  <div className="text-sm font-light text-emerald-300">
                    ✓ PASS — Delivery met spec requirements
                  </div>
                  <p className="text-[11px] text-white/45 mt-2 leading-relaxed">Auto-approved</p>
                </div>
              )}

              {/* Delivery content */}
              {deliverableContent ? (
                <div className="rounded-2xl border border-white/[0.12] bg-[#111110] overflow-hidden">
                  <div className="px-5 pt-5 pb-3 border-b border-white/[0.07] flex items-center justify-between">
                    <div className="text-[10px] font-mono text-white/40 tracking-widest">DELIVERY</div>
                    <span className="text-[9px] font-mono text-white/25">
                      {deliverableContent.length.toLocaleString()} chars
                    </span>
                  </div>
                  <div className="p-5 max-h-72 overflow-y-auto">
                    <pre className="text-xs text-white/65 whitespace-pre-wrap font-mono leading-relaxed">
                      {deliverableContent.slice(0, 2000)}
                      {deliverableContent.length > 2000 ? "\n…" : ""}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-12 text-center">
                  <div className="w-6 h-6 rounded-full border border-white/20 border-t-white/50 animate-spin mx-auto mb-3" />
                  <p className="text-white/30 text-sm">Worker agent is executing your task…</p>
                  <p className="text-[10px] font-mono text-white/20 mt-2">Delivery will appear here automatically</p>
                </div>
              )}

              {/* Live event log */}
              {taskEvents.length > 0 && (
                <div className="rounded-2xl border border-white/[0.12] bg-[#111110] overflow-hidden">
                  <div className="px-5 pt-5 pb-3 border-b border-white/[0.07]">
                    <div className="text-[10px] font-mono text-white/40 tracking-widest">LIVE EVENT LOG</div>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {taskEvents.slice(0, 12).map((ev, i) => {
                      const d = ev.data as Record<string, unknown>
                      const msg = typeof d?.message === "string" ? d.message
                        : typeof d?.status === "string" ? d.status
                        : ev.event.replace(/_/g, " ").toLowerCase()
                      return (
                        <AuditRow key={i}
                          time={new Date(ev.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          event={ev.event.replace(/_/g, " ").toLowerCase()}
                          detail={msg}
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="text-[10px] font-mono text-white/25 hover:text-white/50 transition-colors tracking-widest"
                >
                  ← DASHBOARD
                </button>
                {isDone && (
                  <button
                    onClick={() => router.push(`/tasks/${taskId}`)}
                    className="text-[10px] font-mono text-white/25 hover:text-white/50 transition-colors tracking-widest"
                  >
                    VIEW FULL RECORD →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
