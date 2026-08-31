'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Megaphone, Loader2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { toggleAvitoPublishAction } from '@/features/avito/actions/avito.actions'
import type { AvitoPropertyStatus } from '@/types/database'

interface Props {
 propertyId: string
 isPublished: boolean
 status?: AvitoPropertyStatus | null
 error?: string | null
 syncedAt?: string | null
 eligible: boolean // status === 'available'
}

const STATUS_UI: Record<string, { label: string; className: string; icon: typeof Clock }> = {
 pending: { label: 'Ожидает публикации', className: 'bg-amber-100 text-amber-700', icon: Clock },
 active: { label: 'Опубликован', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
 error: { label: 'Ошибка публикации', className: 'bg-red-100 text-red-700', icon: AlertTriangle },
 removed: { label: 'Снят на Авито', className: 'bg-slate-100 text-[var(--hp-sub)]', icon: AlertTriangle },
}

export function AvitoPublishToggle({ propertyId, isPublished, status, error, syncedAt, eligible }: Props) {
 const [loading, setLoading] = useState(false)
 const router = useRouter()

 async function handleToggle() {
 setLoading(true)
 const res = await toggleAvitoPublishAction(propertyId, !isPublished)
 setLoading(false)
 if (res && 'error' in res && res.error) {
 toast.error(res.error)
 return
 }
 toast.success(isPublished ? 'Объект снят с публикации на Авито' : 'Объект поставлен в очередь на публикацию')
 router.refresh()
 }

 const ui = status ? STATUS_UI[status] : null
 const Icon = ui?.icon

 return (
 <div className="hp-card p-5 space-y-3">
 <div className="flex items-center gap-2.5">
 <div className="w-9 h-9 flex items-center justify-center shrink-0 bg-blue-50">
 <Megaphone className="text-blue-600" style={{ width: 16, height: 16 }} />
 </div>
 <div className="min-w-0">
 <h2 className="font-bold text-foreground text-[15px]">Авито</h2>
 <p className="text-xs text-muted-foreground mt-0.5">Публикация через автозагрузку</p>
 </div>
 </div>

 {isPublished && ui && Icon && (
 <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${ui.className}`}>
 <Icon className="w-3 h-3" />
 {ui.label}
 </span>
 )}

 {isPublished && error && (
 <p className="text-xs text-red-600 bg-red-50 border border-red-100 p-2 leading-relaxed break-words">
 {error}
 </p>
 )}

 {isPublished && syncedAt && (
 <p className="text-xs text-muted-foreground">
 Статус обновлён: {new Date(syncedAt).toLocaleString('ru-RU')}
 </p>
 )}

 {!eligible && !isPublished ? (
 <p className="text-xs text-muted-foreground leading-relaxed">
 Публикация доступна только для объектов со статусом «Свободен»
 </p>
 ) : (
 <button
 onClick={handleToggle}
 disabled={loading}
 className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold transition-all disabled:opacity-60 disabled:hover:translate-y-0"
 style={
 isPublished
 ? { background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#374151', }
 : { background: 'linear-gradient(135deg, #2563EB, #3B82F6)', color: '#fff', }
 }
 >
 {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
 {isPublished ? 'Снять с публикации' : 'Опубликовать на Авито'}
 </button>
 )}
 </div>
 )
}
