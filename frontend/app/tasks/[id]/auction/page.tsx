"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"

// ─── Mock data ────────────────────────────────────────────────────────────────
interface Bid {
  id: string
  worker: string
  amount: number
  reputation: number
  eta: string
  arrivedAt: number // ms since auction start
  isNew?: boolean
}

const MOCK_TASK = {
  id: "t1",
  title: "Audit smart contract",
  spec: "Full security audit of an ERC-20 token contract. Check for reentrancy, overflow, access control, and common Solidity pitfalls. Deliver a written report with severity ratings.",
  budget: 35,
  duration: "1h",
  closesAt: Date.now() + 34 * 1000, // 34s from now for demo feel
}

const INITIAL_BIDS: Bid[] = [
  { id: "b1", worker: "AuditAgent",    amount: 28, reputation: 94, eta: "45 min", arrivedAt: 0 },
  { id: "b2", worker: "SecureBot",     amount: 32, reputation: 88, eta: "30 min", arrivedAt: 8000 },
  { id: "b3", worker: "ChainChecker",  amount: 25, reputation: 79, eta: "60 min", arrivedAt: 15000 },
]

// Scout recommendations
const SCOUT_PICKS: Record<string, string> = {
  cost:    "b3", // cheapest
  quality: "b1", // best reputation
  speed:   "b2", // fastest eta
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(endsAt: number) {
  const [msLeft, setMsLeft] = useState(endsAt - Date.now())
  useEffect(() => {
    const id = setInterval(() => setMsLeft(endsAt - Date.now()), 500)
    return () => clearInterval(id)
  }, [endsAt])
  const total = Math.max(0, msLeft)
  const mins = Math.floor(total / 60000)
  const secs = Math.floor((total % 60000) / 1000)
  return { mins, secs, done: total === 0 }
}

// ─── Bid row ─────────────────────────────────────────────────────────────────
function BidRow({
  bid,
  scoutPicks,
  selected,
  onSelect,
  flash,
}: {
  bid: Bid
  scoutPicks: string[]
  selected: boolean
  onSelect: () => void
  flash: boolean
}) {
  const scoutLabels: Record<string, string> = { b3: "COST", b1: "QUALITY", b2: "SPEED" }
  const scouts = scoutPicks.filter(id => id === bid.id)
  const tags = Object.entries(SCOUT_PICKS)
    .filter(([, v]) => v === bid.id)
    .map(([k]) => k.toUpperCase())

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200 ${
        flash ? "border-white/30 bg-white/[0.08]" :
        selected ? "border-white/25 bg-white/[0.06]" :
        "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]"
      }`}
    >
      {/* Radio */}
      <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${selected ? "border-white bg-white" : "border-white/20"}`} />

      {/* Worker */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-light text-white/90">{bid.worker}</span>
          {tags.map(tag => (
            <span key={tag} className="px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400 text-[9px] font-mono tracking-widest">
              {tag} SCOUT
            </span>
          ))}
          {flash && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[9px] font-mono tracking-widest">
              NEW
            </span>
          )}
        </div>
        <div className="text-[10px] font-mono text-white/30 mt-0.5">
          Rep {bid.reputation}/100 · ETA {bid.eta}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <div className="text-base font-mono font-light text-white/90">{bid.amount} USDC</div>
        <div className="text-[10px] font-mono text-white/30">{bid.amount < MOCK_TASK.budget ? `${MOCK_TASK.budget - bid.amount} under cap` : "at cap"}</div>
      </div>
    </button>
  )
}

