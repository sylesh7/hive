"use client"

import { useParams, useRouter } from "next/navigation"
import { PageShell } from "@/components/page-shell"
import { useBackendStore } from "@/context/backend-store"
import type { TaskRecord } from "@/lib/backend"

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-xs font-mono py-2.5 border-b border-white/[0.06] last:border-0 gap-4">
      <span className="text-white/40 shrink-0">{label}</span>
      <span className={`text-right break-all ${highlight ? "text-emerald-400" : "text-white/75"}`}>{value}</span>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    SETTLED:   "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    REFUNDED:  "bg-white/10 text-white/50 border-white/20",
    CANCELLED: "bg-white/10 text-white/40 border-white/15",
    EVALUATING:"bg-purple-500/20 text-purple-300 border-purple-500/40",
    DELIVERY_PENDING:"bg-blue-500/20 text-blue-300 border-blue-500/40",
    AUCTION_OPEN:"bg-amber-500/20 text-amber-300 border-amber-500/40",
  }
  const labels: Record<string, string> = {
    SETTLED:"SETTLED", REFUNDED:"REFUNDED", CANCELLED:"CANCELLED",
    EVALUATING:"EVALUATING", DELIVERY_PENDING:"DELIVERING", AUCTION_OPEN:"LIVE",
  }
  return (
    <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono tracking-widest ${map[status] ?? "bg-white/10 text-white/50 border-white/20"}`}>
      {labels[status] ?? status}
    </span>
  )
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const taskId = params.id
  const { activeTasks, historyTasks } = useBackendStore()
  const task: TaskRecord | undefined =
    activeTasks.find(t => t.task_id === taskId) ??
    historyTasks.find(t => t.task_id === taskId)

  const isSettled  = task?.state === "SETTLED"
  const isRefunded = task?.state === "REFUNDED"
  const delivery   = task?.delivery as Record<string, unknown> | null | undefined
  const content    = typeof delivery?.deliverable_content === "string" ? delivery.deliverable_content : null
  const savings    = task?.winning_bid
    ? Math.max(0, (task.spec.max_budget_usdc ?? 0) - task.winning_bid.bid_price_usdc).toFixed(2)
    : null

  if (!task) {
    return (
      <PageShell>
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
          <p className="text-white/40 text-sm mb-4">Task not found.</p>
          <button onClick={() => router.push("/dashboard")}
            className="text-[10px] font-mono text-white/40 hover:text-white/60 tracking-widest transition-colors">
            ← DASHBOARD
          </button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-24 pb-20">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-white/40 text-[10px] font-mono tracking-widest mb-1">TASK DETAIL</div>
            <h1 className="text-2xl font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
              {task.spec.title}
            </h1>
            <div className="text-white/35 text-xs font-mono mt-1">
              {task.spec.task_type?.replace(/_/g, " ").toUpperCase()} · {new Date(task.created_at * 1000).toLocaleString()}
            </div>
          </div>
          <StatusPill status={task.state} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Left column */}
          <div className="lg:col-span-7 flex flex-col gap-4">

            {/* Spec */}
            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-6">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-3">DELIVERABLE SPEC</div>
              <p className="text-sm text-white/70 leading-relaxed">{task.spec.description ?? "No description provided."}</p>
            </div>

            {/* Verdict banner */}
            {(isSettled || isRefunded) && (
              <div className={`rounded-2xl border p-5 ${isSettled ? "border-emerald-500/30 bg-[#0d1a14]" : "border-white/[0.12] bg-[#111110]"}`}>
                <div className="text-[10px] font-mono text-white/40 tracking-widest mb-2">EVALUATOR VERDICT</div>
                <div className={`text-sm font-light mb-1 ${isSettled ? "text-emerald-300" : "text-white/60"}`}>
                  {isSettled ? "✓ PASS — Delivery met spec requirements" : "✗ FAIL — Delivery did not meet spec requirements"}
                </div>
                {task.verdict_reason && (
                  <p className="text-[11px] text-white/45 leading-relaxed">{task.verdict_reason}</p>
                )}
              </div>
            )}

            {/* Deliverable content */}
            {content && (
              <div className="rounded-2xl border border-white/[0.12] bg-[#111110] overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-white/[0.07] flex items-center justify-between">
                  <div className="text-[10px] font-mono text-white/40 tracking-widest">DELIVERABLE</div>
                  <span className="text-[9px] font-mono text-white/25">{content.length.toLocaleString()} chars</span>
                </div>
                <div className="p-5 max-h-72 overflow-y-auto">
                  <pre className="text-xs text-white/65 whitespace-pre-wrap font-mono leading-relaxed">
                    {content.slice(0, 3000)}{content.length > 3000 ? "\n…" : ""}
                  </pre>
                </div>
              </div>
            )}

            {/* On-chain hashes */}
            {(task.escrow_tx_hash || task.release_tx_hash || task.refund_tx_hash) && (
              <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5">
                <div className="text-[10px] font-mono text-white/40 tracking-widest mb-3">ON-CHAIN TRANSACTIONS</div>
                {task.escrow_tx_hash  && <Row label="ESCROW"  value={task.escrow_tx_hash} />}
                {task.release_tx_hash && <Row label="RELEASE" value={task.release_tx_hash} highlight />}
                {task.refund_tx_hash  && <Row label="REFUND"  value={task.refund_tx_hash} />}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            {/* Financials */}
            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-4">FINANCIALS</div>
              <Row label="BUDGET CAP"   value={`${task.spec.max_budget_usdc} USDC`} />
              {task.winning_bid && (
                <>
                  <Row label="FINAL PRICE" value={`${task.winning_bid.bid_price_usdc.toFixed(2)} USDC`} highlight />
                  {savings && Number(savings) > 0 && <Row label="SAVED" value={`${savings} USDC`} />}
                </>
              )}
              <Row label="BIDS RECEIVED" value={String(task.bids?.length ?? 0)} />
              <Row label="NETWORK"       value="Base Sepolia" />
            </div>

            {/* Worker */}
            {task.winning_bid && (
              <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5">
                <div className="text-[10px] font-mono text-white/40 tracking-widest mb-4">ASSIGNED WORKER</div>
                <Row label="NAME"     value={task.winning_bid.worker_name} />
                <Row label="WALLET"   value={task.winning_bid.worker_wallet || "—"} />
                <Row label="ETA"      value={task.winning_bid.delivery_time_secs < 3600
                  ? `${Math.round(task.winning_bid.delivery_time_secs / 60)}m`
                  : `${(task.winning_bid.delivery_time_secs / 3600).toFixed(1)}h`} />
                <div className="mt-4 pt-3 border-t border-white/[0.06]">
                  <div className="flex justify-between text-[9px] font-mono text-white/30 mb-1.5">
                    <span>REPUTATION</span>
                    <span>{task.winning_bid.worker_reputation_score}/100</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-400/60" style={{ width: `${task.winning_bid.worker_reputation_score}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex flex-col gap-2">
              {(task.state === "AUCTION_OPEN" || task.state === "BROADCASTING") && (
                <button onClick={() => router.push(`/tasks/${taskId}/auction`)}
                  className="w-full py-2.5 rounded-xl bg-white text-[#0B0B09] text-[11px] font-mono font-medium tracking-widest hover:bg-white/90 transition-colors">
                  VIEW LIVE AUCTION →
                </button>
              )}
              {["DELIVERY_PENDING","DELIVERY_RECEIVED","EVALUATING"].includes(task.state) && (
                <button onClick={() => router.push(`/tasks/${taskId}/delivery`)}
                  className="w-full py-2.5 rounded-xl bg-white text-[#0B0B09] text-[11px] font-mono font-medium tracking-widest hover:bg-white/90 transition-colors">
                  TRACK DELIVERY →
                </button>
              )}
              <button onClick={() => router.push("/dashboard")}
                className="w-full py-2.5 rounded-xl border border-white/[0.10] text-xs font-mono text-white/40 hover:text-white/60 hover:border-white/20 transition-all tracking-widest">
                ← DASHBOARD
              </button>
            </div>

          </div>
        </div>
      </div>
    </PageShell>
  )
}
