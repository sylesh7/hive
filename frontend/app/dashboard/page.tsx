"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PageShell } from "@/components/page-shell"
import { useWeb3Auth } from "@/context/web3auth"

type TaskStatus = "auction" | "delivery" | "evaluating" | "settled" | "refunded" | "cancelled"

interface ActiveTask {
  id: string
  title: string
  status: TaskStatus
  statusLabel: string
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

const MOCK_ACTIVE: ActiveTask[] = [
  { id: "t1", title: "Audit smart contract",   status: "auction",    statusLabel: "Auction live — closes in 0:34",  bestBid: "28 USDC", route: "/tasks/t1/auction" },
  { id: "t2", title: "Design logo for HiveBid", status: "delivery",  statusLabel: "Delivery due in 1h 20m",         bestBid: "22 USDC", route: "/tasks/t2/delivery" },
  { id: "t3", title: "Write pitch deck copy",   status: "evaluating", statusLabel: "Awaiting evaluator",             bestBid: "15 USDC", route: "/tasks/t3/delivery" },
]

const MOCK_HISTORY: HistoryTask[] = [
  { id: "h1", title: "Research report on Base L2", finalPrice: "40 USDC", worker: "ResearchBot", status: "settled",  date: "Apr 29" },
  { id: "h2", title: "Solidity gas optimisation",  finalPrice: "55 USDC", worker: "AuditAgent",  status: "settled",  date: "Apr 28" },
  { id: "h3", title: "Landing page copy",           finalPrice: "18 USDC", worker: "CopywriterX", status: "refunded", date: "Apr 27" },
  { id: "h4", title: "Token icon design",           finalPrice: "12 USDC", worker: "PixelForge",  status: "settled",  date: "Apr 26" },
]

const MOCK_DELEGATIONS: Delegation[] = [
  { id: "d1", task: "Audit smart contract", cap: "35 USDC", expiresIn: "38 min" },
]

function StatusPill({ status }: { status: TaskStatus | "settled" | "refunded" | "cancelled" }) {
  const styles: Record<string, string> = {
    auction:    "bg-amber-500/20 text-amber-300 border-amber-500/40",
    delivery:   "bg-blue-500/20 text-blue-300 border-blue-500/40",
    evaluating: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    settled:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    refunded:   "bg-white/10 text-white/50 border-white/20",
    cancelled:  "bg-white/10 text-white/40 border-white/15",
  }
  const labels: Record<string, string> = {
    auction: "LIVE", delivery: "DELIVERING", evaluating: "EVALUATING",
    settled: "PAID", refunded: "REFUNDED", cancelled: "CANCELLED",
  }
  return (
    <span className={`px-2 py-0.5 rounded border text-[10px] font-mono tracking-widest shrink-0 ${styles[status] ?? ""}`}>
      {labels[status] ?? status.toUpperCase()}
    </span>
  )
}

// ─── Solid card ───────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.12] bg-[#111110] ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ label }: { label: string }) {
  return (
    <div className="text-[10px] font-mono text-white/40 tracking-widest mb-4">{label}</div>
  )
}

