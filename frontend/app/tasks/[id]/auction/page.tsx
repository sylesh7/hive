"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { PageShell } from "@/components/page-shell"

interface Bid {
  id: string; worker: string; amount: number; reputation: number; eta: string
}

const MOCK_TASK = {
  title: "Audit smart contract",
  spec: "Full security audit of an ERC-20 contract. Check reentrancy, overflow, access control, and common Solidity pitfalls. Deliver a written report with severity ratings.",
  budget: 35,
  closesAt: Date.now() + 34 * 1000,
}

const INITIAL_BIDS: Bid[] = [
  { id: "b1", worker: "AuditAgent",   amount: 28, reputation: 94, eta: "45 min" },
  { id: "b2", worker: "SecureBot",    amount: 32, reputation: 88, eta: "30 min" },
  { id: "b3", worker: "ChainChecker", amount: 25, reputation: 79, eta: "60 min" },
]

const SCOUT_PICKS: Record<string, string> = { cost: "b3", quality: "b1", speed: "b2" }

function useCountdown(endsAt: number) {
  const [msLeft, setMsLeft] = useState(endsAt - Date.now())
  useEffect(() => { const id = setInterval(() => setMsLeft(endsAt - Date.now()), 500); return () => clearInterval(id) }, [endsAt])
  const total = Math.max(0, msLeft)
  return { mins: Math.floor(total / 60000), secs: Math.floor((total % 60000) / 1000), done: total === 0 }
}

