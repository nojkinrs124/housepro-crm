'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/types/database'
import { getSessionContext } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { normalizePhone } from '@/lib/utils'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { rateLimitCreate } from '@/lib/rate-limit'
import { getSiteUrl } from '@/lib/telegram/site-url'
import { writeAuditLog } from '@/lib/audit'

const VALID_ROLES: UserRole[] = ['admin', 'manager', 'agent', 'accountant']

export async function createEmployeeAction(formData: FormData) {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'employees', 'create')
  if (permError) return permError

  const rl = await rateLimitCreate(user.id, 'employee_invite')
  if (!rl.success) return { error: 'Слишком много приглашений подряд. Подождите минуту.' }

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const full_name = (formData.get('full_name') as string)?.trim()
  const role = formData.get('role') as string
  const phone = normalizePhone(formData.get('phone') as string)

  if (!email || !full_name || !role) return { error: 'Заполните все обязательные поля' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Некорректный email' }
  if (!VALID_ROLES.includes(role as UserRole)) return { error: 'Неверная роль' }

  // public.users.id — внешний ключ на auth.users(id) без DEFAULT: строку сотрудника
  // физически нельзя создать раньше учётной записи. Поэтому не insert, а приглашение:
  // Supabase заводит auth-пользователя и шлёт письмо со ссылкой, триггер
  // on_auth_user_created создаёт строку в public.users (id, email, full_name).
  const admin = getSupabaseAdmin()
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
  })

  if (inviteError) {
    const already = /already been registered|already exists/i.test(inviteError.message)
    return { error: already ? 'Пользователь с таким email уже зарегистрирован' : inviteError.message }
  }
  if (!invited?.user) return { error: 'Supabase не вернул созданного пользователя' }

  const newUserId = invited.user.id

  // Триггер проставляет только id/email/full_name — роль, телефон и организацию
  // дописываем сами. upsert, а не update: если триггер по какой-то причине не
  // отработал, строка всё равно появится.
  const { error: profileError } = await admin.from('users').upsert(
    { id: newUserId, email, full_name, role, phone, organization_id: orgId, is_active: true },
    { onConflict: 'id' }
  )
  if (profileError) return { error: `Приглашение отправлено, но профиль не заполнен: ${profileError.message}` }

  // Ключевое: RLS определяет организацию через get_user_org_id(), а она читает
  // organization_members. Без этой строки сотрудник войдёт и не увидит ничего.
  const { error: memberError } = await admin.from('organization_members').upsert(
    { organization_id: orgId, user_id: newUserId, role, is_active: true },
    { onConflict: 'organization_id,user_id' }
  )
  if (memberError) return { error: `Приглашение отправлено, но доступ к организации не выдан: ${memberError.message}` }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'create', entityType: 'employee',
    entityId: newUserId, entityLabel: full_name,
  })

  revalidatePath('/employees')
  return { success: true, message: `Приглашение отправлено на ${email}` }
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
