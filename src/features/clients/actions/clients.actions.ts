'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/permissions'

export async function deleteClientAction(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Легаси-таблица clients (см. docs/WORKFLOW.md) — используем ресурс
  // contacts, куда она концептуально мигрировала.
  const permError = await requirePermission(user.id, 'contacts', 'delete')
  if (permError) return permError

  const { error } = await supabase.from('clients').delete().eq('id', id)
  
  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  redirect('/clients')
}
