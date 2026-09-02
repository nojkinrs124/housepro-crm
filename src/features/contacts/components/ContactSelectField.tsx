'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { QuickCreateModal } from '@/components/ui/QuickCreateModal'
import { QuickCreateContactForm } from './QuickCreateContactForm'

export interface ContactOption {
  id: string
  full_name: string
  phone?: string | null
}

/**
 * Выбор контакта с возможностью завести его не выходя из формы.
 *
 * Порядок «сначала контакт, потом всё остальное» на практике не соблюдается:
 * объект приносят раньше, чем оформлен собственник. Без быстрого создания
 * поле оставляли пустым «на потом» — и оно оставалось пустым навсегда:
 * в «Управлении» и в отчёте на месте собственника прочерк.
 */
export function ContactSelectField({
  contacts: initialContacts,
  defaultContactId = '',
  name = 'owner_contact_id',
  label = 'Собственник',
  role = 'owner',
  placeholder = '— не указан —',
}: {
  contacts: ContactOption[]
  defaultContactId?: string
  name?: string
  label?: string
  /** С какой ролью создаётся контакт из модалки быстрого создания */
  role?: 'owner' | 'client' | 'both'
  placeholder?: string
}) {
  const [contacts, setContacts] = useState(initialContacts)
  const [contactId, setContactId] = useState(defaultContactId)
  const [showQuickCreate, setShowQuickCreate] = useState(false)

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
        <select
          name={name}
          value={contactId}
          onChange={e => setContactId(e.target.value)}
          className="w-full sm:flex-1 sm:min-w-0 h-10 px-4 border border-input bg-background text-foreground text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer"
        >
          <option value="">{placeholder}</option>
          {contacts.map(o => (
            <option key={o.id} value={o.id}>
              {o.full_name}{o.phone ? ` · ${o.phone}` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowQuickCreate(true)}
          className="h-10 px-4 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Создать
        </button>
      </div>

      {showQuickCreate && (
        <QuickCreateModal title={`Новый контакт — ${label.toLowerCase()}`} onClose={() => setShowQuickCreate(false)}>
          <QuickCreateContactForm
            role={role}
            onCancel={() => setShowQuickCreate(false)}
            onCreated={contact => {
              setContacts(prev => [...prev, contact])
              setContactId(contact.id)
              setShowQuickCreate(false)
            }}
          />
        </QuickCreateModal>
      )}
    </div>
  )
}
