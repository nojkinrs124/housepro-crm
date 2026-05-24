import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'HousePro CRM',
  description: 'CRM система для агентства недвижимости HousePro',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
