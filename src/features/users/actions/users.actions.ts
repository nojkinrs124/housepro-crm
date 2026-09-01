'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/types/database'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { normalizePhone } from '@/lib/utils'

const VALID_ROLES: UserRole[] = ['admin', 'manager', 'agent', 'accountant']

export async function createEmployeeAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Не авторизован' }
  }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  // Check admin role
  const permError = await requirePermission(user.id, 'employees', 'create')
  if (permError) return permError

  const email = (formData.get('email') as string)?.trim()
  const full_name = (formData.get('full_name') as string)?.trim()
  const role = formData.get('role') as string
  const phone = normalizePhone(formData.get('phone') as string)

  if (!email || !full_name || !role) {
    return { error: 'Заполните все обязательные поля' }
  }

  if (!VALID_ROLES.includes(role as UserRole)) {
    return { error: 'Неверная роль' }
  }

  const payload = {
    email,
    full_name,
    role: role as UserRole,
    phone,
    is_active: true,
    organization_id: orgId,
  }

  const { error } = await supabase.from('users').insert(payload)
  if (error) return { error: error.message }

  revalidatePath('/employees')
  return { success: true }
}

export async function updateEmployeeAction(employeeId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Не авторизован' }
  }

  // Check admin role
  const permError = await requirePermission(user.id, 'employees', 'update')
  if (permError) return permError

  const full_name = (formData.get('full_name') as string)?.trim()
  const role = formData.get('role') as string
  const phone = normalizePhone(formData.get('phone') as string)

  if (!full_name || !role) {
    return { error: 'Заполните все обязательные поля' }
  }

  if (!VALID_ROLES.includes(role as UserRole)) {
    return { error: 'Неверная роль' }
  }

  // Добавочный номер в АТС: по нему вебхук телефонии понимает, кто из
  // сотрудников разговаривал (см. /api/telephony/[provider]).
  const phoneExtension = (formData.get('phone_extension') as string)?.trim() || null

  const payload = {
    full_name,
    role: role as UserRole,
    phone,
    phone_extension: phoneExtension,
  }

  const { error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', employeeId)

  if (error) return { error: error.message }

  revalidatePath('/employees')
  return { success: true }
}

export async function deactivateEmployeeAction(employeeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Не авторизован' }
  }

  // Check admin role
  const permError = await requirePermission(user.id, 'employees', 'delete')
  if (permError) return permError

  // Don't allow deactivating yourself
  if (employeeId === user.id) {
    return { error: 'Нельзя деактивировать себя' }
  }

  const { error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', employeeId)

  if (error) return { error: error.message }

  revalidatePath('/employees')
  return { success: true }
}

export async function activateEmployeeAction(employeeId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Не авторизован' }
  }

  // Check admin role
  const permError = await requirePermission(user.id, 'employees', 'update')
  if (permError) return permError

  const { error } = await supabase
    .from('users')
    .update({ is_active: true })
    .eq('id', employeeId)

  if (error) return { error: error.message }

  revalidatePath('/employees')
  return { success: true }
}
