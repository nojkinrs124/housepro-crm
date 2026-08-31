import { createClient } from '@/lib/supabase/server'
import { Users, Plus } from 'lucide-react'
import Link from 'next/link'
import type { Contact } from '@/types/database'
import { ContactsViewSwitcher } from '@/features/contacts/components/ContactsViewSwitcher'
import type { ContactMeta } from '@/features/contacts/components/ContactsRegistry'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatStrip } from '@/components/layout/StatStrip'
import { buttonVariants } from '@/components/ui/button'
import { formatAmount } from '@/lib/utils'

const DAY = 86400000

export default async function ContactsPage() {
  const supabase = await createClient()

  const [{ data: contacts }, { data: rawDeals }] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, full_name, company_name, client_type, phone, email, role, status, source, created_at, updated_at')
      .order('created_at', { ascending: false }),
    // Объект и риелтор в реестре берутся из последней сделки контакта: у самой
    // таблицы contacts такой связи нет (properties.owner_id смотрит в legacy-owners).
    supabase
      .from('deals')
      .select(`
        owner_contact_id, client_contact_id, status, amount, created_at,
        property:properties(id, title, address),
        manager:users(full_name)
      `)
      .order('created_at', { ascending: false }),
  ])

  const list = (contacts ?? []) as Contact[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = (rawDeals ?? []) as any[]

  const meta: Record<string, ContactMeta> = {}
  const dealCountByContact: Record<string, number> = {}
  const turnoverByContact: Record<string, number> = {}

  for (const deal of deals) {
    const property = deal.property as { id?: string; title?: string; address?: string } | null
    const manager  = deal.manager  as { full_name?: string } | null

    for (const contactId of [deal.owner_contact_id, deal.client_contact_id]) {
      if (!contactId) continue
      // Сделки отсортированы по убыванию даты — первая встреченная и есть последняя.
      if (!meta[contactId]) {
        meta[contactId] = {
          objectLabel: property?.address || property?.title || undefined,
          objectHref:  property?.id ? `/properties/${property.id}` : undefined,
          managerName: manager?.full_name || undefined,
        }
      }
      if (!['completed', 'cancelled'].includes(deal.status)) {
        dealCountByContact[contactId] = (dealCountByContact[contactId] ?? 0) + 1
      }
      turnoverByContact[contactId] = (turnoverByContact[contactId] ?? 0) + Number(deal.amount ?? 0)
    }
  }

  const total    = list.length
  const active   = list.filter(c => c.status === 'active').length
  const vip      = list.filter(c => c.status === 'vip')
  const now      = Date.now()
  const addedWeek = list.filter(c => now - new Date(c.created_at).getTime() < 7 * DAY).length
  const stale     = list.filter(c => {
    if (c.status === 'inactive') return false
    return now - new Date(c.updated_at ?? c.created_at).getTime() > 30 * DAY
  }).length

  const activeInDeals = list
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + (dealCountByContact[c.id] ?? 0), 0)
  const vipTurnover = vip.reduce((sum, c) => sum + (turnoverByContact[c.id] ?? 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: 'Раздел' }, { label: 'Контакты' }]}
        title="Контакты"
        subtitle={`${total} ${total === 1 ? 'контакт' : 'контактов'} в базе`}
        actions={
          <Link href="/contacts/new" className={buttonVariants({ size: 'lg' })}>
            <Plus style={{ width: 16, height: 16 }} />
            Добавить контакт
          </Link>
        }
      />

      {total > 0 && (
        <StatStrip
          items={[
            {
              label: 'Всего в базе',
              value: total,
              hint: addedWeek > 0 ? `+${addedWeek} за неделю` : 'без пополнений за неделю',
            },
            {
              label: 'Активные',
              value: active,
              hint: activeInDeals > 0 ? `в ${activeInDeals} сделках` : 'без активных сделок',
            },
            {
              label: 'VIP',
              value: vip.length,
              hint: vipTurnover > 0 ? `оборот ${formatAmount(vipTurnover)} ₽` : 'оборота пока нет',
            },
            {
              label: 'Без касания 30 дн.',
              value: stale,
              hint: stale > 0 ? 'назначить звонки' : 'все на связи',
              alert: stale > 0,
            },
          ]}
        />
      )}

      {total === 0 ? (
        <div className="hp-card hp-empty">
          <div className="w-16 h-16 rounded-[var(--hp-radius)] flex items-center justify-center mx-auto mb-4 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
            <Users style={{ width: 28, height: 28, color: 'var(--hp-sub)' }} />
          </div>
          <p className="text-[var(--hp-ink)] font-bold text-lg">Контактов ещё нет</p>
          <p className="text-[var(--hp-sub)] text-sm mt-1">Добавьте первый контакт в базу</p>
          <Link href="/contacts/new" className="hp-btn-primary mt-5">
            <Plus style={{ width: 16, height: 16 }} />
            Добавить контакт
          </Link>
        </div>
      ) : (
        <ContactsViewSwitcher contacts={list} meta={meta} />
      )}
    </div>
  )
}
