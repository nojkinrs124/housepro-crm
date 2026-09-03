import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HandCoins, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PlanActiveToggle } from '@/features/plans/components/PlanActiveToggle'
import { CHARGE_TYPE_LABELS, getChargeType } from '@/features/plans/config/settlement'
import { DIRECTION_SHORT_LABELS } from '@/features/directions/config/directions'
import { can, toUserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

interface Obligation { code: string; title: string }

function obligationsOf(value: unknown): Obligation[] {
  if (!Array.isArray(value)) return []
  return value.filter((o): o is Obligation =>
    typeof o === 'object' && o !== null && 'title' in o && typeof (o as Obligation).title === 'string')
}

/** Ставка в человеческом виде: процент, сумма или «договорная». */
function rateText(chargeType: string, rate: number | null): string {
  const charge = getChargeType(chargeType)
  if (!charge?.needsRate || rate === null) return 'по договору'
  return charge.rateUnit === '%' ? `${rate}%` : `${rate.toLocaleString('ru-RU')} ₽`
}

/**
 * Справочник тарифов агентства. Не путать с /settings/billing — там подписка
 * на саму CRM, здесь условия работы агентства с собственниками и клиентами.
 */
export default async function PlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const canEdit = can(toUserRole(profile?.role), 'settings', 'update')

  const { data } = await supabase
    .from('service_plans')
    .select('id, code, title, charge_type, rate, repair_limit, obligations, directions, is_active, sort_order')
    .order('sort_order')
    .order('title')

  const plans = data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Тарифы агентства"
        subtitle={`${plans.length} тарифов · условия работы с собственниками и клиентами`}
        actions={canEdit ? (
          <Link href="/settings/plans/new" className="hp-btn-primary">
            <Plus style={{ width: 16, height: 16 }} />
            Новый тариф
          </Link>
        ) : undefined}
      />

      {plans.length === 0 ? (
        <div className="hp-card hp-empty">
          <div className="w-12 h-12 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] flex items-center justify-center mx-auto mb-3">
            <HandCoins style={{ width: 20, height: 20 }} className="text-[var(--hp-tertiary)]" />
          </div>
          <p className="text-[var(--hp-ink)] font-semibold">Тарифов пока нет</p>
          <p className="text-[var(--hp-sub)] text-sm mt-1">
            Без тарифа не посчитать комиссию и не выбрать схему расчёта с собственником
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map(plan => {
            const obligations = obligationsOf(plan.obligations)
            return (
              <div key={plan.id} className="hp-block">
                <div className="hp-block-header flex items-center justify-between gap-3 flex-wrap">
                  <span className="flex items-center gap-2">
                    {plan.title}
                    <span className={`hp-badge ${plan.is_active ? 'hp-badge-good' : 'hp-badge-neutral'}`}>
                      {plan.is_active ? 'Активен' : 'Скрыт'}
                    </span>
                  </span>
                  {canEdit && (
                    <span className="flex flex-wrap gap-2 shrink-0">
                      <Link href={`/settings/plans/${plan.id}/edit`} className="hp-btn-secondary">Изменить</Link>
                      {plan.directions?.includes('management') && (
                        <Link href={`/settings/plans/${plan.id}/regulations`} className="hp-btn-secondary">
                          Регламент
                        </Link>
                      )}
                      <PlanActiveToggle id={plan.id} isActive={plan.is_active} title={plan.title} />
                    </span>
                  )}
                </div>

                <div className="hp-block-row">
                  <span className="label">Начисление</span>
                  <span className="value">
                    {CHARGE_TYPE_LABELS[plan.charge_type] ?? plan.charge_type} · {rateText(plan.charge_type, plan.rate)}
                  </span>
                </div>

                <div className="hp-block-row">
                  <span className="label">Направления</span>
                  <span className="value">
                    {(plan.directions ?? []).map(d => DIRECTION_SHORT_LABELS[d] ?? d).join(', ') || '—'}
                  </span>
                </div>

                {plan.repair_limit !== null && (
                  <div className="hp-block-row">
                    <span className="label">Мелкий ремонт за счёт агентства</span>
                    <span className="value">до {plan.repair_limit.toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}

                {obligations.length > 0 && (
                  <div className="hp-block-row">
                    <span className="label">Что входит</span>
                    <span className="value">{obligations.map(o => o.title).join(' · ')}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
