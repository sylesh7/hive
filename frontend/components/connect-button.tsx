"use client"

import { useRef } from "react"
import { useWeb3Auth } from "@/context/web3auth"

interface ConnectButtonProps {
  className?: string
  label?: string
}

export function ConnectButton({ className = "", label = "CONNECT WALLET" }: ConnectButtonProps) {
  const { web3Auth, isConnected, status } = useWeb3Auth()
  const isConnecting = status === "connecting"
  const userInitiated = useRef(false)

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
