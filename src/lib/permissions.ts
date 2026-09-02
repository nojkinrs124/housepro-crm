import type { UserRole } from '@/types/database'

type Resource =
  | 'contacts' | 'deals' | 'leads' | 'properties'
  | 'contracts' | 'payments' | 'employees' | 'accounting'
  | 'analytics' | 'settings' | 'tasks' | 'showings' | 'collections' | 'files'

type Action = 'read' | 'create' | 'update' | 'delete' | 'export'

const ROLES: UserRole[] = ['admin', 'manager', 'agent', 'accountant']

/**
 * Сужает `users.role` из базы до UserRole.
 *
 * В схеме это обычный text (NOT NULL DEFAULT 'agent') без CHECK — сгенерированные
 * типы честно отдают string. Неизвестное значение считаем 'agent': это и дефолт
 * колонки, и самая ограниченная роль в PERMISSIONS, так что при испорченных данных
 * пользователь получит меньше прав, а не больше.
 */
export function toUserRole(value: string | null | undefined): UserRole {
  return ROLES.includes(value as UserRole) ? (value as UserRole) : 'agent'
}

const PERMISSIONS: Record<UserRole, Partial<Record<Resource, Action[]>>> = {
  admin: {
    contacts:   ['read', 'create', 'update', 'delete', 'export'],
    deals:      ['read', 'create', 'update', 'delete'],
    contracts:  ['read', 'create', 'update', 'delete'],
    employees:  ['read', 'create', 'update', 'delete'],
    accounting: ['read', 'create', 'update', 'delete', 'export'],
    settings:   ['read', 'update'],
    analytics:  ['read', 'export'],
    leads:      ['read', 'create', 'update', 'delete'],
    properties: ['read', 'create', 'update', 'delete'],
    payments:   ['read', 'create', 'update', 'delete'],
    tasks:      ['read', 'create', 'update', 'delete'],
    showings:   ['read', 'create', 'update', 'delete'],
    collections:['read', 'create', 'update', 'delete'],
    files:      ['read', 'create', 'update', 'delete'],
  },
  manager: {
    contacts:   ['read', 'create', 'update'],
    deals:      ['read', 'create', 'update'],
    contracts:  ['read', 'create', 'update'],
    employees:  ['read'],
    accounting: ['read'],
    analytics:  ['read'],
    leads:      ['read', 'create', 'update'],
    properties: ['read', 'create', 'update', 'delete'],
    payments:   ['read', 'create', 'update', 'delete'],
    settings:   ['read'],
    tasks:      ['read', 'create', 'update', 'delete'],
    showings:   ['read', 'create', 'update', 'delete'],
    collections:['read', 'create', 'update', 'delete'],
    files:      ['read', 'create', 'update', 'delete'],
  },
  agent: {
    contacts:   ['read', 'create', 'update'],
    deals:      ['read', 'create', 'update'],
    leads:      ['read', 'create', 'update'],
    properties: ['read'],
    contracts:  ['read'],
    tasks:      ['read', 'create', 'update'],
    showings:   ['read', 'create', 'update'],
    collections:['read', 'create', 'update'],
    files:      ['read', 'create'],
  },
  accountant: {
    accounting: ['read', 'create', 'update', 'export'],
    deals:      ['read'],
    contracts:  ['read'],
    payments:   ['read', 'create', 'update'],
    analytics:  ['read'],
    files:      ['read'],
  },
}

export function can(role: UserRole, resource: Resource, action: Action): boolean {
  return PERMISSIONS[role]?.[resource]?.includes(action) ?? false
}

/**
 * Server-side guard: проверяет роль пользователя из DB.
 * Возвращает { error } если нет доступа.
 */
export async function requirePermission(
  userId: string,
  resource: Resource,
  action: Action
): Promise<{ error: string } | null> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (!profile?.role) return { error: 'Пользователь не найден' }

  if (!can(profile.role as UserRole, resource, action)) {
    return { error: 'Недостаточно прав для этого действия' }
  }

  return null
}
