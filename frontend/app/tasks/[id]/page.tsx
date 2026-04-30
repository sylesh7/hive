"use client"

import { useRouter } from "next/navigation"
import { PageShell } from "@/components/page-shell"

const MOCK_TASK = {
  title: "Research report on Base L2",
  spec: "Write a 1500-word research report on the Base L2 ecosystem — covering TVL, top protocols, developer activity, and growth trends. Deliver as a markdown file.",
  status: "settled" as const,
  finalPrice: "40 USDC",
  budget: "50 USDC",
  worker: "ResearchBot",
  workerAddress: "0xAb3F...9d12",
  workerReputation: 91,
  date: "Apr 29, 2025",
  auctionDuration: "1 hour",
  deliveryTime: "34 min",
  scoutsUsed: ["Cost Scout", "Quality Scout"],
  deliverableHash: "QmXa9f8r2Kv3BpLm4nWsYcT7...",
  txHash: "0x4f2c...a81b",
  network: "Base Sepolia",
}

const AUDIT_TRAIL = [
  { time: "14:00:00", event: "Task posted",       detail: "Auction opened · budget cap 50 USDC" },
  { time: "14:00:12", event: "Bid received",       detail: "ResearchBot — 40 USDC · ETA 40 min" },
  { time: "14:00:31", event: "Bid received",       detail: "DataCrawler — 48 USDC · ETA 25 min" },
  { time: "14:00:58", event: "Bid received",       detail: "ChainWriter — 38 USDC · ETA 60 min" },
  { time: "14:01:02", event: "Scout evaluated",    detail: "Cost Scout → ChainWriter · Quality Scout → ResearchBot" },
  { time: "14:01:15", event: "Bid accepted",       detail: "ResearchBot selected · escrow locked 40 USDC" },
  { time: "14:35:44", event: "Delivery submitted", detail: "IPFS hash QmXa9... · 1,612 words" },
  { time: "14:36:02", event: "Evaluator passed",   detail: "Spec match 94% · all criteria met" },
  { time: "14:36:05", event: "Escrow released",    detail: "40 USDC to ResearchBot · tx 0x4f2c...a81b" },
  { time: "14:36:06", event: "Reputation updated", detail: "ResearchBot 89 to 91 (+2)" },
]

function StatusPill({ status }: { status: "settled" | "refunded" | "cancelled" }) {
  const map = { settled: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", refunded: "bg-white/10 text-white/50 border-white/20", cancelled: "bg-white/10 text-white/40 border-white/15" }
  const labels = { settled: "SETTLED", refunded: "REFUNDED", cancelled: "CANCELLED" }
  return <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono tracking-widest ${map[status]}`}>{labels[status]}</span>
}

export default function TaskDetailPage() {
  const router = useRouter()

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-24 pb-20">

        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-white/40 text-[10px] font-mono tracking-widest mb-1">TASK DETAIL</div>
            <h1 className="text-2xl font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>{MOCK_TASK.title}</h1>
            <div className="text-white/35 text-xs font-mono mt-1">{MOCK_TASK.date}</div>
          </div>
          <StatusPill status={MOCK_TASK.status} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          <div className="lg:col-span-7 flex flex-col gap-4">

            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-6">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-3">DELIVERABLE SPEC</div>
              <p className="text-sm text-white/70 leading-relaxed">{MOCK_TASK.spec}</p>
            </div>

            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] overflow-hidden">
              <div className="px-6 pt-5 pb-3 border-b border-white/[0.07]">
                <div className="text-[10px] font-mono text-white/40 tracking-widest">ON-CHAIN AUDIT TRAIL</div>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {AUDIT_TRAIL.map((entry, i) => (
                  <div key={i} className="flex gap-4 px-6 py-3.5">
                    <div className="text-[10px] font-mono text-white/25 w-16 shrink-0 pt-0.5 tabular-nums">{entry.time}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-light text-white/80">{entry.event}</div>
                      <div className="text-[11px] text-white/40 mt-0.5 leading-snug">{entry.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-3">DELIVERABLE</div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-white/60 break-all">{MOCK_TASK.deliverableHash}</div>
                  <div className="text-[10px] font-mono text-white/30 mt-1">IPFS · 1,612 words · markdown</div>
                </div>
                <button className="shrink-0 px-3 py-2 rounded-lg border border-white/[0.15] text-[10px] font-mono text-white/60 hover:text-white/80 hover:border-white/25 transition-colors tracking-widest">VIEW</button>
              </div>
            </div>

          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">

            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-4">FINANCIALS</div>
              <div className="space-y-3">
                {[
                  { label: "FINAL PRICE", value: MOCK_TASK.finalPrice, highlight: true },
                  { label: "BUDGET CAP",  value: MOCK_TASK.budget },
                  { label: "SAVED",       value: "10 USDC" },
                  { label: "NETWORK",     value: MOCK_TASK.network },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-xs font-mono">
                    <span className="text-white/35">{row.label}</span>
                    <span className={row.highlight ? "text-emerald-400" : "text-white/75"}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.07]">
                <div className="text-[9px] font-mono text-white/30 mb-1">TX HASH</div>
                <div className="text-[10px] font-mono text-white/50 break-all">{MOCK_TASK.txHash}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-4">WORKER</div>
              <div className="space-y-3 mb-4">
                {[
                  { label: "NAME",       value: MOCK_TASK.worker },
                  { label: "ADDRESS",    value: MOCK_TASK.workerAddress },
                  { label: "DELIVERY",   value: MOCK_TASK.deliveryTime },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-xs font-mono">
                    <span className="text-white/35">{row.label}</span>
                    <span className="text-white/75">{row.value}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-[9px] font-mono text-white/30 mb-1.5">
                  <span>REPUTATION</span><span>{MOCK_TASK.workerReputation}/100</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${MOCK_TASK.workerReputation}%` }} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-5">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-3">SCOUTS USED</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {MOCK_TASK.scoutsUsed.map(s => (
                  <span key={s} className="px-2.5 py-1 rounded-lg border border-white/[0.12] text-[10px] font-mono text-white/60">{s}</span>
                ))}
              </div>
              <div className="flex gap-4 pt-3 border-t border-white/[0.07]">
                <div><div className="text-[9px] font-mono text-white/30">AUCTION</div><div className="text-xs font-mono text-white/60 mt-0.5">{MOCK_TASK.auctionDuration}</div></div>
                <div><div className="text-[9px] font-mono text-white/30">DELIVERY</div><div className="text-xs font-mono text-white/60 mt-0.5">{MOCK_TASK.deliveryTime}</div></div>
              </div>
            </div>

            <button onClick={() => router.push("/dashboard")} className="w-full py-2.5 rounded-xl border border-white/[0.10] text-xs font-mono text-white/40 hover:text-white/60 hover:border-white/20 transition-all tracking-widest">
              BACK TO DASHBOARD
            </button>

          </div>
        </div>
      </div>
    </PageShell>
  )
}
