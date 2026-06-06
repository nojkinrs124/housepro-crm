'use client'

import { Trash2 } from 'lucide-react'
import { deleteLeadAction } from '@/features/leads/actions/leads.actions'

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  async function handleClick() {
    if (!confirm('Удалить лид? Это действие нельзя отменить.')) return
    await deleteLeadAction(leadId)
  }

  return (
    <button
      onClick={handleClick}
      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition"
      title="Удалить лид"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
