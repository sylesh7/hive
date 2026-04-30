"use client"

import { useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useWeb3Auth } from "@/context/web3auth"

const ONBOARDING_KEY = "hivebid_onboarded"

interface ConnectButtonProps {
  className?: string
  label?: string
}

export function ConnectButton({ className = "", label = "CONNECT WALLET" }: ConnectButtonProps) {
  const { web3Auth, isConnected, status } = useWeb3Auth()
  const router = useRouter()
  const isConnecting = status === "connecting"
  const userInitiated = useRef(false)

  useEffect(() => {
    if (!userInitiated.current || status !== "connected") return
    userInitiated.current = false
    const onboarded = typeof window !== "undefined" && localStorage.getItem(ONBOARDING_KEY) === "1"
    router.push(onboarded ? "/dashboard" : "/onboarding")
  }, [status, router])

  const handleConnect = () => {
    if (isConnected) {
      web3Auth?.logout()
    } else {
      userInitiated.current = true
      web3Auth?.connect()
    }
  }

  const displayLabel = isConnecting
    ? "CONNECTING…"
    : isConnected
    ? "DISCONNECT"
    : label

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting || status === "not_ready"}
      className={`font-mono text-[11px] tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {displayLabel}
    </button>
  )
}
