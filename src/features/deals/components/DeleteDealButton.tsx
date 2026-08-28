'use client'

import { Trash2 } from 'lucide-react'
import { deleteDealAction } from '@/features/deals/actions/deals.actions'

export function DeleteDealButton({ dealId }: { dealId: string }) {
 async function handleClick() {
 if (!confirm('Удалить сделку? Это действие нельзя отменить.')) return
 await deleteDealAction(dealId)
 }

 return (
 <button
 onClick={handleClick}
 className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition"
 title="Удалить сделку"
 >
 <Trash2 className="w-4 h-4" />
 Удалить
 </button>
 )
}
