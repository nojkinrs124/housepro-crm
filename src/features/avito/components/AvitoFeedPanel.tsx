'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, RefreshCw, Loader2 } from 'lucide-react'
import { regenerateAvitoFeedTokenAction, syncAvitoStatusAction } from '@/features/avito/actions/avito.actions'

interface Props {
 feedUrl: string
 lastSyncedAt: string | null
 lastSyncError: string | null
}

export function AvitoFeedPanel({ feedUrl, lastSyncedAt, lastSyncError }: Props) {
 const [regenLoading, setRegenLoading] = useState(false)
 const [syncLoading, setSyncLoading] = useState(false)
 const router = useRouter()

 async function copyUrl() {
 try {
 await navigator.clipboard.writeText(feedUrl)
 toast.success('Ссылка скопирована')
 } catch {
 toast.error('Не удалось скопировать — скопируйте вручную')
 }
 }

 async function handleRegenerate() {
 if (!confirm('Старая ссылка на фид перестанет работать. Обновить её в личном кабинете Авито нужно будет вручную. Продолжить?')) return
 setRegenLoading(true)
 const res = await regenerateAvitoFeedTokenAction()
 setRegenLoading(false)
 if (res && 'error' in res && res.error) toast.error(res.error)
 else { toast.success('Ссылка обновлена'); router.refresh() }
 }

 async function handleSync() {
 setSyncLoading(true)
 const res = await syncAvitoStatusAction()
 setSyncLoading(false)
 if (res && 'error' in res && res.error) toast.error(res.error)
 else if (res && 'warning' in res && res.warning) toast.info(res.warning)
 else if (res && 'matched' in res) toast.success(`Статус обновлён — сопоставлено объектов: ${res.matched}`)
 else toast.success('Статус обновлён')
 router.refresh()
 }

 return (
 <div className="hp-card p-5 space-y-4" style={{ }}>
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Ссылка на фид для автозагрузки</h2>
 <p className="text-sm text-muted-foreground leading-relaxed">
 Вставьте эту ссылку в личном кабинете Авито: <b>Профиль → Автозагрузка → Настройки</b>.
 В фид попадают только объекты, у которых включена публикация на Авито и статус «Свободен».
 </p>

 <div className="flex flex-col sm:flex-row gap-2">
 <input
 readOnly value={feedUrl} onFocus={(e) => e.currentTarget.select()}
 className="flex-1 min-w-0 h-10 px-4 border border-input bg-slate-50 text-foreground text-sm font-mono truncate"
 />
 <button
 onClick={copyUrl}
 className="flex items-center justify-center gap-2 px-4 py-2 border border-[var(--hp-border)] text-sm font-semibold text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-all whitespace-nowrap shrink-0"
 >
 <Copy className="w-4 h-4" />
 Скопировать
 </button>
 <button
 onClick={handleRegenerate}
 disabled={regenLoading}
 className="flex items-center justify-center gap-2 px-4 py-2 border border-[var(--hp-border)] text-sm font-semibold text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-all whitespace-nowrap shrink-0 disabled:opacity-60"
 >
 {regenLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
 Новая ссылка
 </button>
 </div>

 <div className="border-t border-[var(--hp-border-soft)] pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <div className="min-w-0">
 <p className="text-sm font-semibold text-[var(--hp-ink)]">Статус синхронизации</p>
 <p className="text-xs text-muted-foreground mt-0.5">
 {lastSyncedAt ? `Обновлено: ${new Date(lastSyncedAt).toLocaleString('ru-RU')}` : 'Синхронизация ещё не запускалась'}
 </p>
 {lastSyncError && (
 <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 p-2 mt-2 leading-relaxed break-words">
 {lastSyncError}
 </p>
 )}
 </div>
 <button
 onClick={handleSync}
 disabled={syncLoading}
 className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60 disabled:hover:translate-y-0 whitespace-nowrap shrink-0"
 style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)', }}
 >
 {syncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
 Обновить статус
 </button>
 </div>
 </div>
 )
}
