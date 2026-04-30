"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useWeb3Auth } from "@/context/web3auth"

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i < current
              ? "w-6 h-1.5 bg-white/70"
              : i === current
              ? "w-6 h-1.5 bg-white"
              : "w-1.5 h-1.5 bg-white/20"
          }`}
        />
      ))}
      <span className="ml-2 text-[11px] font-mono text-white/30 tracking-widest">
        {current + 1} / {total}
      </span>
    </div>
  )
}

// ─── Step 1: Register identity ────────────────────────────────────────────────
function StepRegister({ address }: { address: string | null }) {
  const [name, setName] = useState("")
  const [registering, setRegistering] = useState(false)
  const [done, setDone] = useState(false)

  const handleRegister = async () => {
    if (!name.trim()) return
    setRegistering(true)
    await new Promise(r => setTimeout(r, 1800))
    setRegistering(false)
    setDone(true)
  }

  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "0x···"

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-[10px] font-mono text-white/30 tracking-widest mb-1">STEP 1</div>
        <h2 className="text-2xl font-light mb-2" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
          Register your agent identity
        </h2>
        <p className="text-sm text-white/50 leading-relaxed">
          Your hiring agent needs an on-chain identity (ERC-8004). This gives it a wallet address, a reputation record, and a name workers can bid on.
        </p>
      </div>

      {/* Preview card */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 font-mono text-xs space-y-2">
        <div className="flex justify-between text-white/30">
          <span>WALLET</span>
          <span className="text-white/60">{shortAddr}</span>
        </div>
        <div className="flex justify-between text-white/30">
          <span>AGENT NAME</span>
          <span className="text-white/60">{name || "—"}</span>
        </div>
        <div className="flex justify-between text-white/30">
          <span>NETWORK</span>
          <span className="text-white/60">Base Sepolia</span>
        </div>
      </div>

      {/* Name input */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-mono text-white/40 tracking-widest">AGENT NAME</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. my-hiring-agent"
          disabled={done}
          className="bg-white/[0.04] border border-white/[0.10] rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors disabled:opacity-50"
        />
      </div>

      {done ? (
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          Identity registered on Base Sepolia
        </div>
      ) : (
        <button
          onClick={handleRegister}
          disabled={!name.trim() || registering}
          className="self-start px-5 py-2.5 rounded-xl border border-white/[0.12] text-sm font-mono tracking-widest text-white/70 hover:text-white hover:border-white/25 hover:bg-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {registering ? "REGISTERING…" : "REGISTER IDENTITY (GAS PAID)"}
        </button>
      )}
    </div>
  )
}

// ─── Step 2: Pick scouts ──────────────────────────────────────────────────────
const SCOUTS = [
  {
    id: "cost",
    name: "Cost Scout",
    tag: "CHEAPEST",
    desc: "Always picks the lowest bid that meets your deliverable spec. Pure price optimization.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    id: "quality",
    name: "Quality Scout",
    tag: "BEST REPUTATION",
    desc: "Reads each bidder's on-chain reputation from ERC-8004 and weights score against price.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    id: "speed",
    name: "Speed Scout",
    tag: "FASTEST",
    desc: "Prioritizes the fastest estimated delivery time regardless of price.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
]

function StepScouts() {
  const [selected, setSelected] = useState<string[]>(["cost"])

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(s => s !== id) : prev
        : [...prev, id]
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-[10px] font-mono text-white/30 tracking-widest mb-1">STEP 2</div>
        <h2 className="text-2xl font-light mb-2" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
          Choose your default scouts
        </h2>
        <p className="text-sm text-white/50 leading-relaxed">
          Scouts evaluate incoming bids by different strategies and surface their top pick. You can change this per task.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {SCOUTS.map(scout => {
          const active = selected.includes(scout.id)
          return (
            <button
              key={scout.id}
              onClick={() => toggle(scout.id)}
              className={`text-left flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 ${
                active
                  ? "border-white/25 bg-white/[0.07]"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${active ? "border-white/30 text-white bg-white/[0.08]" : "border-white/[0.10] text-white/40"}`}>
                {scout.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-light text-white/90">{scout.name}</span>
                  <span className="text-[9px] font-mono text-white/30 tracking-widest">{scout.tag}</span>
                </div>
                <p className="text-xs text-white/45 leading-relaxed">{scout.desc}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 transition-colors ${active ? "border-white bg-white" : "border-white/20"}`} />
            </button>
          )
        })}
      </div>

      <div className="text-[10px] font-mono text-white/25">
        {selected.length} scout{selected.length > 1 ? "s" : ""} selected — you can always add or remove per task
      </div>
    </div>
  )
}

