'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'

export interface PartyContact {
  id: string
  full_name: string
  phone?: string | null
  client_type?: string | null
}

export interface PartyRepresentative {
  id: string
  full_name: string
  position?: string | null
  is_primary?: boolean | null
}

interface PartyContactSelectProps {
  label: string
  icon?: ReactNode
  contactFieldName: string
  representativeFieldName: string
  contacts: PartyContact[]
  representativesByContact: Record<string, PartyRepresentative[]>
  defaultContactId?: string
  defaultRepresentativeId?: string
  placeholder: string
}

const sel = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all'

export function PartyContactSelect({
  label, icon, contactFieldName, representativeFieldName,
  contacts, representativesByContact, defaultContactId = '', defaultRepresentativeId = '', placeholder,
}: PartyContactSelectProps) {
  const [contactId, setContactId] = useState(defaultContactId)
  const selected = contacts.find(c => c.id === contactId)
  const isLegalEntity = selected?.client_type === 'legal_entity'
  const reps = contactId ? (representativesByContact[contactId] ?? []) : []

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        {label}
      </label>
      <select
        name={contactFieldName}
        value={contactId}
        onChange={(e) => setContactId(e.target.value)}
        className={sel}
      >
        <option value="">{placeholder}</option>
        {contacts.map(c => (
          <option key={c.id} value={c.id}>
            {c.client_type === 'legal_entity' ? '🏢 ' : ''}{c.full_name}{c.phone ? ` · ${c.phone}` : ''}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        Нет нужного?{' '}
        <Link href="/contacts/new" className="text-primary hover:underline">Добавить контакт →</Link>
      </p>

      {isLegalEntity && (
        <div className="mt-2 pl-3 border-l-2 border-primary/20 space-y-1.5">
          <label className="text-xs font-medium text-foreground">Представитель</label>
          <select name={representativeFieldName} defaultValue={defaultRepresentativeId} className={sel}>
            <option value="">Без указания представителя</option>
            {reps.map(r => (
              <option key={r.id} value={r.id}>
                {r.full_name}{r.position ? ` · ${r.position}` : ''}{r.is_primary ? ' (основной)' : ''}
              </option>
            ))}
          </select>
          {reps.length === 0 && (
            <p className="text-xs text-muted-foreground">
              У организации нет представителей.{' '}
              <Link href={`/contacts/${contactId}`} className="text-primary hover:underline">Добавить →</Link>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