export default function Dashboard() {
  const { isConnected, address } = useWeb3Auth()
  const router = useRouter()
  const [revoking, setRevoking] = useState<string | null>(null)

  const handleRevoke = (id: string) => {
    setRevoking(id)
    setTimeout(() => setRevoking(null), 1500)
  }

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-24 pb-20">

        {/* ── Page header ── */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="text-white/40 text-[10px] font-mono tracking-widest mb-1">DASHBOARD</div>
            <h1 className="text-2xl font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
              {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Your workspace"}
            </h1>
          </div>
          <button
            onClick={() => router.push("/tasks/new")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#0B0B09] text-[11px] font-mono font-medium tracking-widest hover:bg-white/90 transition-colors"
          >
            <span>+</span> POST TASK
          </button>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "USDC BALANCE", value: "250.00", sub: "Base Sepolia" },
            { label: "ACTIVE TASKS", value: String(MOCK_ACTIVE.length), sub: "in progress" },
            { label: "COMPLETED",    value: String(MOCK_HISTORY.filter(h => h.status === "settled").length), sub: "all time" },
            { label: "ETH (GAS)",    value: "0.012",  sub: "Base Sepolia" },
          ].map(stat => (
            <Card key={stat.label} className="p-4">
              <div className="text-[9px] font-mono text-white/40 tracking-widest mb-2">{stat.label}</div>
              <div className="text-xl font-light font-mono text-white">{stat.value}</div>
              <div className="text-[10px] font-mono text-white/30 mt-1">{stat.sub}</div>
            </Card>
          ))}
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* ── CENTER: Active tasks (widest) ── */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <Card className="overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-white/[0.07]">
                <CardHeader label="ACTIVE TASKS" />
              </div>

              {MOCK_ACTIVE.length === 0 ? (
                <div className="p-10 text-center text-white/30 text-sm">No active tasks</div>
              ) : (
                MOCK_ACTIVE.map((task, i) => (
                  <Link key={task.id} href={task.route}>
                    <div className={`flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04] transition-colors cursor-pointer group ${i < MOCK_ACTIVE.length - 1 ? "border-b border-white/[0.07]" : ""}`}>
                      {/* Status dot */}
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        task.status === "auction" ? "bg-amber-400 animate-pulse" :
                        task.status === "delivery" ? "bg-blue-400" : "bg-purple-400"
                      }`} />
                      {/* Title + status */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-light text-white/90 group-hover:text-white transition-colors truncate">{task.title}</div>
                        <div className="text-[11px] font-mono text-white/40 mt-0.5">{task.statusLabel}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-mono text-white/70">{task.bestBid}</span>
                        <StatusPill status={task.status} />
                      </div>
                    </div>
                  </Link>
                ))
              )}

              <div className="px-5 py-3 border-t border-white/[0.07]">
                <button onClick={() => router.push("/tasks/new")} className="text-[10px] font-mono text-white/30 hover:text-white/60 tracking-widest transition-colors">
                  + POST NEW TASK
                </button>
              </div>
            </Card>

            {/* Recent history */}
            <Card className="overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-white/[0.07]">
                <CardHeader label="RECENT HISTORY" />
              </div>
              {MOCK_HISTORY.map((task, i) => (
                <Link key={task.id} href={`/tasks/${task.id}`}>
                  <div className={`flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer group ${i < MOCK_HISTORY.length - 1 ? "border-b border-white/[0.07]" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-light text-white/80 group-hover:text-white transition-colors truncate">{task.title}</div>
                      <div className="text-[10px] font-mono text-white/35 mt-0.5">{task.worker} · {task.date}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono text-white/60">{task.finalPrice}</span>
                      <StatusPill status={task.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </Card>
          </div>

          {/* ── RIGHT: Wallet + Delegations ── */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            {/* Wallet */}
            <Card className="p-5">
              <CardHeader label="WALLET" />
              {isConnected ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-[9px] font-mono text-white/35 mb-1">USDC</div>
                    <div className="text-3xl font-light font-mono text-white">250.00</div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.08]">
                    <div>
                      <div className="text-[9px] font-mono text-white/35 mb-1">ETH (GAS)</div>
                      <div className="text-base font-mono text-white/70">0.012</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-mono text-white/35 mb-1">NETWORK</div>
                      <div className="text-[11px] font-mono text-white/60">Base Sepolia</div>
                    </div>
                  </div>
                  <button className="w-full py-2 rounded-xl border border-white/[0.10] text-[10px] font-mono text-white/40 hover:text-white/60 hover:border-white/20 transition-colors tracking-widest">
                    ADD FUNDS
                  </button>
                </div>
              ) : (
                <p className="text-sm text-white/40">Connect wallet to view balance</p>
              )}
            </Card>

            {/* Active delegations */}
            <Card className="p-5">
              <CardHeader label="ACTIVE DELEGATIONS" />
              {MOCK_DELEGATIONS.length === 0 ? (
                <p className="text-xs text-white/30">No active delegations</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {MOCK_DELEGATIONS.map(d => (
                    <div key={d.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                      <div className="text-xs text-white/80 mb-2 leading-snug">{d.task}</div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-[9px] font-mono text-white/35">CAP</div>
                            <div className="text-[11px] font-mono text-white/70">{d.cap}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-mono text-white/35">EXPIRES</div>
                            <div className="text-[11px] font-mono text-white/70">{d.expiresIn}</div>
                          </div>
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
              <p className="text-[10px] font-mono text-white/25 mt-3 leading-relaxed">
                Each task creates a scoped EIP-7702 delegation. Revoke anytime to cancel spending permission.
              </p>
            </Card>

            {/* Quick links */}
            <Card className="p-5">
              <CardHeader label="QUICK ACTIONS" />
              <div className="flex flex-col gap-2">
                {[
                  { label: "Post a new task", route: "/tasks/new", icon: "+" },
                  { label: "View auction",    route: "/tasks/t1/auction", icon: "→" },
                  { label: "Track delivery",  route: "/tasks/t2/delivery", icon: "→" },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => router.push(item.route)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.04] transition-all group"
                  >
                    <span className="text-sm font-light text-white/70 group-hover:text-white transition-colors">{item.label}</span>
                    <span className="text-white/30 group-hover:text-white/70 transition-colors font-mono text-sm">{item.icon}</span>
                  </button>
                ))}
              </div>
            </Card>

          </div>
        </div>
      </div>
    </PageShell>
  )
}
