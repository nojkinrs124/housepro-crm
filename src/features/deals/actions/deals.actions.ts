'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createDealAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const values = {
    client_id: formData.get('client_id') as string || null,
    property_id: formData.get('property_id') as string || null,
    deal_type: formData.get('deal_type') as string || 'rent',
    amount: formData.get('amount') ? Number(formData.get('amount')) : null,
    commission: formData.get('commission') ? Number(formData.get('commission')) : null,
    notes: formData.get('notes') as string || null,
    status: 'new' as const,
    manager_id: user.id,
  }

  const { error } = await supabase.from('deals').insert(values)
  if (error) return { error: error.message }

  revalidatePath('/deals')
  redirect('/deals')
}

export async function updateDealStatusAction(id: string, status: string) {
  const supabase = await createClient()
  await supabase.from('deals').update({ status }).eq('id', id)
  revalidatePath('/deals')
}