function AcceptModal({ bid, onConfirm, onCancel }: { bid: Bid; onConfirm: () => void; onCancel: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const handle = async () => { setConfirming(true); await new Promise(r => setTimeout(r, 1800)); onConfirm() }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/[0.15] bg-[#111110] p-8 flex flex-col gap-5 shadow-2xl">
        <div>
          <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1">ACCEPT BID</div>
          <h2 className="text-xl font-light" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>Lock in {bid.worker}?</h2>
        </div>
        <div className="rounded-xl border border-white/[0.10] bg-[#0f0f0d] p-4 space-y-2.5">
          {[{ label: "Worker", value: bid.worker }, { label: "Amount", value: `${bid.amount} USDC` }, { label: "ETA", value: bid.eta }, { label: "Reputation", value: `${bid.reputation}/100` }].map(row => (
            <div key={row.label} className="flex justify-between text-xs font-mono">
              <span className="text-white/40">{row.label}</span>
              <span className="text-white/80">{row.value}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/50 leading-relaxed">Funds locked in escrow. Released only after your agent approves delivery.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-white/[0.15] text-xs font-mono text-white/60 hover:text-white/80 transition-all tracking-widest">CANCEL</button>
          <button onClick={handle} disabled={confirming} className="flex-1 py-2.5 rounded-xl bg-white text-[#0B0B09] text-xs font-mono font-medium tracking-widest hover:bg-white/90 transition-colors disabled:opacity-50">
            {confirming ? "LOCKING…" : "ACCEPT →"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AuctionPage() {
  const router = useRouter()
  const params = useParams()
  const { mins, secs, done } = useCountdown(MOCK_TASK.closesAt)

  const [bids, setBids] = useState<Bid[]>(INITIAL_BIDS)
  const [selected, setSelected] = useState<string | null>(null)
  const [newBidId, setNewBidId] = useState<string | null>(null)
  const [showAccept, setShowAccept] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      const incoming: Bid = { id: "b4", worker: "ZeroGasAudit", amount: 22, reputation: 71, eta: "90 min" }
      setBids(prev => [incoming, ...prev])
      setNewBidId("b4")
      setTimeout(() => setNewBidId(null), 3000)
    }, 6000)
    return () => clearTimeout(t)
  }, [])

  const selectedBid = bids.find(b => b.id === selected) ?? null
  const sortedBids = [...bids].sort((a, b) => a.amount - b.amount)

  if (cancelled) {
    return (
      <PageShell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center flex flex-col items-center gap-4">
            <div className="text-white/40 text-[11px] font-mono tracking-widest">AUCTION CANCELLED</div>
            <p className="text-white/60 text-sm">Task cancelled. No funds were locked.</p>
            <button onClick={() => router.push("/dashboard")} className="text-[11px] font-mono text-white/40 hover:text-white/70 tracking-widest transition-colors">← BACK TO DASHBOARD</button>
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      {showAccept && selectedBid && (
        <AcceptModal bid={selectedBid} onConfirm={() => router.push(`/tasks/${params.id}/delivery`)} onCancel={() => setShowAccept(false)} />
      )}

      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-24 pb-20">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <div className="text-white/40 text-[10px] font-mono tracking-widest mb-1">LIVE AUCTION</div>
            <h1 className="text-2xl font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>{MOCK_TASK.title}</h1>
          </div>
          <div className={`rounded-2xl border px-5 py-3 text-right shrink-0 ${done ? "border-white/[0.10] bg-[#111110]" : "border-amber-500/30 bg-amber-500/[0.06]"}`}>
            <div className={`text-[9px] font-mono tracking-widest mb-1 ${done ? "text-white/35" : "text-amber-400/70"}`}>{done ? "CLOSED" : "CLOSES IN"}</div>
            <div className={`text-2xl font-mono font-light tabular-nums ${done ? "text-white/50" : "text-white"}`}>
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── LEFT: Spec + Bids ── */}
          <div className="lg:col-span-7 flex flex-col gap-4">

            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-3">DELIVERABLE SPEC</div>
              <p className="text-sm text-white/70 leading-relaxed">{MOCK_TASK.spec}</p>
              <div className="flex gap-5 mt-4 pt-4 border-t border-white/[0.07]">
                <div><div className="text-[9px] font-mono text-white/30">BUDGET CAP</div><div className="text-sm font-mono text-white/80 mt-0.5">{MOCK_TASK.budget} USDC</div></div>
                <div><div className="text-[9px] font-mono text-white/30">NETWORK</div><div className="text-sm font-mono text-white/80 mt-0.5">Base Sepolia</div></div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-white/[0.07] flex items-center justify-between">
                <div className="text-[10px] font-mono text-white/40 tracking-widest">BIDS ({bids.length})</div>
                <div className="text-[10px] font-mono text-white/25">sorted by price ↑</div>
              </div>
              {sortedBids.map((bid, i) => {
                const tags = Object.entries(SCOUT_PICKS).filter(([, v]) => v === bid.id).map(([k]) => k)
                const isNew = newBidId === bid.id
                const isSelected = selected === bid.id
                return (
                  <button key={bid.id} onClick={() => setSelected(bid.id)}
                    className={`w-full text-left flex items-center gap-4 px-5 py-4 transition-all ${i < sortedBids.length - 1 ? "border-b border-white/[0.07]" : ""} ${isNew ? "bg-emerald-500/[0.05]" : isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}>
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${isSelected ? "border-white bg-white" : "border-white/25"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-light text-white">{bid.worker}</span>
                        {tags.map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400 text-[9px] font-mono">{tag.toUpperCase()}</span>
                        ))}
                        {isNew && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[9px] font-mono">NEW</span>}
                      </div>
                      <div className="text-[10px] font-mono text-white/40 mt-0.5">Rep {bid.reputation}/100 · ETA {bid.eta}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-mono text-white">{bid.amount} USDC</div>
                      <div className="text-[10px] font-mono text-white/35">{MOCK_TASK.budget - bid.amount} under cap</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── RIGHT: Scouts + Actions ── */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5 flex flex-col gap-3">
              <div className="text-[10px] font-mono text-white/40 tracking-widest">SCOUT RECOMMENDATIONS</div>
              {[
                { type: "cost",    label: "Cost Scout",    color: "text-amber-400 border-amber-500/30 bg-amber-500/[0.08]",    desc: "Lowest price" },
                { type: "quality", label: "Quality Scout", color: "text-purple-400 border-purple-500/30 bg-purple-500/[0.08]", desc: "Best reputation" },
                { type: "speed",   label: "Speed Scout",   color: "text-blue-400 border-blue-500/30 bg-blue-500/[0.08]",       desc: "Fastest ETA" },
              ].map(({ type, label, color, desc }) => {
                const bid = bids.find(b => b.id === SCOUT_PICKS[type])
                if (!bid) return null
                const isSelected = selected === bid.id
                return (
                  <button key={type} onClick={() => setSelected(bid.id)}
                    className={`text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${isSelected ? "border-white/25 bg-white/[0.05]" : "border-white/[0.10] bg-[#0f0f0d] hover:border-white/[0.18]"}`}>
                    <span className={`px-2 py-0.5 rounded border text-[9px] font-mono tracking-widest shrink-0 ${color}`}>{label.toUpperCase()}</span>
                    <span className="text-sm font-light text-white flex-1 truncate">{bid.worker}</span>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono text-white/80">{bid.amount} USDC</div>
                      <div className="text-[10px] font-mono text-white/35">{desc}</div>
                    </div>
                  </button>
                )
              })}
              <p className="text-[10px] font-mono text-white/30 pt-1">Click a scout card to select their pick, or choose manually.</p>
            </div>

            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5 flex flex-col gap-3">
              <div className="text-[10px] font-mono text-white/40 tracking-widest">ACTIONS</div>
              {selected && selectedBid ? (
                <div className="rounded-xl border border-white/[0.10] bg-[#0f0f0d] p-3 space-y-2">
                  {[{ label: "Selected", value: selectedBid.worker }, { label: "Amount", value: `${selectedBid.amount} USDC` }, { label: "ETA", value: selectedBid.eta }].map(row => (
                    <div key={row.label} className="flex justify-between text-xs font-mono">
                      <span className="text-white/35">{row.label}</span>
                      <span className="text-white/75">{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/35">Select a bid above or use a scout recommendation.</p>
              )}
              <button onClick={() => setShowAccept(true)} disabled={!selected}
                className="w-full py-3 bg-white text-[#0B0B09] text-[11px] font-mono font-medium rounded-xl hover:bg-white/90 transition-colors tracking-widest disabled:opacity-25 disabled:cursor-not-allowed">
                ACCEPT BID →
              </button>
              <button onClick={() => setCancelled(true)}
                className="w-full py-2.5 rounded-xl border border-red-500/20 text-xs font-mono text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-all tracking-widest">
                CANCEL AUCTION
              </button>
            </div>

          </div>
        </div>
      </div>
    </PageShell>
  )
}
