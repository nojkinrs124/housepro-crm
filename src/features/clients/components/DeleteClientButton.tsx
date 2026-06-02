'use client'

import { Trash2 } from 'lucide-react'
import { deleteClientAction } from '@/features/clients/actions/clients.actions'

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const handleDelete = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!confirm('Удалить клиента?')) return
    await deleteClientAction(clientId)
  }

  return (
    <form onSubmit={handleDelete}>
      <button
        type="submit"
        className="flex items-center gap-2 px-4 py-2 border border-destructive/30 text-destructive rounded-xl text-sm font-medium hover:bg-destructive/10 transition-all"
      >
        <Trash2 className="w-4 h-4" />
        Удалить
      </button>
    </form>
  )
}
