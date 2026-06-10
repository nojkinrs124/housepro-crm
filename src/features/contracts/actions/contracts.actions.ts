'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createContractAction(_prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const contract_type = formData.get('contract_type') as string
  if (!contract_type) return { error: 'Тип договора обязателен' }

  const values = {
    contract_type,
    owner_contact_id: (formData.get('owner_contact_id') as string) || null,
    client_contact_id: (formData.get('client_contact_id') as string) || null,
    client_id: (formData.get('client_contact_id') as string) || (formData.get('client_id') as string) || null,
    property_id: (formData.get('property_id') as string) || null,
    amount:     formData.get('amount')     ? Number(formData.get('amount'))     : null,
    deposit:    formData.get('deposit')    ? Number(formData.get('deposit'))    : null,
    start_date: (formData.get('start_date') as string) || null,
    end_date:   (formData.get('end_date')   as string) || null,
    notes:      (formData.get('notes')      as string) || null,
    status:     'draft' as const,
    manager_id: user.id,
  }

  const { data: contract, error } = await supabase.from('contracts').insert(values).select().single()
  if (error) return { error: error.message }

  revalidatePath('/contracts')
  redirect(`/contracts/${contract.id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateContractAction(id: string, _prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const values = {
    contract_type:     (formData.get('contract_type')     as string),
    owner_contact_id:  (formData.get('owner_contact_id')  as string) || null,
    client_contact_id: (formData.get('client_contact_id') as string) || null,
    client_id:         (formData.get('client_contact_id') as string) || (formData.get('client_id') as string) || null,
    property_id:       (formData.get('property_id')       as string) || null,
    amount:    formData.get('amount')     ? Number(formData.get('amount'))     : null,
    deposit:   formData.get('deposit')    ? Number(formData.get('deposit'))    : null,
    start_date:(formData.get('start_date') as string) || null,
    end_date:  (formData.get('end_date')   as string) || null,
    notes:     (formData.get('notes')      as string) || null,
    status:    (formData.get('status')     as string) || 'draft',
  }

  const { error } = await supabase.from('contracts').update(values).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/contracts')
  revalidatePath(`/contracts/${id}`)
  redirect(`/contracts/${id}`)
}

export async function deleteContractAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRole } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  if (userRole?.role !== 'admin') {
    return { error: 'Только администраторы могут удалять договоры' }
  }

  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/contracts')
  redirect('/contracts')
}

export async function updateContractStatusAction(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const valid = ['draft', 'generated', 'signed', 'completed', 'cancelled']
  if (!valid.includes(status)) return { error: 'Недопустимый статус' }

  const { error } = await supabase.from('contracts').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/contracts')
  revalidatePath(`/contracts/${id}`)
  return { success: true }
}
