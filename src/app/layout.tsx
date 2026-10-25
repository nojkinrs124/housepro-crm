import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { ConfirmHost } from '@/components/forms/ConfirmDialog'
import { env } from '@/lib/env'

/**
 * metadataBase обязателен для индексации: без него Next отдаёт относительные
 * canonical/og:url, а Google и Яндекс считают каноническим тот хост, по которому
 * пришли (включая *.vercel.app) — так один сайт попадает в индекс дважды.
 * Значение берётся из NEXT_PUBLIC_SITE_URL, в проде это https://housepro24.ru.
 */
export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: 'ХаусПро',
  description: 'ХаусПро — Руслан Ножкин, частный риелтор в Красноярске. Сдаю и веду вашу квартиру.',
  openGraph: {
    type: 'website',
    siteName: 'ХаусПро',
    locale: 'ru_RU',
  },
  // Коды подтверждения прав в Google Search Console и Яндекс.Вебмастере.
  // Задаются переменными окружения, чтобы не держать их в репозитории:
  // NEXT_PUBLIC_GOOGLE_VERIFICATION / NEXT_PUBLIC_YANDEX_VERIFICATION.
  // Без них блок просто не выводится.
  verification: {
    ...(process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION }
      : {}),
    ...(process.env.NEXT_PUBLIC_YANDEX_VERIFICATION
      ? { yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION }
      : {}),
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ХаусПро',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport = {
  themeColor: 'var(--hp-accent)',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" />
          <ConfirmHost />
        </ThemeProvider>
      </body>
    </html>
  )
}
