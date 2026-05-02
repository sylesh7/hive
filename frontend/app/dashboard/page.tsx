"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PageShell } from "@/components/page-shell"
import { useWeb3Auth } from "@/context/web3auth"
import { useBackendStore } from "@/context/backend-store"
import type { TaskRecord } from "@/lib/backend"

function taskRoute(task: TaskRecord): string {
  if (task.state === "AUCTION_OPEN") return `/tasks/${task.task_id}/auction`
  if (["DELIVERY_PENDING", "EVALUATING"].includes(task.state)) return `/tasks/${task.task_id}/delivery`
  return `/tasks/${task.task_id}`
}

function taskLabel(task: TaskRecord, _tick: number): string {
  if (task.state === "AUCTION_OPEN") {
    const rem = Math.max(0, Math.round((task.auction_end - Date.now() / 1000)))
    const m = Math.floor(rem / 60), s = rem % 60
    return `Auction live — closes in ${m}:${String(s).padStart(2,"0")}`
  }
  const map: Record<string,string> = { DELIVERY_PENDING:"Awaiting delivery", EVALUATING:"Evaluator running…", SETTLED:"Settled", REFUNDED:"Refunded", CANCELLED:"Cancelled" }
  return map[task.state] ?? task.state
}

function bestBid(task: TaskRecord): string {
  if (task.winning_bid) return `${task.winning_bid.bid_price_usdc.toFixed(2)} USDC`
  if (task.bids?.length) return `${Math.min(...task.bids.map(b=>b.bid_price_usdc)).toFixed(2)} USDC`
  return `${task.spec.max_budget_usdc} USDC cap`
}

function StatusPill({ status }: { status: string }) {
  const s: Record<string,string> = {
    AUCTION_OPEN:"bg-amber-500/20 text-amber-300 border-amber-500/40",
    DELIVERY_PENDING:"bg-blue-500/20 text-blue-300 border-blue-500/40",
    EVALUATING:"bg-purple-500/20 text-purple-300 border-purple-500/40",
    SETTLED:"bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    REFUNDED:"bg-white/10 text-white/50 border-white/20",
    CANCELLED:"bg-white/10 text-white/40 border-white/15",
  }
  const l: Record<string,string> = { AUCTION_OPEN:"LIVE", DELIVERY_PENDING:"DELIVERING", EVALUATING:"EVALUATING", SETTLED:"PAID", REFUNDED:"REFUNDED", CANCELLED:"CANCELLED" }
  return <span className={`px-2 py-0.5 rounded border text-[10px] font-mono tracking-widest shrink-0 ${s[status]??""}`}>{l[status]??status}</span>
}

