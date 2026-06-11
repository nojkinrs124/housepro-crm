'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContractSchema } from '@/lib/schemas'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createContractAction(_prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = ContractSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const { data: contract, error } = await supabase
    .from('contracts')
    .insert({ ...parsed.data, status: 'draft', manager_id: user.id })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/contracts')
  revalidateTag('analytics')
  redirect(`/contracts/${contract.id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateContractAction(id: string, _prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = ContractSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const { error } = await supabase.from('contracts').update(parsed.data).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/contracts')
  revalidateTag('analytics')
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
  revalidateTag('analytics')
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
  revalidateTag('analytics')
  revalidatePath(`/contracts/${id}`)
  return { success: true }
}
