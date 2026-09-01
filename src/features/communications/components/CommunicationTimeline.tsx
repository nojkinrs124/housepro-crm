import { createClient } from '@/lib/supabase/server'
import { Phone, PhoneMissed, MessageCircle, Mail, StickyNote, Users, Send, PlayCircle } from 'lucide-react'
import { CommunicationComposer } from './CommunicationComposer'

// Единая лента общения с клиентом: звонки из АТС, сообщения WhatsApp, письма,
// заметки и встречи. Серверный компонент — данные и разметка, интерактив
// вынесен в CommunicationComposer.

interface TimelineProps {
 contactId?: string | null
 leadId?: string | null
 dealId?: string | null
 /** Телефон для быстрой отправки WhatsApp и подписи в шапке. */
 phone?: string | null
 limit?: number
}

interface Row {
 id: string
 channel: string
 direction: string
 status: string | null
 occurred_at: string
 duration_sec: number | null
 subject: string | null
 body: string | null
 recording_url: string | null
 counterparty_phone: string | null
 user_id: string | null
}

const CHANNEL_META: Record<string, { label: string; Icon: typeof Phone }> = {
 call: { label: 'Звонок', Icon: Phone },
 whatsapp: { label: 'WhatsApp', Icon: MessageCircle },
 telegram: { label: 'Telegram', Icon: Send },
 sms: { label: 'SMS', Icon: MessageCircle },
 email: { label: 'Письмо', Icon: Mail },
 note: { label: 'Заметка', Icon: StickyNote },
 meeting: { label: 'Встреча', Icon: Users },
 avito: { label: 'Авито', Icon: MessageCircle },
}

function formatDuration(seconds: number | null): string | null {
 if (!seconds || seconds <= 0) return null
 const m = Math.floor(seconds / 60)
 const s = seconds % 60
 return m > 0 ? `${m} мин ${s} сек` : `${s} сек`
}

function formatWhen(iso: string): string {
 return new Date(iso).toLocaleString('ru-RU', {
 day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
 })
}

export async function CommunicationTimeline({
 contactId,
 leadId,
 dealId,
 phone,
 limit = 30,
}: TimelineProps) {
 const supabase = await createClient()

 let query = supabase
 .from('communications')
 .select('id, channel, direction, status, occurred_at, duration_sec, subject, body, recording_url, counterparty_phone, user_id')
 .order('occurred_at', { ascending: false })
 .limit(limit)

 // Фильтр по той сущности, на чьей карточке лента показана. Один из id
 // обязателен — без него лента показала бы общение по всей организации.
 if (contactId) query = query.eq('contact_id', contactId)
 else if (leadId) query = query.eq('lead_id', leadId)
 else if (dealId) query = query.eq('deal_id', dealId)
 else return null

 const { data, error } = await query
 const rows = (data ?? []) as Row[]

 const authorIds = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id))]
 const authors = new Map<string, string>()
 if (authorIds.length > 0) {
 const { data: users } = await supabase.from('users').select('id, full_name').in('id', authorIds)
 for (const u of users ?? []) authors.set(u.id, u.full_name ?? '')
 }

 return (
 <div className="hp-card p-5 space-y-4">
 <div className="flex items-center justify-between gap-3 flex-wrap">
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">История общения</h2>
 {rows.length > 0 && (
 <span className="text-xs text-[var(--hp-sub)]">
 последнее: {formatWhen(rows[0].occurred_at)}
 </span>
 )}
 </div>

 <CommunicationComposer
 contactId={contactId ?? null}
 leadId={leadId ?? null}
 dealId={dealId ?? null}
 phone={phone ?? null}
 />

 {error && (
 <p className="text-sm text-[var(--hp-danger)]">Не удалось загрузить историю: {error.message}</p>
 )}

 {rows.length === 0 ? (
 <p className="text-sm text-[var(--hp-sub)]">
 Пока пусто. Звонки и сообщения появятся здесь автоматически, если подключены
 телефония и WhatsApp; заметки можно добавлять вручную.
 </p>
 ) : (
 <div className="divide-y divide-[var(--hp-border-soft)]">
 {rows.map((row) => {
 const meta = CHANNEL_META[row.channel] ?? CHANNEL_META.note
 const missed = row.channel === 'call' && row.status !== 'answered'
 const Icon = missed ? PhoneMissed : meta.Icon
 const duration = formatDuration(row.duration_sec)

 return (
 <div key={row.id} className="flex items-start gap-3 py-3">
 <Icon
 className="w-4 h-4 shrink-0 mt-0.5"
 style={{ color: missed ? 'var(--hp-danger)' : 'var(--hp-sub)' }}
 />
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-sm font-semibold text-[var(--hp-ink)]">
 {row.subject || meta.label}
 </span>
 <span className="hp-badge hp-badge-neutral shrink-0">
 {row.direction === 'inbound' ? 'входящее' : row.direction === 'internal' ? 'внутреннее' : 'исходящее'}
 </span>
 {duration && <span className="text-xs text-[var(--hp-sub)]">{duration}</span>}
 </div>
 {row.body && (
 <p className="text-sm text-[var(--hp-sub)] mt-1 whitespace-pre-line break-words">{row.body}</p>
 )}
 <div className="flex items-center gap-2 flex-wrap mt-1">
 <span className="text-xs text-[var(--hp-tertiary)]">{formatWhen(row.occurred_at)}</span>
 {row.user_id && authors.get(row.user_id) && (
 <span className="text-xs text-[var(--hp-tertiary)]">· {authors.get(row.user_id)}</span>
 )}
 {row.recording_url && (
 <a
 href={row.recording_url}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-1 text-xs text-[var(--hp-accent)] hover:underline"
 >
 <PlayCircle className="w-3.5 h-3.5" />
 запись
 </a>
 )}
 </div>
 </div>
 </div>
 )
 })}
 </div>
 )}
 </div>
 )
}
