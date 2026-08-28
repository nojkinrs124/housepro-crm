'use client'

import { Trash2 } from 'lucide-react'
import { deletePropertyAction } from '@/features/properties/actions/properties.actions'

export function DeletePropertyButton({ propertyId }: { propertyId: string }) {
 async function handleClick() {
 if (!confirm('Удалить объект? Это действие нельзя отменить.')) return
 await deletePropertyAction(propertyId)
 }

 return (
 <button
 onClick={handleClick}
 className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition"
 title="Удалить объект"
 >
 <Trash2 className="w-4 h-4" />
 Удалить
 </button>
 )
}
