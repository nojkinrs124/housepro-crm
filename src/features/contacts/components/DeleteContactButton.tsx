'use client'

import { Trash2 } from 'lucide-react'
import { deleteContactAction } from '@/features/contacts/actions/contacts.actions'

export function DeleteContactButton({ contactId }: { contactId: string }) {
  async function handleClick() {
    if (!confirm('Удалить контакт? Это действие нельзя отменить.')) return
    await deleteContactAction(contactId)
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] text-[var(--hp-danger)] rounded-[var(--hp-radius)] text-sm font-medium hover:border-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)] transition-colors"
      title="Удалить контакт"
    >
      <Trash2 className="w-4 h-4" />
      Удалить
    </button>
  )
}
