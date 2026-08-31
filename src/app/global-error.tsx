'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function GlobalError({
 error,
 reset,
}: {
 error: Error & { digest?: string }
 reset: () => void
}) {
 useEffect(() => {
 Sentry.captureException(error)
 }, [error])

 return (
 <html lang="ru">
 <body className="min-h-screen bg-[var(--hp-neutral-tint)] flex items-center justify-center p-4">
 <div className="bg-white border border-[var(--hp-border)] p-10 max-w-md w-full text-center space-y-6">
 <div className="flex justify-center">
 <div className="w-16 h-16 bg-[var(--hp-danger-tint)] flex items-center justify-center">
 <AlertTriangle className="w-8 h-8 text-[var(--hp-danger)]" />
 </div>
 </div>
 <div className="space-y-2">
 <h2 className="text-[18px] font-semibold text-[var(--hp-ink)]">
 Критическая ошибка
 </h2>
 <p className="text-sm text-[var(--hp-sub)] leading-relaxed">
 Что-то пошло не так на уровне приложения.
 Попробуйте перезагрузить страницу.
 </p>
 {error.digest && (
 <p className="text-xs text-[var(--hp-sub)] font-mono">ID: {error.digest}</p>
 )}
 </div>
 <button
 onClick={reset}
 className="flex items-center gap-2 px-6 py-2.5 bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] text-white text-sm font-medium transition-colors mx-auto"
 >
 <RefreshCw className="w-4 h-4" />
 Перезагрузить
 </button>
 </div>
 </body>
 </html>
 )
}
