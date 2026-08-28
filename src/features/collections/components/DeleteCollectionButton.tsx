'use client'

import { deleteCollectionAction } from '@/features/collections/actions/collections.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { Trash2 } from 'lucide-react'

export function DeleteCollectionButton({ id }: { id: string }) {
 return (
 <ServerActionForm action={deleteCollectionAction.bind(null, id)}>
 <button
 type="submit"
 onClick={(e) => { if (!confirm('Удалить подборку?')) e.preventDefault() }}
 className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </ServerActionForm>
 )
}
