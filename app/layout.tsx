import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from "sonner"
import { AuthCodeRescue } from '@/components/account/auth-code-rescue'
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
  title: 'El Club del Repulgue — Empanadas',
  description: 'Hechas a mano. Horneadas con amor. Pedí tus empanadas favoritas con delivery rápido.',
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <div className="app-shell">
          {children}
        </div>
        <AuthCodeRescue />
        <Toaster position="top-center" richColors />
        <Analytics />
      </body>
    </html>
  )
}
