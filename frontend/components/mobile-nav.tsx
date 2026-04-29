"use client"

import { useState } from "react"
import { ConnectButton } from "@/components/connect-button"

const NAV_LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Scouts",        href: "#scouts" },
  { label: "Steps",         href: "#steps" },
]

const NAV_STYLE = {
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  background: "rgba(11,11,9,0.70)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)",
} as const

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-3xl">

        {/* Main bar */}
        <nav
          className="flex items-center justify-between px-5 py-3 rounded-2xl border border-white/[0.08]"
          style={NAV_STYLE}
        >
          <span className="font-pixel text-xs tracking-[0.25em] text-white/80">HIVEBID</span>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(l => (
              <a
                key={l.label}
                href={l.href}
                className="text-[11px] text-white/50 hover:text-white/90 transition-colors duration-200 tracking-wide"
                style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ConnectButton className="px-4 py-2 rounded-xl border border-white/[0.12] text-white/70 hover:text-white hover:border-white/25 hover:bg-white/[0.06] hidden md:block" />

            {/* Burger — mobile only */}
            <button
              onClick={() => setOpen(v => !v)}
              className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px] rounded-lg hover:bg-white/[0.06] transition-colors"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <span className="block h-px bg-white/60 transition-all duration-300 origin-center"
                style={{ width: "18px", transform: open ? "translateY(6px) rotate(45deg)" : "none" }} />
              <span className="block h-px bg-white/60 transition-all duration-300"
                style={{ width: "18px", opacity: open ? 0 : 1, transform: open ? "scaleX(0)" : "none" }} />
              <span className="block h-px bg-white/60 transition-all duration-300 origin-center"
                style={{ width: "18px", transform: open ? "translateY(-6px) rotate(-45deg)" : "none" }} />
            </button>
          </div>
        </nav>

        {/* Mobile dropdown */}
        <div
          className="md:hidden mt-2 overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: open ? "320px" : "0px", opacity: open ? 1 : 0 }}
        >
          <div className="rounded-2xl border border-white/[0.08] px-2 py-2 flex flex-col" style={NAV_STYLE}>
            {NAV_LINKS.map(l => (
              <a
                key={l.label}
                href={l.href}
                onClick={close}
                className="px-4 py-3 text-sm text-white/50 hover:text-white/90 hover:bg-white/[0.05] rounded-xl transition-colors tracking-wide"
                style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
              >
                {l.label}
              </a>
            ))}
            <div className="mt-1 px-2 pb-1">
              <ConnectButton className="w-full px-4 py-2.5 rounded-xl border border-white/[0.12] text-white/70 hover:text-white hover:border-white/25 hover:bg-white/[0.06]" />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
