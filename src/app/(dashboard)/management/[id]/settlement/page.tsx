import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatStrip } from '@/components/layout/StatStrip'
import { SettlementPanel } from '@/features/management/components/SettlementPanel'
import { calcSettlement, isVacantOn } from '@/features/management/services/settlement.service'
import { loadSettlementOperations } from '@/features/management/data/settlement.data'
import { formatAmount } from '@/lib/utils'
import { can, toUserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

const CATEGORY_LABELS: Record<string, string> = {
  tenant_payment: 'Поступление от арендатора',
  agency_fee: 'Удержание агентства',
  owner_payout: 'Выплата собственнику',
  repair_minor: 'Мелкий ремонт',
  cleaning: 'Клининг',
  utilities: 'Коммунальные платежи',
  contractor: 'Услуги подрядчиков',
}

/**
 * Взаиморасчёт с собственником: сальдо, результат агентства и операции.
 *
 * Здесь же видно то, чего не покажет отчёт собственнику: при фиксированной
 * схеме — заработало агентство на объекте или потеряло.
 */
export default async function SettlementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const canEdit = can(toUserRole(profile?.role), 'accounting', 'create')

  const [{ data: engagement }, { data: property }] = await Promise.all([
    supabase.from('management_engagements')
      .select('id, settlement_scheme, rate, owner_fixed_amount, owner_payout_day, repair_limit, started_at, ended_at, owner:contacts(full_name, company_name)')
      .eq('property_id', id).is('ended_at', null).maybeSingle(),
    supabase.from('properties').select('title, address').eq('id', id).maybeSingle(),
  ])

  if (!engagement || !property) notFound()

  const operations = await loadSettlementOperations(supabase, engagement.id)
  const terms = {
    scheme: engagement.settlement_scheme as 'percent' | 'fixed' | null,
    rate: engagement.rate,
    ownerFixedAmount: engagement.owner_fixed_amount,
    ownerPayoutDay: engagement.owner_payout_day,
    startedAt: engagement.started_at,
    endedAt: engagement.ended_at,
  }
  const settlement = calcSettlement(terms, operations)

  const owner = Array.isArray(engagement.owner) ? engagement.owner[0] : engagement.owner
  const ownerName = owner ? (owner.company_name || owner.full_name) : null

  // Простой вычисляется, а не проставляется руками: это отсутствие
  // действующего договора найма, а не состояние договора с собственником.
  const { data: rentContracts } = await supabase
    .from('contracts')
    .select('start_date, end_date, status')
    .eq('property_id', id)
    .in('contract_type', ['rent_apartment', 'rent_commercial'])

  const vacant = isVacantOn(rentContracts ?? [], new Date().toISOString().slice(0, 10))

  const { data: txns } = await supabase
    .from('accounting_transactions')
    .select('id, type, amount, status, date, description, borne_by, category:accounting_categories(name, code)')
    .eq('engagement_id', engagement.id)
    .order('date', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Взаиморасчёт с собственником"
        subtitle={`${property.title}${ownerName ? ` · ${ownerName}` : ''}`}
        backHref={`/management/${id}`}
        backLabel="Объект"
      />

      {settlement.error ? (
        <div className="hp-card p-5 space-y-3">
          <p className="text-sm text-[var(--hp-warn)]">{settlement.error}</p>
          <Link href={`/management/${id}/terms`} className="hp-btn-primary">Заполнить условия</Link>
        </div>
      ) : (
        <StatStrip
          items={[
            {
              label: settlement.balance < 0 ? 'Долг собственника' : 'К выплате собственнику',
              value: `${formatAmount(Math.abs(settlement.balance))} ₽`,
              alert: settlement.balance < 0,
            },
            { label: 'Поступило от арендатора', value: `${formatAmount(settlement.tenantPayments)} ₽` },
            {
              label: settlement.agencyResult < 0 ? 'Убыток агентства' : 'Заработано агентством',
              value: `${formatAmount(Math.abs(settlement.agencyResult))} ₽`,
              alert: settlement.agencyResult < 0,
            },
            terms.scheme === 'fixed'
              ? { label: 'Начислено обязательств', value: `${formatAmount(settlement.ownerObligation)} ₽ · ${settlement.obligationMonths} мес.` }
              : { label: 'Удержано агентством', value: `${formatAmount(settlement.agencyFee)} ₽` },
          ]}
        />
      )}

      {vacant && (
        <p className={`hp-card p-3 text-sm ${terms.scheme === 'fixed' ? 'text-[var(--hp-danger)]' : 'text-[var(--hp-warn)]'}`}>
          Объект простаивает — действующего договора найма нет.
          {terms.scheme === 'fixed'
            ? ' При фиксированной выплате обязательство перед собственником продолжает начисляться: каждый пустой месяц агентство платит из своих средств.'
            : ' При процентной схеме за простой не начисляется ничего — ни собственнику, ни агентству.'}
        </p>
      )}

      {terms.scheme === 'fixed' && settlement.agencyResult < 0 && (
        <p className="hp-card p-3 text-sm text-[var(--hp-danger)]">
          По этому объекту агентство в минусе на {formatAmount(Math.abs(settlement.agencyResult))} ₽.
          При фиксированной выплате обязательство перед собственником наступает каждый месяц
          независимо от того, сдан объект или стоит пустым.
        </p>
      )}

      <div className="hp-block">
        <div className="hp-block-header">Операции взаиморасчёта</div>
        {canEdit && (
          <SettlementPanel
            engagementId={engagement.id}
            scheme={engagement.settlement_scheme}
            balance={settlement.balance}
            repairLimit={engagement.repair_limit}
          />
        )}
      </div>

      <div className="hp-block">
        <div className="hp-block-header">История</div>
        {(txns ?? []).length === 0 ? (
          <div className="p-[18px] text-sm text-[var(--hp-sub)]">Операций по объекту ещё нет.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--hp-sub)]">
                  <th className="px-[18px] py-2 font-medium">Дата</th>
                  <th className="px-[18px] py-2 font-medium">Операция</th>
                  <th className="px-[18px] py-2 font-medium">За чей счёт</th>
                  <th className="px-[18px] py-2 font-medium">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {(txns ?? []).map(t => {
                  const category = Array.isArray(t.category) ? t.category[0] : t.category
                  const label = (category?.code && CATEGORY_LABELS[category.code]) || category?.name || t.description || 'Операция'
                  return (
                    <tr key={t.id} className="border-t border-[var(--hp-border-soft)]">
                      <td className="px-[18px] py-2 whitespace-nowrap">{t.date}</td>
                      <td className="px-[18px] py-2">
                        {label}
                        {t.description && t.description !== label && (
                          <span className="text-[var(--hp-sub)]"> · {t.description}</span>
                        )}
                        {t.status !== 'completed' && (
                          <span className="ml-2 hp-badge hp-badge-neutral">запланировано</span>
                        )}
                      </td>
                      <td className="px-[18px] py-2 text-[var(--hp-sub)]">
                        {t.borne_by === 'owner' ? 'собственника' : t.borne_by === 'agency' ? 'агентства' : '—'}
                      </td>
                      <td className={`px-[18px] py-2 whitespace-nowrap ${t.type === 'expense' ? 'text-[var(--hp-danger)]' : ''}`}>
                        {t.type === 'expense' ? '− ' : ''}{formatAmount(Number(t.amount))} ₽
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
