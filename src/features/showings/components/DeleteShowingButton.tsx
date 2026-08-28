'use client'

import { deleteShowingAction } from '@/features/showings/actions/showings.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'

export function DeleteShowingButton({ id }: { id: string }) {
 return (
 <ServerActionForm action={deleteShowingAction.bind(null, id)}>
 <button
 type="submit"
 onClick={(e) => { if (!confirm('Удалить показ? Это действие нельзя отменить.')) e.preventDefault() }}
 className="w-full py-2 text-sm text-red-500 border border-red-100 hover:bg-red-50 transition-colors"
 >
 Удалить показ
 </button>
 </ServerActionForm>
 )
}
