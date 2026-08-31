'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function DashboardError({
 error,
 reset,
}: {
 error: Error & { digest?: string }
 reset: () => void
}) {
 useEffect(() => {
 console.error('[Dashboard Error]', error)
 }, [error])

 return (
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-10 max-w-md w-full text-center space-y-6">
 <div className="flex justify-center">
 <div className="w-16 h-16 bg-[var(--hp-danger-tint)] flex items-center justify-center">
 <AlertTriangle className="w-8 h-8 text-[var(--hp-danger)]" />
 </div>
 </div>

 <div className="space-y-2">
 <h2 className="text-[18px] font-semibold text-[var(--hp-ink)]">Что-то пошло не так</h2>
 <p className="text-sm text-[var(--hp-sub)] leading-relaxed">
 {error.message || 'Произошла непредвиденная ошибка. Попробуйте обновить страницу.'}
 </p>
 {error.digest && (
 <p className="text-xs text-[var(--hp-sub)] font-mono">ID: {error.digest}</p>
 )}
 </div>

 <div className="flex gap-3 justify-center">
 <button
 onClick={reset}
 className="flex items-center gap-2 px-5 py-2.5 bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] text-white text-sm font-medium transition-colors"
 >
 <RefreshCw className="w-4 h-4" />
 Попробовать снова
 </button>
 <Link
 href="/dashboard"
 className="flex items-center gap-2 px-5 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] hover:border-[var(--hp-sub)] text-[var(--hp-ink)] text-sm font-medium transition-colors"
 >
 <Home className="w-4 h-4" />
 На главную
 </Link>
 </div>
 </div>
 </div>
 )
}
