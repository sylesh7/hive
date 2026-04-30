"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageShell } from "@/components/page-shell"

type MilestoneStatus = "done" | "active" | "pending"
interface Milestone { id: string; label: string; detail: string; status: MilestoneStatus; time?: string }

const MOCK_TASK = { title: "Audit smart contract", worker: "AuditAgent", amount: 28, eta: "45 min", dueAt: Date.now() + 38 * 60 * 1000 }

const INITIAL_MILESTONES: Milestone[] = [
  { id: "m1", label: "Bid accepted",        detail: "Escrow locked · 28 USDC",                  status: "done",    time: "Just now" },
  { id: "m2", label: "Worker acknowledged", detail: "AuditAgent confirmed task receipt",          status: "done",    time: "0:12 ago" },
  { id: "m3", label: "Work in progress",    detail: "Worker is actively processing your spec",    status: "active" },
  { id: "m4", label: "Delivery submitted",  detail: "Worker uploads deliverable to IPFS",         status: "pending" },
  { id: "m5", label: "Evaluator reviewing", detail: "Scout agent checks output against spec",     status: "pending" },
  { id: "m6", label: "Settled",             detail: "Escrow released · reputation updated",       status: "pending" },
]

function useCountdown(endsAt: number) {
  const [msLeft, setMsLeft] = useState(endsAt - Date.now())
  useEffect(() => { const id = setInterval(() => setMsLeft(endsAt - Date.now()), 1000); return () => clearInterval(id) }, [endsAt])
  const total = Math.max(0, msLeft)
  return { mins: Math.floor(total / 60000), secs: Math.floor((total % 60000) / 1000), done: total === 0 }
}

