'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { MessageCircle, Plus, StickyNote } from 'lucide-react'
import {
 logManualCommunicationAction,
 sendWhatsappAction,
} from '../actions/communications.actions'

type Mode = 'closed' | 'manual' | 'whatsapp'

interface ComposerProps {
 contactId: string | null
 leadId: string | null
 dealId: string | null
 phone: string | null
}

const CHANNELS = [
 { value: 'call', label: 'Звонок' },
 { value: 'meeting', label: 'Встреча' },
 { value: 'note', label: 'Заметка' },
 { value: 'sms', label: 'SMS' },
 { value: 'telegram', label: 'Telegram' },
 { value: 'email', label: 'Письмо' },
]

/**
 * Добавление записи в ленту: вручную (звонок с личного мобильного, встреча,
 * заметка) или отправкой WhatsApp через подключённый шлюз.
 */
export function CommunicationComposer({ contactId, leadId, dealId, phone }: ComposerProps) {
 const [mode, setMode] = useState<Mode>('closed')
 const [isPending, startTransition] = useTransition()

 const links = { contactId, leadId, dealId }

 function submitManual(formData: FormData) {
 startTransition(async () => {
 const res = await logManualCommunicationAction(links, formData)
 if (res.error) { toast.error(res.error); return }
 toast.success('Запись добавлена')
 setMode('closed')
 })
 }

 function submitWhatsapp(formData: FormData) {
 startTransition(async () => {
 const res = await sendWhatsappAction(links, formData)
 if (res.error) { toast.error(res.error); return }
 toast.success(res.message ?? 'Сообщение отправлено')
 setMode('closed')
 })
 }

 if (mode === 'closed') {
 return (
 <div className="flex items-center gap-2 flex-wrap">
 <button
 type="button"
 onClick={() => setMode('manual')}
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 <Plus className="w-4 h-4" />
 Записать общение
 </button>
 {phone && (
 <button
 type="button"
 onClick={() => setMode('whatsapp')}
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 <MessageCircle className="w-4 h-4" />
 WhatsApp
 </button>
 )}
 </div>
 )
 }

 if (mode === 'whatsapp') {
 return (
 <form action={submitWhatsapp} className="border border-[var(--hp-border)] p-4 space-y-3">
 <div className="flex items-center gap-2">
 <MessageCircle className="w-4 h-4 text-[var(--hp-sub)]" />
 <span className="text-sm font-semibold text-[var(--hp-ink)]">Сообщение в WhatsApp</span>
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="wa-phone">Номер</label>
 <input id="wa-phone" name="phone" defaultValue={phone ?? ''} className="hp-input" />
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="wa-text">Текст</label>
 <textarea
 id="wa-text"
 name="text"
 rows={3}
 required
 placeholder="Добрый день! Подобрал для вас несколько вариантов…"
 className="w-full px-4 py-2.5 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors resize-none"
 />
 </div>

 <div className="flex items-center gap-3 flex-wrap">
 <button
 type="submit"
 disabled={isPending}
 className="px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 {isPending ? 'Отправляем…' : 'Отправить'}
 </button>
 <button
 type="button"
 onClick={() => setMode('closed')}
 className="px-5 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-semibold text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 Отмена
 </button>
 </div>
 </form>
 )
 }

 return (
 <form action={submitManual} className="border border-[var(--hp-border)] p-4 space-y-3">
 <div className="flex items-center gap-2">
 <StickyNote className="w-4 h-4 text-[var(--hp-sub)]" />
 <span className="text-sm font-semibold text-[var(--hp-ink)]">Записать общение</span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="cm-channel">Тип</label>
 <select
 id="cm-channel"
 name="channel"
 defaultValue="call"
 className="w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer transition-colors"
 >
 {CHANNELS.map((c) => (
 <option key={c.value} value={c.value}>{c.label}</option>
 ))}
 </select>
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="cm-direction">Направление</label>
 <select
 id="cm-direction"
 name="direction"
 defaultValue="outbound"
 className="w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer transition-colors"
 >
 <option value="outbound">Мы инициировали</option>
 <option value="inbound">Клиент обратился</option>
 </select>
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="cm-duration">Длительность, мин</label>
 <input id="cm-duration" name="duration_min" inputMode="numeric" placeholder="—" className="hp-input" />
 </div>
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="cm-body">О чём говорили</label>
 <textarea
 id="cm-body"
 name="body"
 rows={3}
 required
 placeholder="Обсудили условия, договорились о показе в четверг"
 className="w-full px-4 py-2.5 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors resize-none"
 />
 </div>

 <div className="flex items-center gap-3 flex-wrap">
 <button
 type="submit"
 disabled={isPending}
 className="px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 {isPending ? 'Сохраняем…' : 'Сохранить'}
 </button>
 <button
 type="button"
 onClick={() => setMode('closed')}
 className="px-5 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-semibold text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 Отмена
 </button>
 </div>
 </form>
 )
}