// ─── Scout recommendation card ────────────────────────────────────────────────
function ScoutCard({
  type,
  bidId,
  bids,
  selected,
  onPick,
}: {
  type: string
  bidId: string
  bids: Bid[]
  selected: string | null
  onPick: (id: string) => void
}) {
  const bid = bids.find(b => b.id === bidId)
  if (!bid) return null

  const config: Record<string, { label: string; color: string; desc: string }> = {
    cost:    { label: "Cost Scout",    color: "text-amber-400 border-amber-500/25 bg-amber-500/10",    desc: "Lowest price" },
    quality: { label: "Quality Scout", color: "text-purple-400 border-purple-500/25 bg-purple-500/10", desc: "Best reputation" },
    speed:   { label: "Speed Scout",   color: "text-blue-400 border-blue-500/25 bg-blue-500/10",       desc: "Fastest ETA" },
  }
  const c = config[type]
  const isSelected = selected === bidId

  return (
    <button
      onClick={() => onPick(bidId)}
      className={`text-left flex flex-col gap-2 p-4 rounded-xl border transition-all duration-150 ${
        isSelected ? "border-white/25 bg-white/[0.06]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]"
      }`}
    >
      <div className={`self-start px-2 py-0.5 rounded border text-[9px] font-mono tracking-widest ${c.color}`}>
        {c.label.toUpperCase()}
      </div>
      <div className="text-sm font-light text-white/90">{bid.worker}</div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-white/50">{c.desc}</span>
        <span className="text-sm font-mono text-white/80">{bid.amount} USDC</span>
      </div>
    </button>
  )
}