// ─── Step 3: Spending limit ───────────────────────────────────────────────────
function StepSpending() {
  const [cap, setCap] = useState("100")
  const [confirmed, setConfirmed] = useState(false)
  const [signing, setSigning] = useState(false)

  const handleConfirm = async () => {
    setSigning(true)
    await new Promise(r => setTimeout(r, 2000))
    setSigning(false)
    setConfirmed(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="text-[10px] font-mono text-white/30 tracking-widest mb-1">STEP 3</div>
        <h2 className="text-2xl font-light mb-2" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>
          Set your spending limit
        </h2>
        <p className="text-sm text-white/50 leading-relaxed">
          HiveBid never holds your money. For each task you post, your agent gets a one-time permission to spend only up to your set budget, only for that task, only for one hour. You can revoke anytime.
        </p>
      </div>

      {/* Explainer */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
        {[
          { label: "What is delegated", value: "Spend up to budget · escrow contract only" },
          { label: "Time limit", value: "1 hour per task" },
          { label: "Revokable", value: "Yes — anytime from dashboard" },
          { label: "Standard", value: "EIP-7702" },
        ].map(row => (
          <div key={row.label} className="flex justify-between text-xs font-mono">
            <span className="text-white/30">{row.label}</span>
            <span className="text-white/60">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Cap input */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-mono text-white/40 tracking-widest">DEFAULT MAX BUDGET PER TASK (USDC)</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            max="10000"
            value={cap}
            onChange={e => setCap(e.target.value)}
            disabled={confirmed}
            className="flex-1 bg-white/[0.04] border border-white/[0.10] rounded-xl px-4 py-3 text-sm text-white/90 font-mono focus:outline-none focus:border-white/25 transition-colors disabled:opacity-50"
          />
          <div className="flex gap-2">
            {["50", "100", "500"].map(v => (
              <button
                key={v}
                onClick={() => setCap(v)}
                disabled={confirmed}
                className="px-3 py-2 rounded-lg border border-white/[0.08] text-xs font-mono text-white/40 hover:text-white/70 hover:border-white/20 transition-colors disabled:opacity-30"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {confirmed ? (
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          Configuration saved — {cap} USDC default limit set
        </div>
      ) : (
        <button
          onClick={handleConfirm}
          disabled={!cap || signing}
          className="self-start px-5 py-2.5 rounded-xl border border-white/[0.12] text-sm font-mono tracking-widest text-white/70 hover:text-white hover:border-white/25 hover:bg-white/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {signing ? "SIGNING…" : "CONFIRM AND CONTINUE"}
        </button>
      )}
    </div>
  )
}

// ─── Main onboarding page ─────────────────────────────────────────────────────
const STEPS = ["Register", "Scouts", "Spending"]

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const { address } = useWeb3Auth()
  const router = useRouter()

  const isLast = step === STEPS.length - 1

  const next = () => {
    if (isLast) {
      localStorage.setItem("hivebid_onboarded", "1")
      router.push("/dashboard")
    } else {
      setStep(s => s + 1)
    }
  }

  const back = () => setStep(s => s - 1)

  return (
    <div className="bg-[#0B0B09] text-[#F0EFEA] min-h-screen font-sans antialiased flex items-center justify-center px-4">

      {/* Dim overlay / backdrop */}
      <div className="absolute inset-0 bg-[#0B0B09]" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg">

        {/* Step dots */}
        <div className="mb-6">
          <StepDots current={step} total={STEPS.length} />
        </div>

        {/* Step content */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 mb-4">
          {step === 0 && <StepRegister address={address} />}
          {step === 1 && <StepScouts />}
          {step === 2 && <StepSpending />}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={back}
            disabled={step === 0}
            className="text-[11px] font-mono text-white/30 hover:text-white/60 tracking-widest transition-colors disabled:opacity-0 disabled:pointer-events-none"
          >
            ← BACK
          </button>

          <button
            onClick={next}
            className="px-6 py-2.5 bg-white text-[#0B0B09] text-[11px] font-mono rounded-xl hover:bg-white/90 transition-colors tracking-widest font-medium"
          >
            {isLast ? "FINISH →" : "CONTINUE →"}
          </button>
        </div>
      </div>
    </div>
  )
}
