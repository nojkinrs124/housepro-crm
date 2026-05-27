'use client'

import { useState } from 'react'
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Download } from 'lucide-react'
import { generateContractDocx } from '@/features/contracts/actions/generate.actions'

export function GenerateButton({ contractId }: { contractId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<{ docxUrl?: string; version?: number; error?: string }>({})

  const handleGenerate = async () => {
    setState('loading')
    const res = await generateContractDocx(contractId)
    if (res.error) {
      setState('error')
      setResult({ error: res.error })
    } else {
      setState('success')
      setResult({ docxUrl: res.docxUrl, version: res.version })
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleGenerate}
        disabled={state === 'loading'}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state === 'loading' ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Генерация...</>
        ) : (
          <><Sparkles className="w-4 h-4" />Сгенерировать DOCX</>
        )}
      </button>

      {state === 'success' && result.docxUrl && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl">
            <CheckCircle2 className="w-4 h-4" />
            Версия {result.version} создана!
          </div>
          <a
            href={result.docxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-all"
          >
            <Download className="w-4 h-4" />
            Скачать DOCX
          </a>
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-center gap-1.5 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
          <AlertCircle className="w-4 h-4" />
          {result.error || 'Ошибка генерации'}
        </div>
      )}
    </div>
  )
}
