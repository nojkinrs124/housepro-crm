'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { CHARGE_TYPES, getChargeType } from '@/features/plans/config/settlement'
import { DIRECTIONS } from '@/features/directions/config/directions'

type State = { error?: string } | undefined
type Action = (state: State, formData: FormData) => Promise<State>

export interface PlanDefaults {
  id?: string
  code?: string
  title?: string
  charge_type?: string
  rate?: number | null
  repair_limit?: number | null
  obligations?: { code: string; title: string }[]
  directions?: string[]
  is_active?: boolean
  sort_order?: number
}

/**
 * Форма тарифа. Поле ставки появляется и исчезает по способу начисления:
 * у договорной ставки нет, у фиксированной выплаты она задаётся в договоре,
 * а не в справочнике — показывать пустое поле «Ставка» в этих случаях значит
 * приглашать заполнить его ошибочно.
 *
 * Код тарифа при правке заблокирован: на него ссылаются заключённые договоры
 * и направления работы.
 */
export function PlanForm({
  action,
  defaults = {},
  submitLabel,
  backHref,
}: {
  action: Action
  defaults?: PlanDefaults
  submitLabel: string
  backHref: string
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [chargeType, setChargeType] = useState(defaults.charge_type ?? 'deal_percent')

  const charge = getChargeType(chargeType)
  const isEdit = Boolean(defaults.id)
  const selectedDirections = new Set(defaults.directions ?? [])

  return (
    <form action={formAction} className="space-y-4">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      {state?.error && (
        <p className="hp-card p-3 text-sm text-[var(--hp-danger)]">{state.error}</p>
      )}

      <div className="hp-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="title">Название</label>
            <input id="title" name="title" required defaultValue={defaults.title ?? ''}
              placeholder="Управление Премиум" className="hp-input" />
          </div>

          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="code">Код</label>
            <input id="code" name="code" required={!isEdit} readOnly={isEdit}
              defaultValue={defaults.code ?? ''}
              placeholder="management_premium" className="hp-input" />
            <p className="text-xs text-[var(--hp-sub)]">
              {isEdit
                ? 'Код не меняется: на него ссылаются заключённые договоры'
                : 'Латиница, цифры и подчёркивание — по нему на тариф ссылается система'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="charge_type">Способ начисления</label>
            <select id="charge_type" name="charge_type" className="hp-input"
              value={chargeType} onChange={e => setChargeType(e.target.value)}>
              {CHARGE_TYPES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {charge && <p className="text-xs text-[var(--hp-sub)]">{charge.hint}</p>}
          </div>

          {charge?.needsRate && (
            <div className="space-y-1.5">
              <label className="hp-label" htmlFor="rate">
                Ставка{charge.rateUnit ? `, ${charge.rateUnit}` : ''}
              </label>
              <input id="rate" name="rate" type="number" step="0.01" min="0" required
                defaultValue={defaults.rate ?? ''}
                placeholder={charge.rateUnit === '%' ? '10' : '15 000'} className="hp-input" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="repair_limit">Лимит мелкого ремонта, ₽</label>
            <input id="repair_limit" name="repair_limit" type="number" step="1" min="0"
              defaultValue={defaults.repair_limit ?? ''} placeholder="5000" className="hp-input" />
            <p className="text-xs text-[var(--hp-sub)]">
              Сколько агентство чинит за свой счёт. Превышение относится на собственника
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="sort_order">Порядок в списке</label>
            <input id="sort_order" name="sort_order" type="number" step="10"
              defaultValue={defaults.sort_order ?? 0} className="hp-input" />
          </div>
        </div>
      </div>

      <div className="hp-card p-5 space-y-4">
        <div className="space-y-1.5">
          <span className="hp-label">Направления</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DIRECTIONS.map(d => (
              <label key={d.value} className="flex items-start gap-2 text-sm text-[var(--hp-ink)]">
                <input type="checkbox" name="directions" value={d.value}
                  defaultChecked={selectedDirections.has(d.value)} className="mt-0.5" />
                <span>
                  {d.label}
                  <span className="block text-xs text-[var(--hp-sub)]">{d.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="hp-label" htmlFor="obligations">Что входит в тариф</label>
          <textarea id="obligations" name="obligations" rows={8} className="hp-input"
            defaultValue={(defaults.obligations ?? []).map(o => o.title).join('\n')}
            placeholder={'Проверки квартиры\nУборка\nМелкий ремонт до 5000 ₽\nОтчётность собственнику'} />
          <p className="text-xs text-[var(--hp-sub)]">
            По одному пункту в строке. Этот список видно на карточке объекта — по нему сверяют,
            чем «Премиум» отличается от обычного управления
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--hp-ink)]">
          <input type="checkbox" name="is_active" defaultChecked={defaults.is_active ?? true} />
          Тариф активен и предлагается в новых договорах
        </label>
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        <button type="submit" disabled={pending} className="hp-btn-primary">
          {pending ? 'Сохраняем…' : submitLabel}
        </button>
        <Link href={backHref} className="hp-btn-secondary">Отмена</Link>
      </div>
    </form>
  )
}
