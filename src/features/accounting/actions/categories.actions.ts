'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { AccountingTransactionType } from '@/types/database'

export async function createCategoryAction(_prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const name  = (formData.get('name') as string)?.trim()
  const type  = formData.get('type') as AccountingTransactionType
  const color = (formData.get('color') as string) || '#64748B'
  const icon  = (formData.get('icon') as string) || 'tag'

  if (!name) return { error: 'Название обязательно' }
  if (!type || !['income', 'expense'].includes(type)) return { error: 'Тип обязателен' }

  const { error } = await supabase
    .from('accounting_categories')
    .insert({ name, type, color, icon, is_system: false, created_by: user.id })

  if (error) return { error: error.message }

  revalidatePath('/accounting/categories')
  return { success: true }
}

export async function updateCategoryAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  // Check not system
  const { data: cat } = await supabase
    .from('accounting_categories')
    .select('is_system')
    .eq('id', id)
    .single()
  if (cat?.is_system) return { error: 'Системные категории нельзя изменять' }

  const name  = (formData.get('name') as string)?.trim()
  const color = (formData.get('color') as string) || '#64748B'
  const icon  = (formData.get('icon') as string) || 'tag'

  if (!name) return { error: 'Название обязательно' }

  const { error } = await supabase
    .from('accounting_categories')
    .update({ name, color, icon })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/accounting/categories')
  return { success: true }
}

export async function deleteCategoryAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: cat } = await supabase
    .from('accounting_categories')
    .select('is_system')
    .eq('id', id)
    .single()
  if (cat?.is_system) return { error: 'Системные категории нельзя удалять' }

  // Detach from transactions
  await supabase
    .from('accounting_transactions')
    .update({ category_id: null })
    .eq('category_id', id)

  const { error } = await supabase
    .from('accounting_categories')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/accounting/categories')
  return { success: true }
}