function Card({ children, className="" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/[0.12] bg-[#111110] ${className}`}>{children}</div>
}

export default function Dashboard() {
  const { isConnected, address } = useWeb3Auth()
  const router = useRouter()
  const { activeTasks, historyTasks, backendOnline, connected, events } = useBackendStore()
  const [tick, setTick] = useState(0)
  useEffect(() => { const t = setInterval(()=>setTick(n=>n+1),1000); return ()=>clearInterval(t) }, [])

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-24 pb-20">

        {/* Backend offline banner */}
        {!backendOnline && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <p className="text-xs font-mono text-amber-300/80">
              Backend offline — run <code className="text-amber-300">python start.py</code> in <code className="text-amber-300">backend/</code>
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="text-white/40 text-[10px] font-mono tracking-widest mb-1">DASHBOARD</div>
            <h1 className="text-2xl font-light tracking-tight" style={{ fontFamily:'"IBM Plex Sans", sans-serif' }}>
              {address ? `${address.slice(0,6)}…${address.slice(-4)}` : "Your workspace"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? "bg-emerald-400" : "bg-white/20"}`} />
              <span className="text-[9px] font-mono text-white/30">{backendOnline ? "LIVE" : "OFFLINE"}</span>
            </div>
            <button onClick={()=>router.push("/tasks/new")} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#0B0B09] text-[11px] font-mono font-medium tracking-widest hover:bg-white/90 transition-colors">
              <span>+</span> POST TASK
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label:"ACTIVE TASKS", value: String(activeTasks.length), sub:"in progress" },
            { label:"COMPLETED",    value: String(historyTasks.filter(h=>h.state==="SETTLED").length), sub:"all time" },
            { label:"TOTAL SPENT",  value: historyTasks.filter(h=>h.winning_bid).reduce((s,h)=>s+(h.winning_bid?.bid_price_usdc??0),0).toFixed(0)+" USDC", sub:"on settled tasks" },
            { label:"NETWORK",      value:"Base Sepolia", sub: isConnected ? "connected" : "not connected" },
          ].map(stat=>(
            <Card key={stat.label} className="p-4">
              <div className="text-[9px] font-mono text-white/40 tracking-widest mb-2">{stat.label}</div>
              <div className="text-xl font-light font-mono text-white">{stat.value}</div>
              <div className="text-[10px] font-mono text-white/30 mt-1">{stat.sub}</div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Active tasks */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <Card className="overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-white/[0.07]">
                <div className="text-[10px] font-mono text-white/40 tracking-widest">ACTIVE TASKS</div>
              </div>
              {activeTasks.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-white/30 text-sm mb-4">No active tasks</p>
                  <button onClick={()=>router.push("/tasks/new")} className="px-6 py-2.5 rounded-xl bg-white text-[#0B0B09] text-[11px] font-mono font-medium tracking-widest hover:bg-white/90 transition-colors">
                    + POST FIRST TASK
                  </button>
                </div>
              ) : activeTasks.map((task,i)=>(
                <Link key={task.task_id} href={taskRoute(task)}>
                  <div className={`flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04] transition-colors cursor-pointer group ${i<activeTasks.length-1?"border-b border-white/[0.07]":""}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${task.state==="AUCTION_OPEN"?"bg-amber-400 animate-pulse":task.state==="DELIVERY_PENDING"?"bg-blue-400":"bg-purple-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-light text-white/90 group-hover:text-white transition-colors truncate">{task.spec.title}</div>
                      <div className="text-[11px] font-mono text-white/40 mt-0.5">{taskLabel(task, tick)} · {task.bids?.length??0} bids</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-mono text-white/70">{bestBid(task)}</span>
                      <StatusPill status={task.state} />
                    </div>
                  </div>
                </Link>
              ))}
              <div className="px-5 py-3 border-t border-white/[0.07]">
                <button onClick={()=>router.push("/tasks/new")} className="text-[10px] font-mono text-white/30 hover:text-white/60 tracking-widest transition-colors">+ POST NEW TASK</button>
              </div>
            </Card>

            {/* History */}
            <Card className="overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-white/[0.07]">
                <div className="text-[10px] font-mono text-white/40 tracking-widest">RECENT HISTORY</div>
              </div>
              {historyTasks.length === 0 ? (
                <div className="p-8 text-center text-white/25 text-sm">No completed tasks yet</div>
              ) : historyTasks.slice(0,6).map((task,i)=>(
                <Link key={task.task_id} href={`/tasks/${task.task_id}`}>
                  <div className={`flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer group ${i<Math.min(historyTasks.length,6)-1?"border-b border-white/[0.07]":""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-light text-white/80 group-hover:text-white transition-colors truncate">{task.spec.title}</div>
                      <div className="text-[10px] font-mono text-white/35 mt-0.5">{task.winning_bid?.worker_name??"—"} · {new Date(task.updated_at*1000).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono text-white/60">{bestBid(task)}</span>
                      <StatusPill status={task.state} />
                    </div>
                  </div>
                </Link>
              ))}
            </Card>
          </div>

          {/* Right column */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            <Card className="p-5">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-4">WALLET</div>
              {isConnected ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-[9px] font-mono text-white/35 mb-1">ADDRESS</div>
                    <div className="text-xs font-mono text-white/70 break-all">{address}</div>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-white/[0.08]">
                    <div><div className="text-[9px] font-mono text-white/35">NETWORK</div><div className="text-[11px] font-mono text-white/60 mt-0.5">Base Sepolia</div></div>
                    <div className="text-right"><div className="text-[9px] font-mono text-white/35">STANDARD</div><div className="text-[11px] font-mono text-white/60 mt-0.5">EIP-7702</div></div>
                  </div>
                </div>
              ) : <p className="text-sm text-white/40">Connect wallet to view</p>}
            </Card>

            {/* Live agent feed */}
            <Card className="p-5">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-4">LIVE AGENT FEED</div>
              {events.length === 0 ? (
                <div className="h-36 flex items-center justify-center flex-col gap-2">
                  <span className="w-2 h-2 rounded-full bg-white/10 animate-pulse" />
                  <span className="text-[10px] font-mono text-white/25">Waiting for events…</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-hidden">
                  {events.slice(0,10).map((ev,i)=>{
                    const cfg: Record<string,{label:string;dot:string;text:string}> = {
                      NEW_BID:{label:"New bid",dot:"bg-amber-400",text:"text-amber-300"},
                      SCOUT_UPDATE:{label:"Scout",dot:"bg-blue-400",text:"text-blue-300"},
                      TASK_CREATED:{label:"Task posted",dot:"bg-emerald-400",text:"text-emerald-300"},
                      AUCTION_CLOSED:{label:"Auction closed",dot:"bg-purple-400",text:"text-purple-300"},
                      ESCROW_LOCKED:{label:"Escrow locked",dot:"bg-emerald-400",text:"text-emerald-300"},
                      WORKER_STATUS:{label:"Worker",dot:"bg-blue-400",text:"text-blue-300"},
                      DELIVERY_RECEIVED:{label:"Delivery",dot:"bg-purple-400",text:"text-purple-300"},
                      PAYMENT_RELEASED:{label:"Paid",dot:"bg-emerald-400",text:"text-emerald-300"},
                      WS_CONNECTED:{label:"Connected",dot:"bg-emerald-400",text:"text-emerald-300"},
                      WS_DISCONNECTED:{label:"Disconnected",dot:"bg-red-400",text:"text-red-400"},
                    }
                    const c = cfg[ev.event] ?? {label:ev.event,dot:"bg-white/20",text:"text-white/50"}
                    return (
                      <div key={i} className="flex items-center gap-2.5 py-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                        <span className={`text-[10px] font-mono ${c.text} shrink-0`}>{c.label}</span>
                        <span className="text-[9px] font-mono text-white/25 ml-auto shrink-0">{new Date(ev.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-4">QUICK ACTIONS</div>
              <div className="flex flex-col gap-2">
                {[
                  { label:"Post a new task", route:"/tasks/new", icon:"+" },
                  ...activeTasks.filter(t=>t.state==="AUCTION_OPEN").slice(0,1).map(t=>({ label:`Watch auction`, route:`/tasks/${t.task_id}/auction`, icon:"→" })),
                  ...activeTasks.filter(t=>t.state==="DELIVERY_PENDING").slice(0,1).map(t=>({ label:`Track delivery`, route:`/tasks/${t.task_id}/delivery`, icon:"→" })),
                ].map(item=>(
                  <button key={item.label} onClick={()=>router.push(item.route)} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.04] transition-all group">
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
