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
 if ('error' in res) {
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
 className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
 style={{ background: 'var(--hp-accent)', }}
 >
 {state === 'loading' ? (
 <><Loader2 className="w-4 h-4 animate-spin" />Генерация...</>
 ) : (
 <><Sparkles className="w-4 h-4" />Сгенерировать DOCX</>
 )}
 </button>

 {state === 'success' && result.docxUrl && (
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1.5 text-sm text-[var(--hp-good)] bg-[var(--hp-good-tint)] border border-[var(--hp-border)] px-3 py-2">
 <CheckCircle2 className="w-4 h-4" />
 Версия {result.version} создана!
 </div>
 <a
 href={result.docxUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-2 px-4 py-2.5 text-white text-sm font-bold transition-all"
 style={{ background: 'var(--hp-accent)', }}
 >
 <Download className="w-4 h-4" />
 Скачать DOCX
 </a>
 </div>
 )}

 {state === 'error' && (
 <div className="flex items-center gap-1.5 text-sm text-[var(--hp-danger)] bg-[var(--hp-danger-tint)] border border-[var(--hp-border)] px-3 py-2">
 <AlertCircle className="w-4 h-4" />
 {result.error || 'Ошибка генерации'}
 </div>
 )}
 </div>
 )
}
