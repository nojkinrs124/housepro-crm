import type { UserRole } from '@/types/database'

type Resource =
  | 'contacts' | 'deals' | 'leads' | 'properties'
  | 'contracts' | 'payments' | 'employees' | 'accounting'
  | 'analytics' | 'settings'

type Action = 'read' | 'create' | 'update' | 'delete' | 'export'

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
  },
  manager: {
    contacts:   ['read', 'create', 'update'],
    deals:      ['read', 'create', 'update'],
    contracts:  ['read', 'create', 'update'],
    employees:  ['read'],
    accounting: ['read'],
    analytics:  ['read'],
    leads:      ['read', 'create', 'update'],
    properties: ['read', 'create', 'update'],
    payments:   ['read', 'create', 'update', 'delete'],
    settings:   ['read'],
  },
  agent: {
    contacts:   ['read', 'create', 'update'],
    deals:      ['read', 'create', 'update'],
    leads:      ['read', 'create', 'update'],
    properties: ['read'],
    contracts:  ['read'],
  },
  accountant: {
    accounting: ['read', 'create', 'update', 'export'],
    deals:      ['read'],
    contracts:  ['read'],
    payments:   ['read', 'create', 'update'],
    analytics:  ['read'],
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
