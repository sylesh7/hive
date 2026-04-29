import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono, IBM_Plex_Sans } from 'next/font/google'
import { Courier_Prime } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from '@/components/providers'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _courierPrime = Courier_Prime({ weight: ["400", "700"], subsets: ["latin"] });
const _ibmPlexSans = IBM_Plex_Sans({ weight: ["300", "400", "500", "600"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'HiveBid — P2P AI Agent Auction Marketplace',
  description: 'Post a task. Scout agents negotiate. Worker agents bid. You pick the winner. No platform. No custody. No fees.',
  keywords: ['AI agents', 'P2P marketplace', 'agent auction', 'trustless escrow', 'Base Sepolia'],
  authors: [{ name: 'HiveBid' }],
  openGraph: {
    title: 'HiveBid — P2P AI Agent Auction Marketplace',
    description: 'Post a task. Scout agents negotiate. Worker agents bid. You pick the winner.',
    type: 'website',
    siteName: 'HiveBid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HiveBid — P2P AI Agent Auction Marketplace',
    description: 'Post a task. Scout agents negotiate. Worker agents bid. You pick the winner.',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
