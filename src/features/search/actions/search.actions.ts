'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimitSearch } from '@/lib/rate-limit'
import { CONTRACT_TYPE_LABELS } from '@/features/contracts/config/contract-types'

export interface SearchResult {
  id: string
  title: string
  subtitle?: string
  href: string
  type: 'contact' | 'property' | 'contract' | 'task'
}

export interface SearchResults {
  contacts: SearchResult[]
  properties: SearchResult[]
  contracts: SearchResult[]
  tasks: SearchResult[]
}

export async function searchAction(query: string): Promise<SearchResults> {
  const empty = { contacts: [], properties: [], contracts: [], tasks: [] }
  if (!query || query.trim().length < 2) return empty

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const rl = await rateLimitSearch(user.id)
    if (!rl.success) return empty
  }
  const q = query.trim()

  const [contactsRes, propertiesRes, contractsRes, tasksRes] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, full_name, phone, role, status')
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(5),

    supabase
      .from('properties')
      .select('id, title, address, property_type, status')
      .or(`title.ilike.%${q}%,address.ilike.%${q}%`)
      .limit(5),

    supabase
      .from('contracts')
      .select('id, contract_number, contract_type, status')
      .ilike('contract_number', `%${q}%`)
      .limit(5),

    supabase
      .from('tasks')
      .select('id, title, status, priority')
      .ilike('title', `%${q}%`)
      .limit(5),
  ])

  const statusLabels: Record<string, string> = {
    new: 'Новый', in_progress: 'В работе', active: 'Активный',
    closed: 'Закрыт', vip: 'VIP', blacklist: 'Чёрный список',
    available: 'Свободен', reserved: 'Забронирован', rented: 'Сдан',
    sold: 'Продан', inactive: 'Неактивен',
    draft: 'Черновик', generated: 'Сформирован', signed: 'Подписан',
    completed: 'Завершён', cancelled: 'Отменён',
    todo: 'К выполнению', done: 'Готово',
  }

  const roleLabels: Record<string, string> = {
    client: 'Клиент', owner: 'Собственник', both: 'Клиент/Собственник',
  }

  const typeLabels: Record<string, string> = {
    apartment: 'Квартира', house: 'Дом', commercial: 'Коммерция',
    office: 'Офис', warehouse: 'Склад', land: 'Участок',
    ...CONTRACT_TYPE_LABELS,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contacts: SearchResult[] = (contactsRes.data ?? []).map((c: any) => ({
    id: c.id,
    type: 'contact',
    title: c.full_name,
    subtitle: [c.phone, roleLabels[c.role], statusLabels[c.status]].filter(Boolean).join(' · '),
    href: `/contacts/${c.id}`,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: SearchResult[] = (propertiesRes.data ?? []).map((p: any) => ({
    id: p.id,
    type: 'property',
    title: p.title,
    subtitle: [typeLabels[p.property_type], p.address, statusLabels[p.status]].filter(Boolean).join(' · '),
    href: `/properties/${p.id}`,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contracts: SearchResult[] = (contractsRes.data ?? []).map((c: any) => ({
    id: c.id,
    type: 'contract',
    title: c.contract_number ?? `Договор #${c.id.slice(0, 8)}`,
    subtitle: [typeLabels[c.contract_type], statusLabels[c.status]].filter(Boolean).join(' · '),
    href: `/contracts/${c.id}`,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks: SearchResult[] = (tasksRes.data ?? []).map((t: any) => ({
    id: t.id,
    type: 'task',
    title: t.title,
    subtitle: statusLabels[t.status],
    href: `/tasks`,
  }))

  return { contacts, properties, contracts, tasks }
}
