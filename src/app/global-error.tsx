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
      <body className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-[18px] font-semibold text-gray-900">
              Критическая ошибка
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Что-то пошло не так на уровне приложения.
              Попробуйте перезагрузить страницу.
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 font-mono">ID: {error.digest}</p>
            )}
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Перезагрузить
          </button>
        </div>
      </body>
    </html>
  )
}
