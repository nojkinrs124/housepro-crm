'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { History, ChevronDown, ChevronUp, RotateCcw, FileText, Clock } from 'lucide-react'
import { restoreContractVersionAction } from '../actions/contracts.actions'

interface ContractVersion {
 id: string
 version: number
 created_at: string | null
 note?: string | null
 docx_url?: string | null
 version_data?: unknown
 author?: { full_name: string } | null
}

interface Props {
 contractId: string
 versions: ContractVersion[]
}

export function ContractVersionHistory({ contractId, versions }: Props) {
 const [open, setOpen] = useState(false)
 const [restoring, setRestoring] = useState<string | null>(null)
 const router = useRouter()

 if (versions.length === 0) return null

 async function handleRestore(versionId: string) {
 setRestoring(versionId)
 const result = await restoreContractVersionAction(contractId, versionId)
 setRestoring(null)
 if (result && 'error' in result) alert(result.error)
 else router.refresh()
 }

 return (
 <div className="border border-[var(--hp-border-soft)] overflow-hidden bg-[var(--hp-surface)]">
 <button
 onClick={() => setOpen(v => !v)}
 className="w-full flex items-center justify-between px-5 py-3.5 bg-[var(--hp-neutral-tint)] hover:bg-[var(--hp-accent-tint)] transition-colors"
 >
 <div className="flex items-center gap-2 text-sm font-medium text-foreground">
 <History className="w-4 h-4 text-muted-foreground" />
 История версий
 <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold bg-[var(--hp-tertiary)] text-[var(--hp-sub)] rounded-[var(--hp-radius-badge)]">
 {versions.length}
 </span>
 </div>
 {open
 ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
 : <ChevronDown className="w-4 h-4 text-muted-foreground" />
 }
 </button>

 {open && (
 <div className="divide-y divide-[var(--hp-border-soft)]">
 {versions.map((v) => (
 <div
 key={v.id}
 className="flex items-start justify-between gap-4 px-5 py-3.5 text-sm hover:bg-[var(--hp-neutral-tint)]/40 transition-colors"
 >
 <div className="flex items-start gap-3">
 <div className="mt-0.5 w-6 h-6 rounded-[var(--hp-radius)] bg-primary/10 flex items-center justify-center flex-shrink-0">
 <span className="text-xs font-bold text-primary">{v.version}</span>
 </div>
 <div>
 <div className="font-medium text-foreground">Версия {v.version}</div>
 <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
 <Clock className="w-3 h-3" />
 {v.created_at && new Date(v.created_at).toLocaleString('ru-RU', {
 day: '2-digit', month: '2-digit', year: 'numeric',
 hour: '2-digit', minute: '2-digit',
 })}
 {v.author?.full_name && <span>· {v.author.full_name}</span>}
 </div>
 {v.note && (
 <div className="text-xs text-muted-foreground mt-1 italic">{v.note}</div>
 )}
 </div>
 </div>

 <div className="flex items-center gap-2 flex-shrink-0">
 {v.docx_url && (
 <a
 href={v.docx_url}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-1 px-2.5 py-1 text-xs border border-[var(--hp-border)] text-[var(--hp-sub)] hover:bg-[var(--hp-neutral-tint)] transition-colors"
 >
 <FileText className="w-3 h-3" />
 DOCX
 </a>
 )}
 {!!v.version_data && (
 <button
 disabled={!!restoring}
 onClick={() => {
 if (confirm(`Восстановить версию ${v.version}? Текущее состояние будет сохранено автоматически.`)) {
 handleRestore(v.id)
 }
 }}
 className="flex items-center gap-1 px-2.5 py-1 text-xs border border-[var(--hp-border)] text-[var(--hp-sub)] hover:bg-[var(--hp-neutral-tint)] transition-colors disabled:opacity-50"
 >
 <RotateCcw className={`w-3 h-3 ${restoring === v.id ? 'animate-spin' : ''}`} />
 {restoring === v.id ? 'Восстанавливаю…' : 'Восстановить'}
 </button>
 )}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )
}
