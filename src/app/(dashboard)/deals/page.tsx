import { DealsViewSwitcher } from '@/features/deals/components/DealsViewSwitcher'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatStrip } from '@/components/layout/StatStrip'
import { buttonVariants } from '@/components/ui/button'
import { formatAmount, formatDateCompact } from '@/lib/utils'

export default async function DealsPage() {
  const supabase = await createClient()

  const { data: rawDeals } = await supabase
    .from('deals')
    .select(`
      *,
      client:clients(full_name, phone),
      property:properties(title, address),
      owner_contact:contacts!deals_owner_contact_id_fkey(full_name, company_name, phone),
      client_contact:contacts!deals_client_contact_id_fkey(full_name, company_name, phone)
    `)
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = (rawDeals ?? []) as any[]

  const active    = deals.filter(d => !['completed', 'cancelled'].includes(d.status))
  const completed = deals.filter(d => d.status === 'completed')

  const pipeline = active.reduce((sum, d) => sum + Number(d.amount ?? 0), 0)
  const earned   = completed.reduce((sum, d) => sum + Number(d.commission ?? 0), 0)

  // Ближайшее плановое закрытие среди активных сделок — что «горит» в этом месяце.
  const upcoming = active
    .filter(d => d.expected_close_date)
    .sort((a, b) => a.expected_close_date.localeCompare(b.expected_close_date))[0]

  const closingThisMonth = active.filter(d => {
    if (!d.expected_close_date) return false
    const date = new Date(d.expected_close_date)
    const now = new Date()
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }).length

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: 'Раздел' }, { label: 'Сделки' }]}
        title="Сделки"
        subtitle={`${active.length} активных из ${deals.length}`}
        actions={
          <Link href="/deals/new" className={buttonVariants({ size: 'lg' })}>
            <Plus style={{ width: 16, height: 16 }} />
            Новая сделка
          </Link>
        }
      />

      {deals.length > 0 && (
        <StatStrip
          items={[
            {
              label: 'В работе',
              value: active.length,
              hint: closingThisMonth > 0 ? `${closingThisMonth} закрываются в этом месяце` : 'без плановых закрытий',
            },
            {
              label: 'Сумма в воронке',
              value: <>{formatAmount(pipeline)} <span className="text-[var(--hp-tertiary)]">₽</span></>,
              small: true,
              hint: 'по активным сделкам',
            },
            {
              label: 'Завершено',
              value: completed.length,
              hint: earned > 0 ? `комиссия ${formatAmount(earned)} ₽` : 'комиссия не указана',
            },
            {
              label: 'Ближайшее закрытие',
              value: upcoming ? formatDateCompact(upcoming.expected_close_date) : '—',
              small: true,
              hint: upcoming
                ? (upcoming.property?.address ?? upcoming.property?.title ?? `СД-${upcoming.deal_number ?? ''}`)
                : 'даты не проставлены',
            },
          ]}
        />
      )}

      <DealsViewSwitcher deals={deals} />
    </div>
  )
}