function DisputeModal({ onClose }: { onClose: () => void }) {
  const [reason, setReason] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const handleSubmit = async () => { if (!reason.trim()) return; await new Promise(r => setTimeout(r, 1500)); setSubmitted(true) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.15] bg-[#111110] p-8 flex flex-col gap-5 shadow-2xl">
        {submitted ? (
          <>
            <div className="flex items-center gap-3 text-amber-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span className="text-sm font-light">Dispute raised</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">Escrow frozen until resolved. KeeperHub arbitration usually completes within 2 hours.</p>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-white/[0.15] text-xs font-mono text-white/60 hover:text-white/80 tracking-widest transition-colors">CLOSE</button>
          </>
        ) : (
          <>
            <div>
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1">RAISE DISPUTE</div>
              <h2 className="text-xl font-light" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>What is the issue?</h2>
            </div>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4}
              placeholder="Describe why the delivery does not meet your spec..."
              className="bg-[#0f0f0d] border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors resize-none" />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.15] text-xs font-mono text-white/60 hover:text-white/80 transition-all tracking-widest">CANCEL</button>
              <button onClick={handleSubmit} disabled={!reason.trim()} className="flex-1 py-2.5 rounded-xl border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest hover:bg-amber-500/10 transition-all disabled:opacity-30">SUBMIT</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function DeliveryPage() {
  const router = useRouter()
  const { mins, secs, done: overdue } = useCountdown(MOCK_TASK.dueAt)
  const [milestones, setMilestones] = useState<Milestone[]>(INITIAL_MILESTONES)
  const [showDispute, setShowDispute] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setMilestones(prev => prev.map(m =>
      m.id === "m3" ? { ...m, status: "done" as const, time: "Just now" } :
      m.id === "m4" ? { ...m, status: "active" as const } : m)), 8000)
    const t2 = setTimeout(() => setMilestones(prev => prev.map(m =>
      m.id === "m4" ? { ...m, status: "done" as const, time: "Just now", detail: "Deliverable uploaded · QmXa9..." } :
      m.id === "m5" ? { ...m, status: "active" as const } : m)), 14000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const activeStep = milestones.find(m => m.status === "active")
  const doneCount = milestones.filter(m => m.status === "done").length

  return (
    <PageShell>
      {showDispute && <DisputeModal onClose={() => setShowDispute(false)} />}
      <div className="max-w-4xl mx-auto px-6 md:px-10 pt-24 pb-20">

        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <div className="text-white/40 text-[10px] font-mono tracking-widest mb-1">DELIVERY TRACKING</div>
            <h1 className="text-2xl font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>{MOCK_TASK.title}</h1>
          </div>
          <div className={`rounded-2xl border px-5 py-3 text-right shrink-0 ${overdue ? "border-red-500/30 bg-red-500/[0.06]" : "border-white/[0.10] bg-[#111110]"}`}>
            <div className={`text-[9px] font-mono tracking-widest mb-1 ${overdue ? "text-red-400/70" : "text-white/35"}`}>{overdue ? "OVERDUE" : "DUE IN"}</div>
            <div className={`text-2xl font-mono font-light tabular-nums ${overdue ? "text-red-400" : "text-white"}`}>{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 flex flex-col gap-4">
            {activeStep && (
              <div className="rounded-2xl border border-white/[0.15] bg-[#111110] px-5 py-4 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-light text-white">{activeStep.label}</div>
                  <div className="text-xs text-white/45 mt-0.5">{activeStep.detail}</div>
                </div>
                <div className="text-[10px] font-mono text-white/30 shrink-0">{doneCount}/{milestones.length} steps</div>
              </div>
            )}

            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-6">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-6">TIMELINE</div>
              {milestones.map((m, i) => {
                const isDone = m.status === "done", isActive = m.status === "active", isLast = i === milestones.length - 1
                return (
                  <div key={m.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${isDone ? "border-emerald-500/60 bg-emerald-500/15" : isActive ? "border-white/50 bg-white/[0.08]" : "border-white/[0.15] bg-transparent"}`}>
                        {isDone ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
                          : isActive ? <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          : <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                      </div>
                      {!isLast && <div className={`w-px flex-1 mt-1 min-h-[28px] ${isDone ? "bg-emerald-500/25" : "bg-white/[0.08]"}`} />}
                    </div>
                    <div className={`${isLast ? "pb-0" : "pb-6"} flex-1`}>
                      <div className={`text-sm font-light ${isDone ? "text-white/80" : isActive ? "text-white" : "text-white/30"}`}>{m.label}</div>
                      <div className={`text-xs mt-0.5 ${isDone ? "text-white/45" : isActive ? "text-white/55" : "text-white/20"}`}>{m.detail}</div>
                      {m.time && <div className="text-[10px] font-mono text-white/25 mt-1">{m.time}</div>}
                      {isActive && <div className="mt-2 h-1 w-32 rounded-full bg-white/[0.08] overflow-hidden"><div className="h-full bg-white/30 rounded-full animate-pulse" style={{ width: "60%" }} /></div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-4">TASK INFO</div>
              <div className="space-y-3">
                {[{ label: "WORKER", value: MOCK_TASK.worker }, { label: "LOCKED", value: `${MOCK_TASK.amount} USDC` }, { label: "ETA", value: MOCK_TASK.eta }, { label: "NETWORK", value: "Base Sepolia" }].map(row => (
                  <div key={row.label} className="flex justify-between text-xs font-mono">
                    <span className="text-white/35">{row.label}</span>
                    <span className="text-white/75">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-3">EVALUATOR</div>
              <p className="text-xs text-white/50 leading-relaxed mb-3">Your scout automatically checks the delivered output against your spec. Escrow releases on pass. Raise a dispute if output does not match.</p>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                <span className="text-[10px] font-mono text-white/35">Waiting for delivery</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5 flex flex-col gap-2">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1">ACTIONS</div>
              <button onClick={() => setShowDispute(true)} className="w-full py-2.5 rounded-xl border border-amber-500/20 text-xs font-mono text-amber-400/70 hover:text-amber-400 hover:border-amber-500/40 transition-all tracking-widest">RAISE DISPUTE</button>
              <button onClick={() => router.push("/dashboard")} className="w-full py-2.5 rounded-xl border border-white/[0.10] text-xs font-mono text-white/40 hover:text-white/60 hover:border-white/20 transition-all tracking-widest">BACK TO DASHBOARD</button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
