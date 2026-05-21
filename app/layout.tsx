import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { FirstVisitPreloader } from '@/components/ui/first-visit-preloader'
import { FIRST_VISIT_PRELOADER_STORAGE_KEY } from '@/lib/preloader'
import { Toaster } from "sonner"
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
  title: 'BLAZR - Fast Food Ordering',
  description: 'Order your favorite burgers, chicken, sides and drinks with lightning-fast delivery.',
  generator: 'v0.app',
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

export const viewport: Viewport = {
  themeColor: '#1a1a1f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

const preloaderBootstrapScript = `
  (() => {
    const pathname = window.location.pathname;
    const shouldShow =
      pathname === '/' || pathname === '/landing' || pathname.startsWith('/menu');

    if (!shouldShow) {
      document.documentElement.dataset.blazrPreloaderState = 'seen';
      return;
    }

    try {
      const hasSeen = window.localStorage.getItem('${FIRST_VISIT_PRELOADER_STORAGE_KEY}') === '1';
      document.documentElement.dataset.blazrPreloaderState = hasSeen ? 'seen' : 'pending';
    } catch {
      document.documentElement.dataset.blazrPreloaderState = 'pending';
    }
  })();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <Script id="blazr-preloader-state" strategy="beforeInteractive">
          {preloaderBootstrapScript}
        </Script>
        <FirstVisitPreloader />
        <div className="blazr-app-shell">
          {children}
        </div>
        <Toaster position="top-center" richColors />
        <Analytics />
      </body>
    </html>
  )
}
