"use client"

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react"
import type { Web3Auth } from "@web3auth/modal"

type Web3AuthStatus = "not_ready" | "ready" | "connecting" | "connected" | "disconnected" | "errored"

interface Web3AuthContextValue {
  web3Auth: Web3Auth | null
  isConnected: boolean
  status: Web3AuthStatus
  address: string | null
}

const Web3AuthContext = createContext<Web3AuthContextValue>({
  web3Auth: null,
  isConnected: false,
  status: "not_ready",
  address: null,
})

export function useWeb3Auth() {
  return useContext(Web3AuthContext)
}

export function Web3AuthProvider({ children }: { children: ReactNode }) {
  const [web3Auth, setWeb3Auth] = useState<Web3Auth | null>(null)
  const [status, setStatus] = useState<Web3AuthStatus>("not_ready")
  const [address, setAddress] = useState<string | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    async function init() {
      try {
        const { Web3Auth, CONNECTOR_EVENTS } = await import("@web3auth/modal")
        const { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } = await import("@web3auth/base")

        const instance = new Web3Auth({
          clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!,
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
          chainConfig: {
            chainNamespace: CHAIN_NAMESPACES.EIP155,
            chainId: "0x14a34", // Base Sepolia (84532)
            rpcTarget: "https://sepolia.base.org",
            displayName: "Base Sepolia",
            blockExplorerUrl: "https://sepolia-explorer.base.org",
            ticker: "ETH",
            tickerName: "Ethereum",
          },
        })

        // Listen to events — update state without touching instance methods
        instance.on(CONNECTOR_EVENTS.CONNECTING, () => setStatus("connecting"))

        instance.on(CONNECTOR_EVENTS.CONNECTED, async () => {
          setStatus("connected")
          const provider = instance.provider
          if (provider) {
            const accounts = (await provider.request({ method: "eth_accounts" })) as string[]
            setAddress(accounts?.[0] ?? null)
          }
        })

        instance.on(CONNECTOR_EVENTS.DISCONNECTED, () => {
          setStatus("ready")
          setAddress(null)
        })

        instance.on(CONNECTOR_EVENTS.ERRORED, () => setStatus("errored"))

        await instance.init()

        // Restore session if already connected
        if (instance.connected) {
          setStatus("connected")
          const provider = instance.provider
          if (provider) {
            const accounts = (await provider.request({ method: "eth_accounts" })) as string[]
            setAddress(accounts?.[0] ?? null)
          }
        } else {
          setStatus("ready")
        }

        setWeb3Auth(instance)
      } catch (err) {
        console.error("Web3Auth init error:", err)
        setStatus("errored")
      }
    }

    init()
  }, [])

  return (
    <Web3AuthContext.Provider
      value={{
        web3Auth,           // raw instance — web3Auth.connect() and web3Auth.logout() work natively
        isConnected: status === "connected",
        status,
        address,
      }}
    >
      {children}
    </Web3AuthContext.Provider>
  )
}
