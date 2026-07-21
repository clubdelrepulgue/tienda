import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SerwistProvider } from '@serwist/turbopack/react'
import { Toaster } from "sonner"
import { AuthCodeRescue } from '@/components/account/auth-code-rescue'
import { ConnectivityBanner } from '@/components/pwa/connectivity-banner'
import './globals.css'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
})

export const metadata: Metadata = {
  applicationName: 'El Club del Repulgue',
  title: 'El Club del Repulgue — Empanadas',
  description: 'Hechas a mano. Horneadas con amor. Pedí tus empanadas favoritas con delivery rápido.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'El Club del Repulgue',
  },
  manifest: '/manifest.json',
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <SerwistProvider swUrl="/serwist/sw.js">
          <ConnectivityBanner />
          <div className="app-shell">
            {children}
          </div>
          <AuthCodeRescue />
          <Toaster position="top-center" richColors />
          <Analytics />
        </SerwistProvider>
      </body>
    </html>
  )
}
