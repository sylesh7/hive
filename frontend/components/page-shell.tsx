"use client"

import { MobileNav } from "@/components/mobile-nav"
import { HexagonPattern } from "@/components/ui/hexagon-pattern"

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0B0B09] text-[#F0EFEA] min-h-screen font-sans antialiased relative overflow-x-hidden">
      {/* Hex bg — full page */}
      <HexagonPattern radius={40} gap={6} className="stroke-white/[0.09] fill-none fixed inset-0 w-full h-full" />
      {/* Vignette — keeps content readable */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 120% 80% at 50% 0%, transparent 20%, rgba(11,11,9,0.75) 70%, rgba(11,11,9,0.95) 100%)" }}
      />
      <MobileNav />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
