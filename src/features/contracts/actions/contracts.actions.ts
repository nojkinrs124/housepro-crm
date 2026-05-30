'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createContractAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const values = {
    contract_type: formData.get('contract_type') as string,
    client_id: formData.get('client_id') as string || null,
    property_id: formData.get('property_id') as string || null,
    amount: formData.get('amount') ? Number(formData.get('amount')) : null,
    deposit: formData.get('deposit') ? Number(formData.get('deposit')) : null,
    start_date: formData.get('start_date') as string || null,
    end_date: formData.get('end_date') as string || null,
    notes: formData.get('notes') as string || null,
    status: 'draft' as const,
    manager_id: user.id,
  }

  if (!values.contract_type) {
    return { error: 'Тип договора обязателен' }
  }

  const { error } = await supabase.from('contracts').insert(values)
  if (error) return { error: error.message }

  revalidatePath('/contracts')
  redirect('/contracts')
}

export async function updateContractAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const values = {
    contract_type: formData.get('contract_type') as string,
    client_id: formData.get('client_id') as string || null,
    property_id: formData.get('property_id') as string || null,
    amount: formData.get('amount') ? Number(formData.get('amount')) : null,
    deposit: formData.get('deposit') ? Number(formData.get('deposit')) : null,
    start_date: formData.get('start_date') as string || null,
    end_date: formData.get('end_date') as string || null,
    notes: formData.get('notes') as string || null,
    status: formData.get('status') as string,
  }

  const { error } = await supabase
    .from('contracts')
    .update(values)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/contracts')
  revalidatePath(`/contracts/${id}`)
  redirect(`/contracts/${id}`)
}

export async function deleteContractAction(id: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Проверяем права доступа
  const { data: userRole } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userRole?.role !== 'admin') {
    return { error: 'Только администраторы могут удалять договоры' }
  }

  const { error } = await supabase.from('contracts').delete().eq('id', id)
  
  if (error) {
    return { error: error.message }
  }

  revalidatePath('/contracts')
  redirect('/contracts')
}
