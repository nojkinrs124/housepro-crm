'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DIRECTIONS, stagesOf } from '@/features/directions/config/directions'
import { getChargeType } from '@/features/plans/config/settlement'

const radioCls =
  'flex items-center gap-2 p-2.5 rounded-[var(--hp-radius)] border border-[var(--hp-border)] cursor-pointer text-sm text-[var(--hp-ink)] transition-colors hover:border-[var(--hp-sub)] has-[:checked]:border-[var(--hp-accent)] has-[:checked]:bg-[var(--hp-accent-tint)]'

/** Тариф из справочника — то, что нужно для выбора в форме. */
export interface DealPlanOption {
  id: string
  title: string
  chargeType: string
  rate: number | null
  directions: string[]
}

/**
 * Выбор направления работы, тарифа и, при правке, стадии.
 *
 * Клиентский, потому что список стадий и тарифов зависит от выбранного
 * направления: у каждого из четырёх своя воронка, и показывать «Регистрацию
 * перехода права» в аренде — то же самое, что показывать «Заселение» в продаже.
 *
 * Тариф живёт здесь, а не в отдельном блоке: стадии «Подготовка» (аренда) и
 * «Договор управления» требуют выбранного тарифа (`plan_selected`), а до
 * прохода 17.09.2026 его негде было выбрать — `deals.plan_id` не писала ни
 * одна форма. Если у направления один активный тариф, он подставляется сам.
 */
export function DirectionStagePicker({
  direction,
  status,
  planId,
  plans = [],
  showStatus = false,
}: {
  direction?: string | null
  status?: string | null
  planId?: string | null
  plans?: DealPlanOption[]
  showStatus?: boolean
}) {
  const [selected, setSelected] = useState(direction ?? 'rent_agent')
  const stages = stagesOf(selected)
  const directionPlans = plans.filter(p => p.directions.includes(selected))
  // Один тариф на направление — выбираем его без вопросов; при правке — тот, что уже в сделке.
  const defaultPlanId = planId && directionPlans.some(p => p.id === planId)
    ? planId
    : directionPlans.length === 1 ? directionPlans[0].id : ''

  return (
    <>
      <div className="hp-card p-5 space-y-4">
        <h2 className="hp-h2">Направление работы</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DIRECTIONS.map(d => (
            <label key={d.value} className={radioCls}>
              <input
                type="radio" name="deal_type" value={d.value} data-testid={`deal-direction-${d.value}`}
                checked={selected === d.value}
                onChange={() => setSelected(d.value)}
                className="w-4 h-4 shrink-0 accent-[var(--hp-accent)]"
              />
              <span className="min-w-0">
                {d.label}
                <span className="block text-xs text-[var(--hp-sub)]">{d.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="hp-label" htmlFor="deal-plan">Тариф</label>
          {directionPlans.length > 0 ? (
            <select
              id="deal-plan" key={selected} name="plan_id" defaultValue={defaultPlanId}
              data-testid="deal-plan" className="hp-input cursor-pointer"
            >
              <option value="">Не выбран</option>
              {directionPlans.map(p => {
                const charge = getChargeType(p.chargeType)
                const rate = p.rate !== null && charge?.rateUnit ? ` — ${p.rate}${charge.rateUnit}` : ''
                return <option key={p.id} value={p.id}>{p.title}{rate}</option>
              })}
            </select>
          ) : (
            <p className="text-sm text-[var(--hp-sub)]">
              Для этого направления нет активных тарифов —{' '}
              <Link href="/settings/plans/new" className="underline">создайте тариф</Link>,
              иначе вознаграждение не посчитается.
            </p>
          )}
          <p className="text-xs text-[var(--hp-sub)]">
            По тарифу считается вознаграждение агентства; без него сделка не пройдёт стадию договора
          </p>
        </div>
      </div>

      {showStatus && (
        <div className="hp-card p-5 space-y-4">
          <h2 className="hp-h2">Стадия</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {stages.map(s => (
              <label key={s.value} className={radioCls}>
                <input
                  type="radio" name="status" value={s.value}
                  defaultChecked={status === s.value}
                  className="w-4 h-4 shrink-0 accent-[var(--hp-accent)]"
                />
                {s.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-[var(--hp-sub)]">
            Смена направления меняет и список стадий: воронки у направлений разные
          </p>
        </div>
      )}
    </>
  )
}
