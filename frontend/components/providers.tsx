"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Web3AuthProvider } from "@/context/web3auth"
import { useState } from "react"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <Web3AuthProvider>
        {children}
      </Web3AuthProvider>
    </QueryClientProvider>
  )
}
