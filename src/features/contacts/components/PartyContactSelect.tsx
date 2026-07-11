'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { QuickCreateModal } from '@/components/ui/QuickCreateModal'
import { QuickCreateContactForm } from './QuickCreateContactForm'

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
  /** Роль, с которой будет создан новый контакт из модалки быстрого создания */
  quickCreateRole?: 'owner' | 'client' | 'both'
}

const sel = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all'

export function PartyContactSelect({
  label, icon, contactFieldName, representativeFieldName,
  contacts: initialContacts, representativesByContact, defaultContactId = '', defaultRepresentativeId = '', placeholder,
  quickCreateRole = 'both',
}: PartyContactSelectProps) {
  const [contacts, setContacts] = useState(initialContacts)
  const [contactId, setContactId] = useState(defaultContactId)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
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
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        Нет нужного?{' '}
        <button
          type="button"
          onClick={() => setShowQuickCreate(true)}
          className="text-primary hover:underline inline-flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Создать контакт
        </button>
        {' '}или{' '}
        <Link href="/contacts/new" target="_blank" className="text-primary hover:underline">открыть форму →</Link>
      </p>

      {showQuickCreate && (
        <QuickCreateModal title={`Новый контакт — ${label}`} onClose={() => setShowQuickCreate(false)}>
          <QuickCreateContactForm
            role={quickCreateRole}
            onCancel={() => setShowQuickCreate(false)}
            onCreated={(contact) => {
              setContacts(prev => [...prev, contact])
              setContactId(contact.id)
              setShowQuickCreate(false)
            }}
          />
        </QuickCreateModal>
      )}

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
