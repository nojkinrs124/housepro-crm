'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { createContactQuickAction } from '../actions/contacts.actions'
import { findContactByPhoneAction } from '../actions/duplicates.actions'
import type { PartyContact } from './PartyContactSelect'

const input = 'w-full h-10 px-4 border border-input bg-background text-foreground text-sm outline-none focus:border-[var(--hp-ink)] transition-all'

export function QuickCreateContactForm({
 role,
 onCreated,
 onCancel,
}: {
 role: 'owner' | 'client' | 'both'
 onCreated: (contact: PartyContact) => void
 onCancel: () => void
}) {
 const [fullName, setFullName] = useState('')
 const [phone, setPhone] = useState('')
 const [error, setError] = useState<string | null>(null)
 const [pending, startTransition] = useTransition()
 // Быстрое создание — самый короткий путь к дублю: имя набирают на слух,
 // карточка того же человека уже есть. Ищем по телефону и предупреждаем,
 // но не запрещаем: муж и жена на одном номере — законный случай.
 const [phoneMatches, setPhoneMatches] = useState<{ id: string; full_name: string }[]>([])
 const [, startPhoneCheck] = useTransition()

 const submit = () => {
 if (!fullName.trim()) {
 setError('Укажите имя')
 return
 }
 setError(null)

 const fd = new FormData()
 fd.set('full_name', fullName.trim())
 fd.set('phone', phone.trim())
 fd.set('role', role)
 fd.set('client_type', 'individual')
 fd.set('status', 'new')

 startTransition(async () => {
 const res = await createContactQuickAction(fd)
 if (res && 'error' in res) {
 setError(res.error ?? 'Ошибка')
 } else if (res && 'data' in res) {
 onCreated(res.data as PartyContact)
 }
 })
 }

 return (
 <div className="space-y-3">
 {error && (
 <div className="flex items-center gap-2 border border-[var(--hp-border)] bg-[var(--hp-danger-tint)] px-3 py-2 text-sm text-[var(--hp-danger)]">
 <AlertCircle className="w-4 h-4 shrink-0" />
 {error}
 </div>
 )}

 <div className="space-y-1.5">
 <label className="text-sm font-medium text-foreground">Имя / название *</label>
 <input
 autoFocus
 value={fullName}
 onChange={(e) => setFullName(e.target.value)}
 placeholder="Иванов Иван Иванович"
 className={input}
 />
 </div>

 <div className="space-y-1.5">
 <label className="text-sm font-medium text-foreground">Телефон</label>
 <input
 value={phone}
 onChange={(e) => setPhone(e.target.value)}
 onBlur={(e) => {
 const value = e.target.value
 if (!value.trim()) { setPhoneMatches([]); return }
 startPhoneCheck(async () => {
 const res = await findContactByPhoneAction(value)
 setPhoneMatches(res.matches)
 })
 }}
 placeholder="+7 900 000-00-00"
 className={input}
 />
 {phoneMatches.length > 0 && (
 <p className="text-xs text-[var(--hp-warn)]">
 Такой телефон уже есть:{' '}
 {phoneMatches.slice(0, 3).map((m, i) => (
 <span key={m.id}>
 {i > 0 && ', '}
 <Link href={`/contacts/${m.id}`} target="_blank" className="underline">
 {m.full_name || 'без имени'}
 </Link>
 </span>
 ))}
 . Проверьте, не дубль ли это.
 </p>
 )}
 </div>

 <p className="text-xs text-muted-foreground">
 Остальные поля (email, паспорт, реквизиты и др.) можно заполнить позже в карточке контакта.
 </p>

 <div className="flex gap-2 pt-2">
 <button
 type="button"
 onClick={submit}
 disabled={pending || !fullName.trim()}
 className="flex-1 h-10 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {pending ? 'Создание...' : 'Создать и выбрать'}
 </button>
 <button
 type="button"
 onClick={onCancel}
 disabled={pending}
 className="flex-1 h-10 border border-border text-foreground text-sm font-medium hover:bg-muted transition"
 >
 Отмена
 </button>
 </div>
 </div>
 )
}
