import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  EngagementTermsForm,
  type EngagementTerms,
  type ContractOption,
} from '@/features/management/components/EngagementTermsForm'
import { can, toUserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

/** Отменённый договор основанием быть не может — в отличие от черновика. */
const UNUSABLE_CONTRACT_STATUSES = ['cancelled']

/** Статусы, при которых договор уже является полноценным основанием. */
const SIGNED_STATUSES = ['generated', 'signed', 'completed']

/**
 * Приём объекта в управление.
 *
 * Экрана не было вовсе: раздел «Объекты в управлении» с 03.09.2026 читает
 * `management_engagements`, экшен приёма был написан, а кнопка «Принять
 * объект» вела на создание объекта с типом сделки «Управление» — то есть в
 * раздел ничего не попадало, что бы человек ни делал. Две существующие записи
 * появились миграцией.
 */
export default async function StartEngagementPage({
  searchParams,
}: {
  searchParams: Promise<{ property_id?: string }>
}) {
  const { property_id: preselected } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!can(toUserRole(profile?.role), 'contracts', 'create')) redirect('/management')

  const [{ data: active }, { data: allProperties }, { data: owners }, { data: plans }, { data: contracts }] =
    await Promise.all([
      supabase.from('management_engagements').select('property_id').is('ended_at', null),
      supabase.from('properties').select('id, title, address, owner_id').order('title'),
      supabase.from('contacts').select('id, full_name, company_name')
        .in('role', ['owner', 'both']).order('full_name'),
      supabase.from('service_plans').select('id, title, rate')
        .eq('is_active', true).contains('directions', ['management']).order('sort_order'),
      supabase.from('contracts')
        .select('id, contract_number, start_date, property_id, status, owner_contact_id, plan_id, plan_rate, settlement_scheme, owner_fixed_amount, owner_payout_day')
        .in('contract_type', ['property_management', 'sublease'])
        .order('start_date', { ascending: false, nullsFirst: false }),
    ])

  // Объект с действующим обслуживанием принять нельзя — это был бы второй
  // взаиморасчёт по одной квартире.
  const busy = new Set((active ?? []).map(e => e.property_id).filter((v): v is string => !!v))
  const properties = (allProperties ?? [])
    .filter(p => !busy.has(p.id))
    .map(p => ({
      id: p.id,
      label: p.address ? `${p.title} — ${p.address}` : p.title,
      ownerContactId: p.owner_id,
    }))

  // Черновик допустим: договор часто существует на бумаге раньше, чем в CRM.
  // Но в списке он подписан как черновик, и раздел потом покажет «подпись
  // договора» в недостающем — чтобы это не потерялось.
  const usable = (contracts ?? []).filter(c => !UNUSABLE_CONTRACT_STATUSES.includes(c.status))

  // Условия едут вместе с договором: в нём уже согласованы собственник, тариф,
  // схема расчёта и ставка, и заставлять набирать то же самое ещё раз — прямой
  // путь к расхождению между договором и взаиморасчётом по нему.
  const contractOptions: ContractOption[] = usable.map(c => ({
    id: c.id,
    propertyId: c.property_id,
    label:
      `${c.contract_number || `№${c.id.slice(0, 8)}`}` +
      `${c.start_date ? ` от ${c.start_date}` : ''}` +
      `${SIGNED_STATUSES.includes(c.status) ? '' : ' · черновик'}`,
    terms: {
      ownerContactId: c.owner_contact_id,
      planId: c.plan_id,
      settlementScheme: c.settlement_scheme,
      rate: c.plan_rate,
      ownerFixedAmount: c.owner_fixed_amount,
      ownerPayoutDay: c.owner_payout_day,
      startDate: c.start_date,
    },
  }))

  const terms: EngagementTerms = {
    id: null,
    // Собственника и остальные условия подставляет форма: у договора он точнее,
    // чем у карточки объекта, и приоритет между ними должен быть в одном месте.
    ownerContactId: null,
    planId: null,
    contractId: null,
    settlementScheme: null,
    rate: null,
    ownerFixedAmount: null,
    ownerPayoutDay: null,
    startedAt: new Date().toISOString().slice(0, 10),
    notes: null,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Принять объект в управление"
        subtitle="Объект попадает в раздел «Объекты в управлении» только после приёма"
        backHref="/management"
        backLabel="Объекты в управлении"
      />

      {contractOptions.length === 0 ? (
        <div className="hp-card p-5 space-y-2">
          <p className="text-sm font-semibold text-[var(--hp-ink)]">
            Нет ни одного договора управления
          </p>
          <p className="text-[12.5px] text-[var(--hp-sub)]">
            Управление без договора — работа без основания: от него берутся сроки, обязательства
            и ставка вознаграждения. Оформите договор управления или субаренды по объекту —
            принимать можно и по черновику, подписать успеете позже.
          </p>
          <div className="flex flex-wrap gap-2 shrink-0 pt-1">
            <Link href="/contracts/new" className="hp-btn-primary">Оформить договор</Link>
            <Link href="/management" className="hp-btn-secondary">Назад</Link>
          </div>
        </div>
      ) : (
        <EngagementTermsForm
          terms={terms}
          properties={properties}
          defaultPropertyId={preselected && properties.some(p => p.id === preselected) ? preselected : ''}
          owners={(owners ?? []).map(o => ({ id: o.id, label: o.company_name || o.full_name }))}
          plans={(plans ?? []).map(p => ({
            id: p.id,
            label: p.rate !== null ? `${p.title} — ${p.rate}%` : p.title,
          }))}
          contracts={contractOptions}
          backHref="/management"
        />
      )}
    </div>
  )
}
