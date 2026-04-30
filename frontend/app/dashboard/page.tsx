"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"
import { useWeb3Auth } from "@/context/web3auth"

// ─── Types ───────────────────────────────────────────────────────────────────
type TaskStatus = "auction" | "delivery" | "evaluating" | "settled" | "refunded" | "cancelled"

interface ActiveTask {
  id: string
  title: string
  status: TaskStatus
  statusLabel: string
  timeLeft: string
  bestBid: string
  route: string
}

interface HistoryTask {
  id: string
  title: string
  finalPrice: string
  worker: string
  status: "settled" | "refunded" | "cancelled"
  date: string
}

interface Delegation {
  id: string
  task: string
  cap: string
  expiresIn: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_ACTIVE: ActiveTask[] = [
  { id: "t1", title: "Audit smart contract", status: "auction",   statusLabel: "Auction live — closes in 0:34", timeLeft: "0:34", bestBid: "28 USDC",  route: "/tasks/t1/auction" },
  { id: "t2", title: "Design logo for HiveBid",   status: "delivery", statusLabel: "Delivery due in 1h 20m",       timeLeft: "1h 20m", bestBid: "22 USDC", route: "/tasks/t2/delivery" },
  { id: "t3", title: "Write pitch deck copy",      status: "evaluating", statusLabel: "Awaiting evaluator",           timeLeft: "—",       bestBid: "15 USDC", route: "/tasks/t3/delivery" },
]

const MOCK_HISTORY: HistoryTask[] = [
  { id: "h1", title: "Research report on Base L2", finalPrice: "40 USDC", worker: "ResearchBot",  status: "settled",   date: "Apr 29" },
  { id: "h2", title: "Solidity gas optimisation",  finalPrice: "55 USDC", worker: "AuditAgent",   status: "settled",   date: "Apr 28" },
  { id: "h3", title: "Landing page copy",           finalPrice: "18 USDC", worker: "CopywriterX",  status: "refunded",  date: "Apr 27" },
  { id: "h4", title: "Token icon design",           finalPrice: "12 USDC", worker: "PixelForge",   status: "settled",   date: "Apr 26" },
]

const MOCK_DELEGATIONS: Delegation[] = [
  { id: "d1", task: "Audit smart contract", cap: "35 USDC", expiresIn: "38 min" },
]

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: TaskStatus | "settled" | "refunded" | "cancelled" }) {
  const map: Record<string, string> = {
    auction:    "bg-amber-500/15 text-amber-400 border-amber-500/25",
    delivery:   "bg-blue-500/15 text-blue-400 border-blue-500/25",
    evaluating: "bg-purple-500/15 text-purple-400 border-purple-500/25",
    settled:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    refunded:   "bg-white/10 text-white/40 border-white/15",
    cancelled:  "bg-white/10 text-white/30 border-white/10",
  }
  const labels: Record<string, string> = {
    auction: "LIVE", delivery: "DELIVERING", evaluating: "EVALUATING",
    settled: "PAID", refunded: "REFUNDED", cancelled: "CANCELLED",
  }
  return (
    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-mono tracking-widest ${map[status] ?? ""}`}>
      {labels[status] ?? status.toUpperCase()}
    </span>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { isConnected, address } = useWeb3Auth()
  const router = useRouter()
  const [revoking, setRevoking] = useState<string | null>(null)

  const handleRevoke = (id: string) => {
    setRevoking(id)
    setTimeout(() => setRevoking(null), 1500)
  }

  return (
    <div className="bg-[#0B0B09] text-[#F0EFEA] min-h-screen font-sans antialiased">
      <MobileNav />

      <div className="max-w-7xl mx-auto px-6 md:px-12 pt-28 pb-20">

        {/* Page header */}
        <div className="mb-10">
          <div className="text-white/30 text-[11px] font-mono tracking-widest mb-1">DASHBOARD</div>
          <h1 className="text-3xl font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
            {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Your workspace"}
          </h1>
        </div>

        {/* Three-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-3 flex flex-col gap-4">

            {/* Post new task */}
            <button
              onClick={() => router.push("/tasks/new")}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 transition-all duration-200 group"
            >
              <span className="text-sm font-light tracking-wide">Post a new task</span>
              <span className="text-white/40 group-hover:text-white/80 transition-colors text-lg">+</span>
            </button>

            {/* Wallet balance */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <div className="text-[10px] font-mono text-white/30 tracking-widest mb-4">WALLET</div>
              {isConnected ? (
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-white/40 text-xs">USDC</span>
                    <span className="text-xl font-light font-mono">250.00</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-white/40 text-xs">ETH (gas)</span>
                    <span className="text-sm font-light font-mono text-white/60">0.012</span>
                  </div>
                  <div className="pt-2 border-t border-white/[0.06]">
                    <div className="text-[10px] text-white/25 font-mono">Base Sepolia</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-white/30">Connect wallet to view balance</p>
              )}
            </div>

            {/* Active delegations */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <div className="text-[10px] font-mono text-white/30 tracking-widest mb-4">ACTIVE DELEGATIONS</div>
              {MOCK_DELEGATIONS.length === 0 ? (
                <p className="text-xs text-white/25">No active delegations</p>
              ) : (
                <div className="space-y-3">
                  {MOCK_DELEGATIONS.map(d => (
                    <div key={d.id} className="flex flex-col gap-2 pb-3 border-b border-white/[0.05] last:border-0 last:pb-0">
                      <div className="text-xs text-white/70 leading-snug">{d.task}</div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-mono text-white/35">Cap </span>
                          <span className="text-[10px] font-mono text-white/60">{d.cap}</span>
                          <span className="text-[10px] font-mono text-white/25 ml-2">· {d.expiresIn}</span>
                        </div>
                        <button
                          onClick={() => handleRevoke(d.id)}
                          disabled={revoking === d.id}
                          className="text-[10px] font-mono text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-40 tracking-widest"
                        >
                          {revoking === d.id ? "REVOKING…" : "REVOKE"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── CENTER COLUMN ── */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="text-[10px] font-mono text-white/30 tracking-widest">ACTIVE TASKS</div>

            {MOCK_ACTIVE.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-10 flex flex-col items-center gap-3">
                <div className="text-white/20 text-sm">No active tasks</div>
                <button
                  onClick={() => router.push("/tasks/new")}
                  className="text-[11px] font-mono text-white/40 hover:text-white/70 tracking-widest transition-colors"
                >
                  POST YOUR FIRST TASK →
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {MOCK_ACTIVE.map(task => (
                  <Link key={task.id} href={task.route}>
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 hover:border-white/[0.14] hover:bg-white/[0.05] transition-all duration-200 cursor-pointer group">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="text-sm font-light text-white/90 leading-snug group-hover:text-white transition-colors">{task.title}</div>
                        <StatusPill status={task.status} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-white/35 font-mono">{task.statusLabel}</div>
                        <div className="text-xs font-mono text-white/50">{task.bestBid}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="text-[10px] font-mono text-white/30 tracking-widest">RECENT HISTORY</div>

            {MOCK_HISTORY.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 text-center">
                <div className="text-white/20 text-sm">No completed tasks yet</div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">
                {MOCK_HISTORY.map((task, i) => (
                  <Link key={task.id} href={`/tasks/${task.id}`}>
                    <div className={`flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04] transition-colors cursor-pointer group ${i < MOCK_HISTORY.length - 1 ? "border-b border-white/[0.05]" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-light text-white/80 truncate group-hover:text-white transition-colors">{task.title}</div>
                        <div className="text-[10px] font-mono text-white/30 mt-0.5">{task.worker} · {task.date}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs font-mono text-white/60">{task.finalPrice}</span>
                        <StatusPill status={task.status} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
