"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"

// ─── Types ────────────────────────────────────────────────────────────────────
type MilestoneStatus = "done" | "active" | "pending"

interface Milestone {
  id: string
  label: string
  detail: string
  status: MilestoneStatus
  time?: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_TASK = {
  title: "Audit smart contract",
  worker: "AuditAgent",
  amount: 28,
  eta: "45 min",
  dueAt: Date.now() + 38 * 60 * 1000,
}

const INITIAL_MILESTONES: Milestone[] = [
  { id: "m1", label: "Bid accepted",        detail: "Escrow locked · 28 USDC",                   status: "done",    time: "Just now" },
  { id: "m2", label: "Worker acknowledged", detail: "AuditAgent confirmed task receipt",           status: "done",    time: "0:12 ago" },
  { id: "m3", label: "Work in progress",    detail: "Worker is actively processing your spec",     status: "active" },
  { id: "m4", label: "Delivery submitted",  detail: "Worker uploads deliverable to IPFS",          status: "pending" },
  { id: "m5", label: "Evaluator reviewing", detail: "Your scout agent checks output against spec", status: "pending" },
  { id: "m6", label: "Settled",             detail: "Escrow released · reputation updated",        status: "pending" },
]

// ─── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(endsAt: number) {
  const [msLeft, setMsLeft] = useState(endsAt - Date.now())
  useEffect(() => {
    const id = setInterval(() => setMsLeft(endsAt - Date.now()), 1000)
    return () => clearInterval(id)
  }, [endsAt])
  const total = Math.max(0, msLeft)
  const mins = Math.floor(total / 60000)
  const secs = Math.floor((total % 60000) / 1000)
  return { mins, secs, done: total === 0 }
}

