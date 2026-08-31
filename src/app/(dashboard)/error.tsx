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
 <div className="bg-white border border-gray-100 p-10 max-w-md w-full text-center space-y-6">
 <div className="flex justify-center">
 <div className="w-16 h-16 bg-red-50 flex items-center justify-center">
 <AlertTriangle className="w-8 h-8 text-red-500" />
 </div>
 </div>

 <div className="space-y-2">
 <h2 className="text-[18px] font-semibold text-gray-900">Что-то пошло не так</h2>
 <p className="text-sm text-gray-500 leading-relaxed">
 {error.message || 'Произошла непредвиденная ошибка. Попробуйте обновить страницу.'}
 </p>
 {error.digest && (
 <p className="text-xs text-gray-400 font-mono">ID: {error.digest}</p>
 )}
 </div>

 <div className="flex gap-3 justify-center">
 <button
 onClick={reset}
 className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
 >
 <RefreshCw className="w-4 h-4" />
 Попробовать снова
 </button>
 <Link
 href="/dashboard"
 className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
 >
 <Home className="w-4 h-4" />
 На главную
 </Link>
 </div>
 </div>
 </div>
 )
}
