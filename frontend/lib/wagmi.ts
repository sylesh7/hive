import { createConfig, http } from "wagmi"
import { baseSepolia } from "wagmi/chains"
import { injected, walletConnect } from "wagmi/connectors"

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? ""

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected(),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
})
