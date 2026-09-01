'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CalendarDays, Copy, RefreshCw, Trash2 } from 'lucide-react'
import { regenerateIcalTokenAction, revokeIcalTokenAction } from '../actions/calendar.actions'

/**
 * Блок «Подписка на календарь» в профиле.
 *
 * Ссылку показываем целиком: её нужно скопировать в Google/Яндекс/Apple-календарь,
 * а не открыть в браузере, поэтому кнопка «Скопировать» важнее, чем сама ссылка.
 */
export function CalendarSubscription({
 initialToken,
 siteUrl,
}: {
 initialToken: string | null
 siteUrl: string
}) {
 const [token, setToken] = useState(initialToken)
 const [isPending, startTransition] = useTransition()

 const url = token ? `${siteUrl}/api/ical/${token}` : null

 function generate() {
 startTransition(async () => {
 const res = await regenerateIcalTokenAction()
 if (res.error) { toast.error(res.error); return }
 setToken(res.token ?? null)
 toast.success(initialToken ? 'Ссылка перевыпущена' : 'Ссылка создана')
 })
 }

 function revoke() {
 if (!confirm('Отозвать ссылку? Календари, подписанные на неё, перестанут обновляться.')) return
 startTransition(async () => {
 const res = await revokeIcalTokenAction()
 if (res.error) { toast.error(res.error); return }
 setToken(null)
 toast.success('Ссылка отозвана')
 })
 }

 async function copy() {
 if (!url) return
 try {
 await navigator.clipboard.writeText(url)
 toast.success('Ссылка скопирована')
 } catch {
 toast.error('Не удалось скопировать — выделите ссылку вручную')
 }
 }

 return (
 <div className="hp-card p-5 space-y-4">
 <div className="flex items-center gap-2">
 <CalendarDays className="w-4 h-4 text-[var(--hp-sub)]" />
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Подписка на календарь</h2>
 </div>

 <p className="text-sm text-[var(--hp-sub)]">
 Показы и задачи с дедлайном появятся в вашем календаре на телефоне. Скопируйте ссылку
 и добавьте её как календарь по URL: в Google Календаре — «Другие календари → Подписаться
 по URL», в Apple — «Файл → Новая подписка».
 </p>

 {url ? (
 <>
 <div className="flex items-center gap-2 flex-wrap">
 <code className="flex-1 min-w-0 px-3 py-2 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] text-xs text-[var(--hp-ink)] break-all">
 {url}
 </code>
 </div>
 <div className="flex items-center gap-2 flex-wrap">
 <button
 type="button"
 onClick={copy}
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 <Copy className="w-4 h-4" />
 Скопировать
 </button>
 <button
 type="button"
 onClick={generate}
 disabled={isPending}
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors disabled:opacity-60"
 >
 <RefreshCw className="w-4 h-4" />
 Перевыпустить
 </button>
 <button
 type="button"
 onClick={revoke}
 disabled={isPending}
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)] transition-colors disabled:opacity-60"
 >
 <Trash2 className="w-4 h-4" />
 Отозвать
 </button>
 </div>
 <p className="text-xs text-[var(--hp-sub)]">
 Ссылка секретная: любой, у кого она есть, видит ваше расписание. Если она утекла —
 перевыпустите, старая перестанет работать.
 </p>
 </>
 ) : (
 <button
 type="button"
 onClick={generate}
 disabled={isPending}
 className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 <CalendarDays className="w-4 h-4" />
 {isPending ? 'Создаём…' : 'Создать ссылку на календарь'}
 </button>
 )}
 </div>
 )
}