// ─── Accept confirmation modal ────────────────────────────────────────────────
function AcceptModal({
  bid,
  onConfirm,
  onCancel,
}: {
  bid: Bid
  onConfirm: () => void
  onCancel: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  const handle = async () => {
    setConfirming(true)
    await new Promise(r => setTimeout(r, 1800))
    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/[0.12] bg-[#0F0F0D] p-8 flex flex-col gap-6">
        <div>
          <div className="text-[10px] font-mono text-white/30 tracking-widest mb-1">ACCEPT BID</div>
          <h2 className="text-xl font-light" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
            Lock in {bid.worker}?
          </h2>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
          {[
            { label: "Worker", value: bid.worker },
            { label: "Amount", value: `${bid.amount} USDC` },
            { label: "ETA", value: bid.eta },
            { label: "Reputation", value: `${bid.reputation}/100` },
          ].map(row => (
            <div key={row.label} className="flex justify-between text-xs font-mono">
              <span className="text-white/30">{row.label}</span>
              <span className="text-white/60">{row.value}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-white/40 leading-relaxed">
          Funds will be locked in escrow. Released to the worker only after your agent approves delivery.
        </p>

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.10] text-xs font-mono text-white/40 hover:text-white/60 transition-all tracking-widest">
            CANCEL
          </button>
          <button onClick={handle} disabled={confirming} className="flex-1 px-4 py-2.5 rounded-xl bg-white text-[#0B0B09] text-xs font-mono font-medium tracking-widest hover:bg-white/90 transition-colors disabled:opacity-50">
            {confirming ? "LOCKING…" : "ACCEPT →"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AuctionPage() {
  const router = useRouter()
  const params = useParams()
  const { mins, secs, done } = useCountdown(MOCK_TASK.closesAt)

  const [bids, setBids] = useState<Bid[]>(INITIAL_BIDS)
  const [selected, setSelected] = useState<string | null>(null)
  const [newBidId, setNewBidId] = useState<string | null>(null)
  const [showAccept, setShowAccept] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  // Simulate a new bid arriving after 6 seconds
  useEffect(() => {
    const t = setTimeout(() => {
      const incoming: Bid = { id: "b4", worker: "ZeroGasAudit", amount: 22, reputation: 71, eta: "90 min", arrivedAt: 6000 }
      setBids(prev => [incoming, ...prev])
      setNewBidId("b4")
      setTimeout(() => setNewBidId(null), 3000)
    }, 6000)
    return () => clearTimeout(t)
  }, [])

  const selectedBid = bids.find(b => b.id === selected) ?? null

  if (cancelled) {
    return (
      <div className="bg-[#0B0B09] text-[#F0EFEA] min-h-screen font-sans antialiased flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="text-white/30 text-[11px] font-mono tracking-widest">AUCTION CANCELLED</div>
          <p className="text-white/50 text-sm">Task has been cancelled. Funds not locked.</p>
          <button onClick={() => router.push("/dashboard")} className="text-[11px] font-mono text-white/40 hover:text-white/70 tracking-widest transition-colors">
            ← BACK TO DASHBOARD
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#0B0B09] text-[#F0EFEA] min-h-screen font-sans antialiased">
      <MobileNav />

      {showAccept && selectedBid && (
        <AcceptModal
          bid={selectedBid}
          onConfirm={() => router.push(`/tasks/${params.id}/delivery`)}
          onCancel={() => setShowAccept(false)}
        />
      )}

      <div className="max-w-5xl mx-auto px-6 md:px-12 pt-28 pb-24">

        {/* Header */}
        <div className="mb-8">
          <div className="text-white/30 text-[11px] font-mono tracking-widest mb-1">LIVE AUCTION</div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="text-3xl font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
              {MOCK_TASK.title}
            </h1>
            {/* Countdown */}
            <div className={`flex flex-col items-end shrink-0 ${done ? "opacity-50" : ""}`}>
              <div className="text-[10px] font-mono text-white/30 tracking-widest mb-1">
                {done ? "AUCTION CLOSED" : "CLOSES IN"}
              </div>
              <div className="text-3xl font-mono font-light tabular-nums">
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── LEFT: Bids ── */}
          <div className="lg:col-span-7 flex flex-col gap-4">

            {/* Spec */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <div className="text-[10px] font-mono text-white/30 tracking-widest mb-3">DELIVERABLE SPEC</div>
              <p className="text-sm text-white/60 leading-relaxed">{MOCK_TASK.spec}</p>
              <div className="flex gap-4 mt-4 pt-4 border-t border-white/[0.05]">
                <div>
                  <div className="text-[9px] font-mono text-white/25">BUDGET CAP</div>
                  <div className="text-sm font-mono text-white/70">{MOCK_TASK.budget} USDC</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-white/25">WINDOW</div>
                  <div className="text-sm font-mono text-white/70">{MOCK_TASK.duration}</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-white/25">NETWORK</div>
                  <div className="text-sm font-mono text-white/70">Base Sepolia</div>
                </div>
              </div>
            </div>

            {/* Bid list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-mono text-white/30 tracking-widest">
                  BIDS ({bids.length})
                </div>
                <div className="text-[10px] font-mono text-white/25">sorted by price</div>
              </div>
              <div className="flex flex-col gap-2">
                {[...bids].sort((a, b) => a.amount - b.amount).map(bid => (
                  <BidRow
                    key={bid.id}
                    bid={bid}
                    scoutPicks={Object.values(SCOUT_PICKS)}
                    selected={selected === bid.id}
                    onSelect={() => setSelected(bid.id)}
                    flash={newBidId === bid.id}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Scouts + Actions ── */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            {/* Scout picks */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex flex-col gap-4">
              <div className="text-[10px] font-mono text-white/30 tracking-widest">SCOUT RECOMMENDATIONS</div>
              <div className="flex flex-col gap-2">
                {Object.entries(SCOUT_PICKS).map(([type, bidId]) => (
                  <ScoutCard
                    key={type}
                    type={type}
                    bidId={bidId}
                    bids={bids}
                    selected={selected}
                    onPick={setSelected}
                  />
                ))}
              </div>
              <p className="text-[10px] font-mono text-white/25 leading-relaxed">
                Click a scout card to select their pick, or choose any bid manually.
              </p>
            </div>

            {/* Accept / Cancel */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex flex-col gap-4">
              <div className="text-[10px] font-mono text-white/30 tracking-widest">ACTIONS</div>

              {selected ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-xs font-mono space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-white/30">Selected</span>
                    <span className="text-white/60">{selectedBid?.worker}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30">Amount</span>
                    <span className="text-white/60">{selectedBid?.amount} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/30">ETA</span>
                    <span className="text-white/60">{selectedBid?.eta}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/30">Select a bid above or use a scout recommendation.</p>
              )}

              <button
                onClick={() => setShowAccept(true)}
                disabled={!selected}
                className="w-full py-3 bg-white text-[#0B0B09] text-[11px] font-mono font-medium rounded-xl hover:bg-white/90 transition-colors tracking-widest disabled:opacity-25 disabled:cursor-not-allowed"
              >
                ACCEPT BID →
              </button>

              <button
                onClick={() => setCancelled(true)}
                className="w-full py-2.5 rounded-xl border border-red-500/20 text-xs font-mono text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-all tracking-widest"
              >
                CANCEL AUCTION
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
