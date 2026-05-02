"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useWeb3Auth } from "@/context/web3auth"
import { HexagonPattern } from "@/components/ui/hexagon-pattern"

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`rounded-full transition-all duration-300 ${
          i < current ? "w-6 h-1.5 bg-white/50" : i === current ? "w-6 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/20"
        }`} />
      ))}
      <span className="ml-2 text-[11px] font-mono text-white/30 tracking-widest">{current + 1} / {total}</span>
    </div>
  )
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────
function StepRegister({ address, onComplete }: { address: string | null; onComplete: () => void }) {
  const [name, setName] = useState("")
  const [registering, setRegistering] = useState(false)
  const [done, setDone] = useState(false)
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "0x···"

  const handleRegister = async () => {
    if (!name.trim()) return
    setRegistering(true)
    await new Promise(r => setTimeout(r, 1800))
    setRegistering(false)
    setDone(true)
    onComplete()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1">STEP 1 OF 3</div>
        <h2 className="text-2xl font-light mb-2" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>Register your agent identity</h2>
        <p className="text-sm text-white/50 leading-relaxed">Your hiring agent needs an on-chain identity (ERC-8004) — a wallet address, reputation record, and a name workers can bid on.</p>
      </div>

      <div className="rounded-xl border border-white/[0.12] bg-[#0f0f0d] p-4 font-mono text-xs space-y-2.5">
        {[{ label: "WALLET", value: shortAddr }, { label: "NAME", value: name || "—" }, { label: "NETWORK", value: "Base Sepolia" }].map(row => (
          <div key={row.label} className="flex justify-between">
            <span className="text-white/35">{row.label}</span>
            <span className="text-white/70">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-mono text-white/40 tracking-widest">AGENT NAME</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. my-hiring-agent" disabled={done}
          className="bg-[#0f0f0d] border border-white/[0.15] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors disabled:opacity-50" />
      </div>

      {done ? (
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          Identity registered on Base Sepolia
        </div>
      ) : (
        <button onClick={handleRegister} disabled={!name.trim() || registering}
          className="self-start px-5 py-2.5 rounded-xl border border-white/[0.20] text-sm font-mono tracking-widest text-white/80 hover:text-white hover:border-white/35 hover:bg-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed">
          {registering ? "REGISTERING…" : "REGISTER IDENTITY →"}
        </button>
      )}
    </div>
  )
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────
const SCOUTS = [
  { id: "cost",    name: "Cost Scout",    tag: "CHEAPEST",        desc: "Always picks the lowest bid that meets your deliverable spec." },
  { id: "quality", name: "Quality Scout", tag: "BEST REPUTATION", desc: "Reads on-chain ERC-8004 reputation and weights score against price." },
  { id: "speed",   name: "Speed Scout",   tag: "FASTEST",         desc: "Prioritizes fastest estimated delivery regardless of price." },
]

function StepScouts() {
  const [selected, setSelected] = useState<string[]>(["cost"])
  const toggle = (id: string) => setSelected(prev =>
    prev.includes(id) ? (prev.length > 1 ? prev.filter(s => s !== id) : prev) : [...prev, id]
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1">STEP 2 OF 3</div>
        <h2 className="text-2xl font-light mb-2" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>Choose your default scouts</h2>
        <p className="text-sm text-white/50 leading-relaxed">Scouts evaluate incoming bids by different strategies. You can override per task.</p>
      </div>
      <div className="flex flex-col gap-2">
        {SCOUTS.map(scout => {
          const active = selected.includes(scout.id)
          return (
            <button key={scout.id} onClick={() => toggle(scout.id)}
              className={`text-left flex items-center gap-4 p-4 rounded-xl border transition-all duration-150 ${active ? "border-white/25 bg-white/[0.06]" : "border-white/[0.10] bg-[#0f0f0d] hover:border-white/[0.18]"}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-light text-white">{scout.name}</span>
                  <span className="text-[9px] font-mono text-white/35 tracking-widest">{scout.tag}</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{scout.desc}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${active ? "border-white bg-white" : "border-white/25"}`} />
            </button>
          )
        })}
      </div>
      <div className="text-[10px] font-mono text-white/30">{selected.length} scout{selected.length > 1 ? "s" : ""} selected</div>
    </div>
  )
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────
function StepSpending({ onComplete }: { onComplete: () => void }) {
  const [cap, setCap] = useState("100")
  const [confirmed, setConfirmed] = useState(false)
  const [signing, setSigning] = useState(false)

  const handleConfirm = async () => {
    setSigning(true)
    await new Promise(r => setTimeout(r, 2000))
    setSigning(false)
    setConfirmed(true)
    onComplete()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1">STEP 3 OF 3</div>
        <h2 className="text-2xl font-light mb-2" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>Set your spending limit</h2>
        <p className="text-sm text-white/50 leading-relaxed">Your agent gets a one-time permission to spend only up to your set budget — only for that task, only for one hour.</p>
      </div>

      <div className="rounded-xl border border-white/[0.12] bg-[#0f0f0d] p-4 space-y-2.5">
        {[
          { label: "What is delegated", value: "Spend up to budget · escrow only" },
          { label: "Time limit",        value: "1 hour per task" },
          { label: "Revokable",         value: "Yes — anytime from dashboard" },
          { label: "Standard",          value: "EIP-7702" },
        ].map(row => (
          <div key={row.label} className="flex justify-between text-xs font-mono">
            <span className="text-white/35">{row.label}</span>
            <span className="text-white/70">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-mono text-white/40 tracking-widest">DEFAULT MAX BUDGET PER TASK (USDC)</label>
        <div className="flex items-center gap-3">
          <input type="number" min="1" max="10000" value={cap} onChange={e => setCap(e.target.value)} disabled={confirmed}
            className="flex-1 bg-[#0f0f0d] border border-white/[0.15] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-white/30 transition-colors disabled:opacity-50" />
          <div className="flex gap-2">
            {["50", "100", "500"].map(v => (
              <button key={v} onClick={() => setCap(v)} disabled={confirmed}
                className={`px-3 py-2 rounded-lg border text-xs font-mono transition-colors disabled:opacity-30 ${cap === v ? "border-white/30 text-white" : "border-white/[0.12] text-white/50 hover:border-white/25 hover:text-white/70"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {confirmed ? (
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          {cap} USDC default limit set
        </div>
      ) : (
        <button onClick={handleConfirm} disabled={!cap || signing}
          className="self-start px-5 py-2.5 rounded-xl border border-white/[0.20] text-sm font-mono tracking-widest text-white/80 hover:text-white hover:border-white/35 hover:bg-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed">
          {signing ? "SIGNING…" : "CONFIRM LIMIT →"}
        </button>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const STEPS = ["Register", "Scouts", "Spending"]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [stepDone, setStepDone] = useState<boolean[]>([false, true, false]) // scouts always OK (pre-selected)
  const { address } = useWeb3Auth()
  const router = useRouter()
  const isLast = step === STEPS.length - 1

  const markDone = () => setStepDone(prev => { const n = [...prev]; n[step] = true; return n })

  const canContinue = stepDone[step]

  const next = () => {
    if (!canContinue) return
    if (isLast) {
      const key = address ? `hivebid_onboarded_${address.toLowerCase()}` : "hivebid_onboarded"
      localStorage.setItem(key, "1")
      router.push("/dashboard")
    } else {
      setStep(s => s + 1)
    }
  }

  return (
    <div className="bg-[#0B0B09] text-[#F0EFEA] min-h-screen font-sans antialiased relative flex items-center justify-center px-4">
      <HexagonPattern radius={40} gap={6} className="stroke-white/[0.05] fill-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(11,11,9,0.95) 100%)" }} />

      <div className="relative z-10 w-full max-w-lg py-16">
        <div className="mb-6">
          <StepDots current={step} total={STEPS.length} />
        </div>

        <div className="rounded-2xl border border-white/[0.12] bg-[#111110] p-8 mb-4 shadow-2xl">
          {step === 0 && <StepRegister address={address} onComplete={markDone} />}
          {step === 1 && <StepScouts />}
          {step === 2 && <StepSpending onComplete={markDone} />}
        </div>

        <div className="flex items-center justify-between px-1">
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
            className="text-[11px] font-mono text-white/30 hover:text-white/60 tracking-widest transition-colors disabled:opacity-0 disabled:pointer-events-none">
            ← BACK
          </button>
          <button onClick={next} disabled={!canContinue}
            className="px-6 py-2.5 bg-white text-[#0B0B09] text-[11px] font-mono rounded-xl hover:bg-white/90 transition-colors tracking-widest font-medium disabled:opacity-30 disabled:cursor-not-allowed">
            {isLast ? "FINISH →" : "CONTINUE →"}
          </button>
        </div>

        {!canContinue && (
          <p className="text-center text-[10px] font-mono text-white/25 mt-3">
            {step === 0 ? "Register your identity to continue" : "Confirm your spending limit to finish"}
          </p>
        )}
      </div>
    </div>
  )
}
