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
 type="button"
 data-testid="contract-generate"
 onClick={handleGenerate}
 disabled={state === 'loading'}
 className="hp-btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
 >
 {state === 'loading' ? (
 <><Loader2 className="w-4 h-4 animate-spin" />Генерация...</>
 ) : (
 <><Sparkles className="w-4 h-4" />Сформировать документ</>
 )}
 </button>

 {state === 'success' && result.docxUrl && (
 <div className="flex items-center gap-3">
 <div data-testid="contract-generate-success" className="flex items-center gap-1.5 text-sm text-[var(--hp-good)] bg-[var(--hp-good-tint)] border border-[var(--hp-border)] px-3 py-2">
 <CheckCircle2 className="w-4 h-4" />
 Версия {result.version} готова
 </div>
 <a
 href={result.docxUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="hp-btn-secondary"
 >
 <Download className="w-4 h-4" />
 Скачать DOCX
 </a>
 </div>
 )}

 {state === 'error' && (
 <div className="flex items-center gap-1.5 text-sm text-[var(--hp-danger)] bg-[var(--hp-danger-tint)] border border-[var(--hp-border)] px-3 py-2">
 <AlertCircle className="w-4 h-4" />
 {result.error || 'Не получилось сформировать документ. Попробуйте ещё раз.'}
 </div>
 )}
 </div>
 )
}
