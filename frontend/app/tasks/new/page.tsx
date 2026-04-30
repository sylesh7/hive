"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"

// ─── Scout selector (reused pattern from onboarding) ─────────────────────────
const SCOUTS = [
  {
    id: "cost",
    name: "Cost Scout",
    tag: "CHEAPEST",
    desc: "Picks the lowest bid that meets your deliverable spec.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    id: "quality",
    name: "Quality Scout",
    tag: "BEST REPUTATION",
    desc: "Weights on-chain ERC-8004 reputation score against price.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    id: "speed",
    name: "Speed Scout",
    tag: "FASTEST",
    desc: "Prioritizes fastest estimated delivery regardless of price.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
]

const DURATIONS = [
  { label: "30 min", value: "30m" },
  { label: "1 hour", value: "1h" },
  { label: "4 hours", value: "4h" },
  { label: "24 hours", value: "24h" },
  { label: "72 hours", value: "72h" },
]

// ─── Delegation confirm modal ─────────────────────────────────────────────────
function DelegationModal({
  budget,
  duration,
  onConfirm,
  onCancel,
}: {
  budget: string
  duration: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [signing, setSigning] = useState(false)

  const handleSign = async () => {
    setSigning(true)
    await new Promise(r => setTimeout(r, 2000))
    setSigning(false)
    onConfirm()
  }

  const durLabel = DURATIONS.find(d => d.value === duration)?.label ?? duration

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#0F0F0D] p-8 flex flex-col gap-6">
        <div>
          <div className="text-[10px] font-mono text-white/30 tracking-widest mb-1">EIP-7702 DELEGATION</div>
          <h2 className="text-xl font-light" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
            Confirm spending permission
          </h2>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
          {[
            { label: "Permitted amount", value: `${budget} USDC` },
            { label: "Contract", value: "HiveBidEscrow (verified)" },
            { label: "Time limit", value: durLabel + " + 1h buffer" },
            { label: "Revokable", value: "Yes — from dashboard" },
            { label: "Standard", value: "EIP-7702" },
          ].map(row => (
            <div key={row.label} className="flex justify-between text-xs font-mono">
              <span className="text-white/30">{row.label}</span>
              <span className="text-white/60">{row.value}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-white/40 leading-relaxed">
          Your agent is granted a one-time, scoped permission to spend up to {budget} USDC — only through the escrow contract, only for this task. No other funds can be accessed.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.10] text-xs font-mono text-white/40 hover:text-white/60 hover:border-white/20 transition-all tracking-widest"
          >
            CANCEL
          </button>
          <button
            onClick={handleSign}
            disabled={signing}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white text-[#0B0B09] text-xs font-mono font-medium tracking-widest hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {signing ? "SIGNING…" : "SIGN & POST →"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 flex flex-col gap-5">
      <div className="text-[10px] font-mono text-white/30 tracking-widest">{label}</div>
      {children}
    </div>
  )
}

// ─── Field label ──────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-mono text-white/40 tracking-widest">{children}</label>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function NewTask() {
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [spec, setSpec] = useState("")
  const [budget, setBudget] = useState("50")
  const [duration, setDuration] = useState("1h")
  const [scouts, setScouts] = useState<string[]>(["cost"])
  const [showModal, setShowModal] = useState(false)

  const toggleScout = (id: string) => {
    setScouts(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(s => s !== id) : prev
        : [...prev, id]
    )
  }

  const canPost = title.trim().length > 0 && spec.trim().length > 10 && Number(budget) > 0

  const handlePostClick = () => {
    if (!canPost) return
    setShowModal(true)
  }

  const handleConfirm = () => {
    setShowModal(false)
    router.push("/dashboard")
  }

  // Preview summary helpers
  const durLabel = DURATIONS.find(d => d.value === duration)?.label ?? duration
  const scoutNames = scouts.map(s => SCOUTS.find(sc => sc.id === s)?.name ?? s).join(", ")

  return (
    <div className="bg-[#0B0B09] text-[#F0EFEA] min-h-screen font-sans antialiased">
      <MobileNav />

      {showModal && (
        <DelegationModal
          budget={budget}
          duration={duration}
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
        />
      )}

      <div className="max-w-5xl mx-auto px-6 md:px-12 pt-28 pb-24">

        {/* Header */}
        <div className="mb-10">
          <div className="text-white/30 text-[11px] font-mono tracking-widest mb-1">NEW TASK</div>
          <h1 className="text-3xl font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
            Post a task
          </h1>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── LEFT: Form ── */}
          <div className="lg:col-span-7 flex flex-col gap-4">

            {/* Task basics */}
            <Section label="TASK DETAILS">
              <div className="flex flex-col gap-2">
                <Label>TITLE</Label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Audit my ERC-20 contract"
                  maxLength={80}
                  className="bg-white/[0.04] border border-white/[0.10] rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors"
                />
                <div className="text-[10px] font-mono text-white/20 self-end">{title.length}/80</div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>DELIVERABLE SPEC</Label>
                <textarea
                  value={spec}
                  onChange={e => setSpec(e.target.value)}
                  placeholder="Describe exactly what the worker must deliver. Be specific — this is what your agent evaluates bids and final output against."
                  rows={5}
                  className="bg-white/[0.04] border border-white/[0.10] rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors resize-none leading-relaxed"
                />
                <div className="text-[10px] font-mono text-white/20">{spec.length} chars · min 10</div>
              </div>
            </Section>

            {/* Budget */}
            <Section label="BUDGET">
              <div className="flex flex-col gap-2">
                <Label>MAX BUDGET (USDC)</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    className="flex-1 bg-white/[0.04] border border-white/[0.10] rounded-xl px-4 py-3 text-sm text-white/90 font-mono focus:outline-none focus:border-white/25 transition-colors"
                  />
                  <div className="flex gap-2">
                    {["25", "50", "100", "250"].map(v => (
                      <button
                        key={v}
                        onClick={() => setBudget(v)}
                        className={`px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                          budget === v
                            ? "border-white/30 text-white/80 bg-white/[0.06]"
                            : "border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-white/30 leading-relaxed">
                  Workers bid below your max. You only pay the winning bid — not the cap.
                </p>
              </div>
            </Section>

            {/* Auction duration */}
            <Section label="AUCTION WINDOW">
              <div className="flex flex-col gap-2">
                <Label>HOW LONG SHOULD BIDDING STAY OPEN?</Label>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setDuration(d.value)}
                      className={`px-4 py-2 rounded-xl border text-xs font-mono transition-all duration-150 ${
                        duration === d.value
                          ? "border-white/30 text-white bg-white/[0.08]"
                          : "border-white/[0.08] text-white/40 hover:border-white/[0.15] hover:text-white/60"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-white/30">
                  Delivery window starts when auction closes. Your delegation expires auction window + 1 hour.
                </p>
              </div>
            </Section>

            {/* Scout selection */}
            <Section label="SCOUTS FOR THIS TASK">
              <p className="text-xs text-white/40 -mt-2 leading-relaxed">
                Override your default scouts for this task. At least one required.
              </p>
              <div className="flex flex-col gap-2">
                {SCOUTS.map(scout => {
                  const active = scouts.includes(scout.id)
                  return (
                    <button
                      key={scout.id}
                      onClick={() => toggleScout(scout.id)}
                      className={`text-left flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-150 ${
                        active
                          ? "border-white/20 bg-white/[0.06]"
                          : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${active ? "border-white/25 text-white bg-white/[0.08]" : "border-white/[0.10] text-white/40"}`}>
                        {scout.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-light text-white/90">{scout.name}</span>
                          <span className="text-[9px] font-mono text-white/30 tracking-widest">{scout.tag}</span>
                        </div>
                        <p className="text-xs text-white/40 mt-0.5">{scout.desc}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${active ? "border-white bg-white" : "border-white/20"}`} />
                    </button>
                  )
                })}
              </div>
            </Section>

          </div>

          {/* ── RIGHT: Summary + Post ── */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            {/* Summary card */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 flex flex-col gap-4 lg:sticky lg:top-28">
              <div className="text-[10px] font-mono text-white/30 tracking-widest">TASK PREVIEW</div>

              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-mono text-white/25 mb-1">TITLE</div>
                  <div className="text-sm text-white/80 leading-snug">
                    {title || <span className="text-white/20 italic">No title yet</span>}
                  </div>
                </div>

                <div className="border-t border-white/[0.05] pt-3">
                  <div className="text-[10px] font-mono text-white/25 mb-1">SPEC</div>
                  <div className="text-xs text-white/50 leading-relaxed line-clamp-4">
                    {spec || <span className="text-white/20 italic">No spec yet</span>}
                  </div>
                </div>

                <div className="border-t border-white/[0.05] pt-3 grid grid-cols-2 gap-y-3">
                  {[
                    { label: "MAX BUDGET", value: budget ? `${budget} USDC` : "—" },
                    { label: "AUCTION", value: durLabel },
                    { label: "NETWORK", value: "Base Sepolia" },
                    { label: "SCOUTS", value: scouts.length.toString() },
                  ].map(row => (
                    <div key={row.label}>
                      <div className="text-[9px] font-mono text-white/25 mb-0.5">{row.label}</div>
                      <div className="text-xs font-mono text-white/60">{row.value}</div>
                    </div>
                  ))}
                </div>

                {scouts.length > 0 && (
                  <div className="border-t border-white/[0.05] pt-3">
                    <div className="text-[9px] font-mono text-white/25 mb-1.5">ACTIVE SCOUTS</div>
                    <div className="flex flex-wrap gap-1.5">
                      {scouts.map(s => {
                        const scout = SCOUTS.find(sc => sc.id === s)
                        return (
                          <span key={s} className="px-2 py-0.5 rounded-md border border-white/[0.10] text-[10px] font-mono text-white/50">
                            {scout?.name}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* EIP-7702 note */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] font-mono text-white/25 mb-1">DELEGATION (EIP-7702)</div>
                <p className="text-[11px] text-white/35 leading-relaxed">
                  Posting creates a one-time spend permission for {budget || "?"} USDC. Expires after {durLabel} + 1h. Revokable anytime.
                </p>
              </div>

              {/* Post button */}
              <button
                onClick={handlePostClick}
                disabled={!canPost}
                className="w-full py-3 bg-white text-[#0B0B09] text-[11px] font-mono font-medium rounded-xl hover:bg-white/90 transition-colors tracking-widest disabled:opacity-25 disabled:cursor-not-allowed"
              >
                POST TASK →
              </button>

              {!canPost && (
                <div className="text-[10px] font-mono text-white/25 text-center -mt-1">
                  {!title.trim() ? "Add a title" : spec.trim().length <= 10 ? "Spec needs 10+ chars" : "Set a budget"}
                </div>
              )}

              {/* Back */}
              <button
                onClick={() => router.push("/dashboard")}
                className="text-[11px] font-mono text-white/25 hover:text-white/50 tracking-widest transition-colors text-center"
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
