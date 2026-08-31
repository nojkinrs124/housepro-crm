'use client'

import { Trash2 } from 'lucide-react'
import { deleteContractAction } from '@/features/contracts/actions/contracts.actions'

export function DeleteContractButton({ contractId }: { contractId: string }) {
 async function handleClick() {
 if (!confirm('Удалить договор? Это действие нельзя отменить.')) return
 await deleteContractAction(contractId)
 }

 return (
 <button
 onClick={handleClick}
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] text-[var(--hp-danger)] text-sm font-medium hover:bg-[var(--hp-danger-tint)] transition"
 title="Удалить договор"
 >
 <Trash2 className="w-4 h-4" />
 Удалить
 </button>
 )
}