// ─── Timeline step ────────────────────────────────────────────────────────────
function TimelineStep({ milestone, isLast }: { milestone: Milestone; isLast: boolean }) {
  const isDone   = milestone.status === "done"
  const isActive = milestone.status === "active"

  return (
    <div className="flex gap-4">
      {/* Track */}
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
          isDone
            ? "border-emerald-500/60 bg-emerald-500/15"
            : isActive
            ? "border-white/40 bg-white/[0.08]"
            : "border-white/[0.12] bg-transparent"
        }`}>
          {isDone ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : isActive ? (
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          )}
        </div>
        {!isLast && (
          <div className={`w-px flex-1 mt-1 min-h-[24px] ${isDone ? "bg-emerald-500/25" : "bg-white/[0.06]"}`} />
        )}
      </div>

      {/* Content */}
      <div className={`pb-6 flex-1 ${isLast ? "pb-0" : ""}`}>
        <div className={`text-sm font-light leading-snug ${isDone ? "text-white/80" : isActive ? "text-white" : "text-white/30"}`}>
          {milestone.label}
        </div>
        <div className={`text-xs mt-0.5 ${isDone ? "text-white/40" : isActive ? "text-white/50" : "text-white/20"}`}>
          {milestone.detail}
        </div>
        {milestone.time && (
          <div className="text-[10px] font-mono text-white/25 mt-1">{milestone.time}</div>
        )}
        {isActive && (
          <div className="mt-2 h-1 w-32 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full bg-white/30 rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Dispute modal ────────────────────────────────────────────────────────────
function DisputeModal({ onClose }: { onClose: () => void }) {
  const [reason, setReason] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) return
    await new Promise(r => setTimeout(r, 1500))
    setSubmitted(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#0F0F0D] p-8 flex flex-col gap-6">
        {submitted ? (
          <>
            <div className="flex items-center gap-3 text-amber-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span className="text-sm font-light">Dispute raised</span>
            </div>
            <p className="text-xs text-white/40 leading-relaxed">
              Your dispute has been submitted. The escrow will be frozen until resolved. KeeperHub arbitration usually completes within 2 hours.
            </p>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-white/[0.10] text-xs font-mono text-white/50 hover:text-white/70 tracking-widest transition-colors">
              CLOSE
            </button>
          </>
        ) : (
          <>
            <div>
              <div className="text-[10px] font-mono text-white/30 tracking-widest mb-1">RAISE DISPUTE</div>
              <h2 className="text-xl font-light" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
                What's the issue?
              </h2>
            </div>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Describe why the delivery doesn't meet your spec..."
              rows={4}
              className="bg-white/[0.04] border border-white/[0.10] rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors resize-none"
            />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.10] text-xs font-mono text-white/40 hover:text-white/60 transition-all tracking-widest">
                CANCEL
              </button>
              <button onClick={handleSubmit} disabled={!reason.trim()} className="flex-1 px-4 py-2.5 rounded-xl border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest hover:bg-amber-500/10 transition-all disabled:opacity-30">
                SUBMIT →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DeliveryPage() {
  const router = useRouter()
  const params = useParams()
  const { mins, secs, done: overdue } = useCountdown(MOCK_TASK.dueAt)

  const [milestones, setMilestones] = useState<Milestone[]>(INITIAL_MILESTONES)
  const [showDispute, setShowDispute] = useState(false)

  // Simulate delivery arriving after 8 seconds
  useEffect(() => {
    const t1 = setTimeout(() => {
      setMilestones(prev => prev.map(m =>
        m.id === "m3" ? { ...m, status: "done", time: "Just now" } :
        m.id === "m4" ? { ...m, status: "active" } : m
      ))
    }, 8000)
    const t2 = setTimeout(() => {
      setMilestones(prev => prev.map(m =>
        m.id === "m4" ? { ...m, status: "done", time: "Just now", detail: "Deliverable uploaded · QmXa9…" } :
        m.id === "m5" ? { ...m, status: "active" } : m
      ))
    }, 14000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const activeStep = milestones.find(m => m.status === "active")
  const allDone = milestones.every(m => m.status === "done")

  return (
    <div className="bg-[#0B0B09] text-[#F0EFEA] min-h-screen font-sans antialiased">
      <MobileNav />

      {showDispute && <DisputeModal onClose={() => setShowDispute(false)} />}

      <div className="max-w-4xl mx-auto px-6 md:px-12 pt-28 pb-24">

        {/* Header */}
        <div className="mb-8">
          <div className="text-white/30 text-[11px] font-mono tracking-widest mb-1">DELIVERY TRACKING</div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="text-3xl font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
              {MOCK_TASK.title}
            </h1>
            <div className="flex flex-col items-end shrink-0">
              <div className={`text-[10px] font-mono tracking-widest mb-1 ${overdue ? "text-red-400/60" : "text-white/30"}`}>
                {overdue ? "OVERDUE" : "DUE IN"}
              </div>
              <div className={`text-2xl font-mono font-light tabular-nums ${overdue ? "text-red-400/80" : ""}`}>
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── LEFT: Timeline ── */}
          <div className="lg:col-span-7 flex flex-col gap-5">

            {/* Current status banner */}
            {activeStep && (
              <div className="rounded-2xl border border-white/[0.10] bg-white/[0.04] px-5 py-4 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
                <div>
                  <div className="text-sm font-light text-white/90">{activeStep.label}</div>
                  <div className="text-xs text-white/40 mt-0.5">{activeStep.detail}</div>
                </div>
              </div>
            )}

            {allDone && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] px-5 py-4 flex items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                <div>
                  <div className="text-sm font-light text-emerald-400">Task settled</div>
                  <div className="text-xs text-white/40 mt-0.5">28 USDC released · reputation updated</div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
              <div className="text-[10px] font-mono text-white/30 tracking-widest mb-6">TIMELINE</div>
              <div>
                {milestones.map((m, i) => (
                  <TimelineStep key={m.id} milestone={m} isLast={i === milestones.length - 1} />
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Info + Actions ── */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            {/* Task info */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex flex-col gap-4">
              <div className="text-[10px] font-mono text-white/30 tracking-widest">TASK INFO</div>
              <div className="space-y-3">
                {[
                  { label: "WORKER",  value: MOCK_TASK.worker },
                  { label: "LOCKED",  value: `${MOCK_TASK.amount} USDC` },
                  { label: "ETA",     value: MOCK_TASK.eta },
                  { label: "NETWORK", value: "Base Sepolia" },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-xs font-mono">
                    <span className="text-white/30">{row.label}</span>
                    <span className="text-white/60">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Evaluator note */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex flex-col gap-3">
              <div className="text-[10px] font-mono text-white/30 tracking-widest">EVALUATOR</div>
              <p className="text-xs text-white/40 leading-relaxed">
                Your scout agent will automatically check the delivered output against your spec. If it passes, escrow releases instantly. If not, you can raise a dispute.
              </p>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                <span className="text-[10px] font-mono text-white/30">Waiting for delivery</span>
              </div>
            </div>

            {/* Actions */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex flex-col gap-3">
              <div className="text-[10px] font-mono text-white/30 tracking-widest">ACTIONS</div>

              <button
                onClick={() => setShowDispute(true)}
                className="w-full py-2.5 rounded-xl border border-amber-500/20 text-xs font-mono text-amber-400/60 hover:text-amber-400 hover:border-amber-500/40 transition-all tracking-widest"
              >
                RAISE DISPUTE
              </button>

              <button
                onClick={() => router.push("/dashboard")}
                className="w-full py-2.5 rounded-xl border border-white/[0.08] text-xs font-mono text-white/30 hover:text-white/50 transition-all tracking-widest"
              >
                ← BACK TO DASHBOARD
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
