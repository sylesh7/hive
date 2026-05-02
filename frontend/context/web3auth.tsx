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

/** Safely get accounts from provider — swallows MetaMask/connector errors */
async function safeGetAddress(provider: NonNullable<Web3Auth["provider"]>): Promise<string | null> {
  try {
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[]
    return accounts?.[0] ?? null
  } catch {
    return null
  }
}

export function Web3AuthProvider({ children }: { children: ReactNode }) {
  const [web3Auth, setWeb3Auth]   = useState<Web3Auth | null>(null)
  const [status, setStatus]       = useState<Web3AuthStatus>("not_ready")
  const [address, setAddress]     = useState<string | null>(null)
  const initialized               = useRef(false)

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
          // @ts-ignore — chainConfig is valid in Web3Auth v9; v10 moved it but modal still accepts it
          chainConfig: {
            chainNamespace: CHAIN_NAMESPACES.EIP155,
            chainId: "0x14a34",   // Base Sepolia 84532
            rpcTarget: "https://sepolia.base.org",
            displayName: "Base Sepolia",
            blockExplorerUrl: "https://sepolia-explorer.base.org",
            ticker: "ETH",
            tickerName: "Ethereum",
          },
        })

        // ── Event listeners ──────────────────────────────────────────────────

        instance.on(CONNECTOR_EVENTS.CONNECTING, () => setStatus("connecting"))

        instance.on(CONNECTOR_EVENTS.CONNECTED, async () => {
          setStatus("connected")
          if (instance.provider) {
            const addr = await safeGetAddress(instance.provider)
            setAddress(addr)
          }
        })

        instance.on(CONNECTOR_EVENTS.DISCONNECTED, () => {
          setStatus("ready")
          setAddress(null)
        })

        // Swallow errors from MetaMask connector restoration — they are logged
        // by the extension itself and are non-fatal (user is simply not connected)
        instance.on(CONNECTOR_EVENTS.ERRORED, (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          // "Failed to connect to MetaMask" during session restore is expected
          // when MetaMask is installed but the user hasn't connected yet.
          if (msg.toLowerCase().includes("metamask") || msg.toLowerCase().includes("connect")) {
            console.info("[Web3Auth] MetaMask session restore skipped (not connected)")
            setStatus("ready")
          } else {
            console.error("[Web3Auth] connector error:", err)
            setStatus("errored")
          }
        })

        // ── Init ─────────────────────────────────────────────────────────────

        try {
          await instance.init()
        } catch (initErr) {
          // init() can throw when a stored connector (e.g. MetaMask) is no
          // longer available. Treat this as "not connected" rather than fatal.
          console.warn("[Web3Auth] init warning (non-fatal):", initErr)
        }

        // ── Session restore ──────────────────────────────────────────────────

        if (instance.connected) {
          setStatus("connected")
          if (instance.provider) {
            const addr = await safeGetAddress(instance.provider)
            setAddress(addr)
          }
        } else {
          setStatus("ready")
        }

        setWeb3Auth(instance)
      } catch (err) {
        console.error("Web3Auth init error:", err)
        // Don't set status to "errored" — keep UI usable without wallet
        setStatus("ready")
      }
    }

    init()
  }, [])

  return (
    <Web3AuthContext.Provider
      value={{
        web3Auth,
        isConnected: status === "connected",
        status,
        address,
      }}
    >
      {children}
    </Web3AuthContext.Provider>
  )
}
