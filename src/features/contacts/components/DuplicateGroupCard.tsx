'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Merge, Phone, Mail, Link2 } from 'lucide-react'
import { mergeContactsAction, type DuplicateGroup } from '../actions/duplicates.actions'

const ROLE_LABEL: Record<string, string> = {
 client: 'Клиент',
 owner: 'Собственник',
 both: 'Клиент и собственник',
}

/**
 * Одна группа дублей: выбираем главную карточку, остальные сливаются в неё.
 *
 * По умолчанию главной предлагается карточка с наибольшим числом связей
 * (сделки, договоры, показы) — переносить историю с неё пришлось бы дольше всего.
 */
export function DuplicateGroupCard({ group }: { group: DuplicateGroup }) {
 const [primaryId, setPrimaryId] = useState(group.contacts[0]?.id ?? '')
 const [done, setDone] = useState(false)
 const [isPending, startTransition] = useTransition()

 const duplicates = group.contacts.filter((c) => c.id !== primaryId)

 function handleMerge() {
 startTransition(async () => {
 const res = await mergeContactsAction(primaryId, duplicates.map((d) => d.id))
 if (res.error) {
 toast.error(res.error)
 return
 }
 toast.success(`Слито карточек: ${res.merged}`)
 setDone(true)
 })
 }

 if (done) {
 return (
 <div className="hp-card p-5">
 <p className="text-sm text-[var(--hp-good)] font-semibold">
 Карточки слиты. <Link href={`/contacts/${primaryId}`} className="underline">Открыть контакт</Link>
 </p>
 </div>
 )
 }

 return (
 <div className="hp-card p-5 space-y-4">
 <div className="flex items-center gap-2 flex-wrap">
 {group.reason === 'phone' ? (
 <Phone className="w-4 h-4 text-[var(--hp-sub)]" />
 ) : (
 <Mail className="w-4 h-4 text-[var(--hp-sub)]" />
 )}
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">{group.key}</h2>
 <span className="hp-badge hp-badge-warn">{group.contacts.length} карточки</span>
 </div>

 <div className="divide-y divide-[var(--hp-border-soft)] border border-[var(--hp-border)]">
 {group.contacts.map((contact) => (
 <label
 key={contact.id}
 className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--hp-neutral-tint)] transition-colors"
 >
 <input
 type="radio"
 name={`primary-${group.key}`}
 checked={primaryId === contact.id}
 onChange={() => setPrimaryId(contact.id)}
 className="mt-1 shrink-0"
 />
 <span className="min-w-0 flex-1">
 <span className="flex items-center gap-2 flex-wrap">
 <span className="text-sm font-semibold text-[var(--hp-ink)] break-words">
 {contact.full_name || 'Без имени'}
 </span>
 {contact.role && (
 <span className="hp-badge hp-badge-neutral shrink-0">
 {ROLE_LABEL[contact.role] ?? contact.role}
 </span>
 )}
 {primaryId === contact.id && <span className="hp-badge hp-badge-good shrink-0">останется</span>}
 </span>
 <span className="block text-xs text-[var(--hp-sub)] mt-0.5">
 {[contact.phone, contact.email].filter(Boolean).join(' · ')}
 </span>
 <span className="flex items-center gap-1 text-xs text-[var(--hp-sub)] mt-0.5">
 <Link2 className="w-3 h-3" />
 связей: {contact.links} · создан{' '}
 {new Date(contact.created_at).toLocaleDateString('ru-RU')}
 </span>
 </span>
 <Link
 href={`/contacts/${contact.id}`}
 target="_blank"
 className="text-xs text-[var(--hp-sub)] hover:text-[var(--hp-ink)] underline shrink-0"
 >
 открыть
 </Link>
 </label>
 ))}
 </div>

 <p className="text-xs text-[var(--hp-sub)]">
 Сделки, договоры, показы и платежи перейдут на выбранную карточку. Пустые поля в ней
 заполнятся данными из дублей. Сами дубли останутся в базе со ссылкой на основную запись.
 </p>

 <button
 type="button"
 onClick={handleMerge}
 disabled={isPending || duplicates.length === 0}
 className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-50"
 >
 <Merge className="w-4 h-4" />
 {isPending ? 'Сливаем…' : `Слить ${duplicates.length} в выбранную`}
 </button>
 </div>
 )
}
