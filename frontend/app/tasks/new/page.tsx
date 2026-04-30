"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PageShell } from "@/components/page-shell"

const SCOUTS = [
  { id: "cost",    name: "Cost Scout",    tag: "CHEAPEST",        desc: "Picks the lowest bid that meets your deliverable spec." },
  { id: "quality", name: "Quality Scout", tag: "BEST REPUTATION", desc: "Weights on-chain ERC-8004 reputation score against price." },
  { id: "speed",   name: "Speed Scout",   tag: "FASTEST",         desc: "Prioritizes fastest estimated delivery regardless of price." },
]

const DURATIONS = [
  { label: "30 min",   value: "30m" },
  { label: "1 hour",   value: "1h" },
  { label: "4 hours",  value: "4h" },
  { label: "24 hours", value: "24h" },
  { label: "72 hours", value: "72h" },
]

function DelegationModal({ budget, duration, onConfirm, onCancel }: {
  budget: string; duration: string; onConfirm: () => void; onCancel: () => void
}) {
  const [signing, setSigning] = useState(false)
  const durLabel = DURATIONS.find(d => d.value === duration)?.label ?? duration

  const handleSign = async () => {
    setSigning(true)
    await new Promise(r => setTimeout(r, 2000))
    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.15] bg-[#111110] p-8 flex flex-col gap-5 shadow-2xl">
        <div>
          <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1">EIP-7702 DELEGATION</div>
          <h2 className="text-xl font-light" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>Confirm spending permission</h2>
        </div>
        <div className="rounded-xl border border-white/[0.10] bg-[#0f0f0d] p-4 space-y-2.5">
          {[
            { label: "Permitted amount", value: `${budget} USDC` },
            { label: "Contract",         value: "HiveBidEscrow (verified)" },
            { label: "Time limit",       value: `${durLabel} + 1h buffer` },
            { label: "Revokable",        value: "Yes — from dashboard" },
            { label: "Standard",         value: "EIP-7702" },
          ].map(row => (
            <div key={row.label} className="flex justify-between text-xs font-mono">
              <span className="text-white/40">{row.label}</span>
              <span className="text-white/80">{row.value}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/50 leading-relaxed">
          One-time scoped permission for {budget} USDC — escrow contract only, this task only. No other funds accessible.
        </p>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-white/[0.15] text-xs font-mono text-white/60 hover:text-white/80 hover:border-white/25 transition-all tracking-widest">
            CANCEL
          </button>
          <button onClick={handleSign} disabled={signing} className="flex-1 py-2.5 rounded-xl bg-white text-[#0B0B09] text-xs font-mono font-medium tracking-widest hover:bg-white/90 transition-colors disabled:opacity-50">
            {signing ? "SIGNING…" : "SIGN & POST →"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewTask() {
  const router = useRouter()
  const [title, setTitle]       = useState("")
  const [spec, setSpec]         = useState("")
  const [budget, setBudget]     = useState("50")
  const [duration, setDuration] = useState("1h")
  const [scouts, setScouts]     = useState<string[]>(["cost"])
  const [showModal, setShowModal] = useState(false)

  const toggleScout = (id: string) => {
    setScouts(prev => prev.includes(id) ? (prev.length > 1 ? prev.filter(s => s !== id) : prev) : [...prev, id])
  }

  const canPost = title.trim().length > 0 && spec.trim().length > 10 && Number(budget) > 0
  const durLabel = DURATIONS.find(d => d.value === duration)?.label ?? duration

  return (
    <PageShell>
      {showModal && (
        <DelegationModal budget={budget} duration={duration}
          onConfirm={() => { setShowModal(false); router.push("/dashboard") }}
          onCancel={() => setShowModal(false)} />
      )}

      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-24 pb-20">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="text-white/40 text-[10px] font-mono tracking-widest mb-1">NEW TASK</div>
            <h1 className="text-2xl font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>Post a task</h1>
          </div>
          <button onClick={() => router.push("/dashboard")} className="text-[11px] font-mono text-white/35 hover:text-white/60 tracking-widest transition-colors">
            ← DASHBOARD
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── LEFT: Form ── */}
          <div className="lg:col-span-7 flex flex-col gap-4">

            {/* Task details */}
            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-6 flex flex-col gap-5">
              <div className="text-[10px] font-mono text-white/40 tracking-widest">TASK DETAILS</div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-mono text-white/50 tracking-widest">TITLE</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Audit my ERC-20 contract" maxLength={80}
                  className="bg-[#0f0f0d] border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors" />
                <div className="text-[10px] font-mono text-white/25 self-end">{title.length}/80</div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-mono text-white/50 tracking-widest">DELIVERABLE SPEC</label>
                <textarea value={spec} onChange={e => setSpec(e.target.value)} rows={5}
                  placeholder="Describe exactly what the worker must deliver. This is what your agent evaluates bids and output against."
                  className="bg-[#0f0f0d] border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none leading-relaxed" />
                <div className="text-[10px] font-mono text-white/25">{spec.length} chars · min 10</div>
              </div>
            </div>

            {/* Budget */}
            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-6 flex flex-col gap-4">
              <div className="text-[10px] font-mono text-white/40 tracking-widest">BUDGET</div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-mono text-white/50 tracking-widest">MAX BUDGET (USDC)</label>
                <div className="flex items-center gap-3">
                  <input type="number" min="1" max="10000" value={budget} onChange={e => setBudget(e.target.value)}
                    className="flex-1 bg-[#0f0f0d] border border-white/[0.12] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-white/30 transition-colors" />
                  <div className="flex gap-2">
                    {["25", "50", "100", "250"].map(v => (
                      <button key={v} onClick={() => setBudget(v)}
                        className={`px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${budget === v ? "border-white/35 text-white bg-white/[0.06]" : "border-white/[0.10] text-white/50 hover:text-white/70 hover:border-white/20"}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-white/35 leading-relaxed">Workers bid below your max. You only pay the winning bid.</p>
              </div>
            </div>

            {/* Auction window */}
            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-6 flex flex-col gap-4">
              <div className="text-[10px] font-mono text-white/40 tracking-widest">AUCTION WINDOW</div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-mono text-white/50 tracking-widest">HOW LONG SHOULD BIDDING STAY OPEN?</label>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map(d => (
                    <button key={d.value} onClick={() => setDuration(d.value)}
                      className={`px-4 py-2 rounded-xl border text-xs font-mono transition-all ${duration === d.value ? "border-white/35 text-white bg-white/[0.06]" : "border-white/[0.10] text-white/50 hover:border-white/20 hover:text-white/70"}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-white/35">Delivery starts when auction closes. Delegation expires auction + 1 hour.</p>
              </div>
            </div>

            {/* Scouts */}
            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-6 flex flex-col gap-4">
              <div className="text-[10px] font-mono text-white/40 tracking-widest">SCOUTS FOR THIS TASK</div>
              <div className="flex flex-col gap-2">
                {SCOUTS.map(scout => {
                  const active = scouts.includes(scout.id)
                  return (
                    <button key={scout.id} onClick={() => toggleScout(scout.id)}
                      className={`text-left flex items-center gap-4 px-4 py-3 rounded-xl border transition-all ${active ? "border-white/25 bg-white/[0.05]" : "border-white/[0.10] bg-[#0f0f0d] hover:border-white/[0.18]"}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-light text-white">{scout.name}</span>
                          <span className="text-[9px] font-mono text-white/35 tracking-widest">{scout.tag}</span>
                        </div>
                        <p className="text-xs text-white/45 mt-0.5">{scout.desc}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${active ? "border-white bg-white" : "border-white/25"}`} />
                    </button>
                  )
                })}
              </div>
            </div>

          </div>

          {/* ── RIGHT: Summary ── */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-6 flex flex-col gap-5 lg:sticky lg:top-24">
              <div className="text-[10px] font-mono text-white/40 tracking-widest">TASK PREVIEW</div>

              <div className="rounded-xl border border-white/[0.10] bg-[#0f0f0d] p-4 space-y-3">
                <div>
                  <div className="text-[9px] font-mono text-white/30 mb-1">TITLE</div>
                  <div className="text-sm text-white/80">{title || <span className="text-white/20 italic">No title</span>}</div>
                </div>
                <div className="border-t border-white/[0.06] pt-3">
                  <div className="text-[9px] font-mono text-white/30 mb-1">SPEC</div>
                  <div className="text-xs text-white/55 leading-relaxed line-clamp-3">{spec || <span className="text-white/20 italic">No spec</span>}</div>
                </div>
                <div className="border-t border-white/[0.06] pt-3 grid grid-cols-2 gap-3">
                  {[
                    { label: "BUDGET",  value: budget ? `${budget} USDC` : "—" },
                    { label: "AUCTION", value: durLabel },
                    { label: "NETWORK", value: "Base Sepolia" },
                    { label: "SCOUTS",  value: `${scouts.length} active` },
                  ].map(row => (
                    <div key={row.label}>
                      <div className="text-[9px] font-mono text-white/30 mb-0.5">{row.label}</div>
                      <div className="text-xs font-mono text-white/70">{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* EIP-7702 note */}
              <div className="rounded-xl border border-white/[0.08] bg-[#0f0f0d] p-3">
                <div className="text-[9px] font-mono text-white/30 mb-1">EIP-7702 DELEGATION</div>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  One-time spend permission for {budget || "?"} USDC · expires {durLabel} + 1h · revokable anytime
                </p>
              </div>

              <button onClick={() => canPost && setShowModal(true)} disabled={!canPost}
                className="w-full py-3 bg-white text-[#0B0B09] text-[11px] font-mono font-medium rounded-xl hover:bg-white/90 transition-colors tracking-widest disabled:opacity-25 disabled:cursor-not-allowed">
                POST TASK →
              </button>

              {!canPost && (
                <div className="text-[10px] font-mono text-white/30 text-center -mt-2">
                  {!title.trim() ? "Add a title to continue" : spec.trim().length <= 10 ? "Spec needs more detail" : "Set a budget"}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </PageShell>
  )
}
