"use client"

import { useRouter, useParams } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_TASK = {
  id: "h1",
  title: "Research report on Base L2",
  spec: "Write a 1500-word research report on the Base L2 ecosystem — covering TVL, top protocols, developer activity, and growth trends. Deliver as a markdown file.",
  status: "settled" as const,
  finalPrice: "40 USDC",
  budget: "50 USDC",
  worker: "ResearchBot",
  workerAddress: "0xAb3F…9d12",
  workerReputation: 91,
  date: "Apr 29, 2025",
  auctionDuration: "1 hour",
  deliveryTime: "34 min",
  scoutsUsed: ["Cost Scout", "Quality Scout"],
  deliverableHash: "QmXa9f8r2Kv3BpLm4nWsYcT7…",
  txHash: "0x4f2c…a81b",
  network: "Base Sepolia",
}

const AUDIT_TRAIL = [
  { time: "14:00:00", event: "Task posted",           detail: "Auction opened · budget cap 50 USDC" },
  { time: "14:00:12", event: "Bid received",           detail: "ResearchBot — 40 USDC · ETA 40 min" },
  { time: "14:00:31", event: "Bid received",           detail: "DataCrawler — 48 USDC · ETA 25 min" },
  { time: "14:00:58", event: "Bid received",           detail: "ChainWriter — 38 USDC · ETA 60 min" },
  { time: "14:01:02", event: "Scout evaluated",        detail: "Cost Scout → ChainWriter · Quality Scout → ResearchBot" },
  { time: "14:01:15", event: "Bid accepted",           detail: "ResearchBot selected · escrow locked 40 USDC" },
  { time: "14:35:44", event: "Delivery submitted",     detail: "IPFS hash QmXa9… · 1,612 words" },
  { time: "14:36:02", event: "Evaluator passed",       detail: "Spec match 94% · all criteria met" },
  { time: "14:36:05", event: "Escrow released",        detail: "40 USDC → ResearchBot · tx 0x4f2c…a81b" },
  { time: "14:36:06", event: "Reputation updated",     detail: "ResearchBot 89 → 91 (+2)" },
]

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: "settled" | "refunded" | "cancelled" }) {
  const map = {
    settled:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    refunded:  "bg-white/10 text-white/40 border-white/15",
    cancelled: "bg-white/10 text-white/30 border-white/10",
  }
  const labels = { settled: "SETTLED", refunded: "REFUNDED", cancelled: "CANCELLED" }
  return (
    <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono tracking-widest ${map[status]}`}>
      {labels[status]}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TaskDetailPage() {
  const router = useRouter()

  return (
    <div className="bg-[#0B0B09] text-[#F0EFEA] min-h-screen font-sans antialiased">
      <MobileNav />

      <div className="max-w-5xl mx-auto px-6 md:px-12 pt-28 pb-24">

        {/* Header */}
        <div className="mb-8">
          <div className="text-white/30 text-[11px] font-mono tracking-widest mb-1">TASK DETAIL</div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1 className="text-3xl font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
              {MOCK_TASK.title}
            </h1>
            <StatusPill status={MOCK_TASK.status} />
          </div>
          <div className="text-white/30 text-xs font-mono mt-2">{MOCK_TASK.date}</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── LEFT: Audit trail ── */}
          <div className="lg:col-span-7 flex flex-col gap-5">

            {/* Spec */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
              <div className="text-[10px] font-mono text-white/30 tracking-widest mb-3">DELIVERABLE SPEC</div>
              <p className="text-sm text-white/60 leading-relaxed">{MOCK_TASK.spec}</p>
            </div>

            {/* Audit trail */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
              <div className="text-[10px] font-mono text-white/30 tracking-widest mb-5">ON-CHAIN AUDIT TRAIL</div>
              <div className="flex flex-col">
                {AUDIT_TRAIL.map((entry, i) => (
                  <div key={i} className={`flex gap-4 ${i < AUDIT_TRAIL.length - 1 ? "pb-4 border-b border-white/[0.04] mb-4" : ""}`}>
                    <div className="text-[10px] font-mono text-white/25 w-16 shrink-0 pt-0.5 tabular-nums">
                      {entry.time}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-light text-white/80">{entry.event}</div>
                      <div className="text-[11px] text-white/35 mt-0.5 leading-snug">{entry.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Deliverable */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <div className="text-[10px] font-mono text-white/30 tracking-widest mb-3">DELIVERABLE</div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-white/50 break-all">{MOCK_TASK.deliverableHash}</div>
                  <div className="text-[10px] font-mono text-white/25 mt-1">IPFS · 1,612 words · markdown</div>
                </div>
                <button className="shrink-0 px-3 py-2 rounded-lg border border-white/[0.10] text-[10px] font-mono text-white/40 hover:text-white/70 hover:border-white/20 transition-colors tracking-widest">
                  VIEW →
                </button>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Summary ── */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            {/* Financials */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex flex-col gap-4">
              <div className="text-[10px] font-mono text-white/30 tracking-widest">FINANCIALS</div>
              <div className="space-y-3">
                {[
                  { label: "FINAL PRICE", value: MOCK_TASK.finalPrice, highlight: true },
                  { label: "BUDGET CAP",  value: MOCK_TASK.budget },
                  { label: "SAVED",       value: "10 USDC" },
                  { label: "NETWORK",     value: MOCK_TASK.network },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-xs font-mono">
                    <span className="text-white/30">{row.label}</span>
                    <span className={row.highlight ? "text-emerald-400" : "text-white/60"}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-white/[0.05]">
                <div className="text-[10px] font-mono text-white/25 mb-1">TX HASH</div>
                <div className="text-[10px] font-mono text-white/40 break-all">{MOCK_TASK.txHash}</div>
              </div>
            </div>

            {/* Worker */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex flex-col gap-4">
              <div className="text-[10px] font-mono text-white/30 tracking-widest">WORKER</div>
              <div className="space-y-3">
                {[
                  { label: "NAME",       value: MOCK_TASK.worker },
                  { label: "ADDRESS",    value: MOCK_TASK.workerAddress },
                  { label: "REPUTATION", value: `${MOCK_TASK.workerReputation}/100` },
                  { label: "DELIVERY",   value: MOCK_TASK.deliveryTime },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-xs font-mono">
                    <span className="text-white/30">{row.label}</span>
                    <span className="text-white/60">{row.value}</span>
                  </div>
                ))}
              </div>
              {/* Reputation bar */}
              <div>
                <div className="flex justify-between text-[10px] font-mono text-white/25 mb-1.5">
                  <span>REPUTATION</span>
                  <span>{MOCK_TASK.workerReputation}/100</span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400/60 transition-all"
                    style={{ width: `${MOCK_TASK.workerReputation}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Scouts used */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex flex-col gap-3">
              <div className="text-[10px] font-mono text-white/30 tracking-widest">SCOUTS USED</div>
              <div className="flex flex-wrap gap-2">
                {MOCK_TASK.scoutsUsed.map(s => (
                  <span key={s} className="px-2.5 py-1 rounded-lg border border-white/[0.10] text-[10px] font-mono text-white/50">
                    {s}
                  </span>
                ))}
              </div>
              <div className="pt-2 border-t border-white/[0.05]">
                <div className="text-[9px] font-mono text-white/25 mb-0.5">AUCTION DURATION</div>
                <div className="text-xs font-mono text-white/50">{MOCK_TASK.auctionDuration}</div>
              </div>
            </div>

            {/* Back */}
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
  )
}
