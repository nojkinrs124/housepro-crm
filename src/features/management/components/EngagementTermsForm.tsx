'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { SETTLEMENT_SCHEMES } from '@/features/plans/config/settlement'
import { updateEngagementTermsAction, startEngagementAction } from '@/features/management/actions/engagements.actions'

interface Option { id: string; label: string }

/** Договор со ссылкой на объект — чтобы список сужался под выбранный объект. */
export interface ContractOption extends Option { propertyId: string | null }

/** Объект, который можно принять: с подставляемым собственником, если он известен. */
export interface PropertyOption extends Option { ownerContactId: string | null }

export interface EngagementTerms {
  /** Пусто при приёме нового объекта — записи ещё нет. */
  id: string | null
  ownerContactId: string | null
  planId: string | null
  contractId: string | null
  settlementScheme: string | null
  rate: number | null
  ownerFixedAmount: number | null
  ownerPayoutDay: number | null
  startedAt: string
  notes: string | null
}

/**
 * Условия расчёта с собственником — и при приёме объекта, и при правке.
 *
 * Одна форма на два случая намеренно: поля те же, а вторая почти такая же
 * форма разошлась бы с первой при первой же правке — ровно так расходились
 * словари статусов, пока у них не появился единый источник.
 *
 * Клиентский, потому что набор полей зависит от схемы: у процентной это ставка
 * удержания, у фиксированной — сумма выплаты и день, когда обязательство
 * наступает. Показывать всё сразу значит приглашать заполнить лишнее.
 */
export function EngagementTermsForm({
  terms,
  owners,
  plans,
  contracts,
  properties = [],
  defaultPropertyId = '',
  backHref,
}: {
  terms: EngagementTerms
  owners: Option[]
  plans: Option[]
  contracts: ContractOption[]
  /** Только для приёма: из чего выбирать объект. */
  properties?: PropertyOption[]
  /** Объект, подставленный переходом с его карточки. */
  defaultPropertyId?: string
  backHref: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [scheme, setScheme] = useState(terms.settlementScheme ?? 'percent')

  const isNew = terms.id === null
  const [propertyId, setPropertyId] = useState(defaultPropertyId)
  const [ownerId, setOwnerId] = useState(terms.ownerContactId ?? '')

  // Договоры сужаются под выбранный объект: договор управления по чужой
  // квартире экшен всё равно отвергнет, но лучше его и не показывать.
  const visibleContracts = isNew && propertyId
    ? contracts.filter(c => c.propertyId === propertyId)
    : contracts

  function pickProperty(id: string) {
    setPropertyId(id)
    const owner = properties.find(p => p.id === id)?.ownerContactId
    if (owner) setOwnerId(owner)
  }

  const inp = 'hp-input'
  const lbl = 'hp-label'

  function submit(formData: FormData) {
    start(async () => {
      const res = isNew
        ? await startEngagementAction(formData)
        : await updateEngagementTermsAction(formData)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(isNew ? 'Объект принят в управление' : 'Условия обслуживания сохранены')
      router.push(isNew && propertyId ? `/management/${propertyId}` : backHref)
      router.refresh()
    })
  }

  return (
    <form action={submit} className="space-y-4">
      {terms.id && <input type="hidden" name="id" value={terms.id} />}

      <div className="hp-card p-5 space-y-4">
        {isNew && (
          <div className="space-y-1.5">
            <label className={lbl} htmlFor="property_id">Объект</label>
            <select id="property_id" name="property_id" required value={propertyId}
              onChange={e => pickProperty(e.target.value)} className={inp}>
              <option value="">Не выбран</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <p className="text-xs text-[var(--hp-sub)]">
              Показаны объекты, по которым ещё нет действующего обслуживания
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={lbl} htmlFor="owner_contact_id">Собственник</label>
            <select id="owner_contact_id" name="owner_contact_id" required
              value={ownerId} onChange={e => setOwnerId(e.target.value)} className={inp}>
              <option value="">Не выбран</option>
              {owners.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <p className="text-xs text-[var(--hp-sub)]">
              С ним ведётся взаиморасчёт: ему уходят выплаты и месячные отчёты
            </p>
          </div>

          <div className="space-y-1.5">
            <label className={lbl} htmlFor="started_at">Обслуживание с</label>
            <input id="started_at" name="started_at" type="date" required
              defaultValue={terms.startedAt} className={inp} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={lbl} htmlFor="plan_id">Тариф</label>
            <select id="plan_id" name="plan_id" defaultValue={terms.planId ?? ''} className={inp}>
              <option value="">Не выбран</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <p className="text-xs text-[var(--hp-sub)]">
              Из него берётся лимит мелкого ремонта за счёт агентства и состав обязательств
            </p>
          </div>

          <div className="space-y-1.5">
            <label className={lbl} htmlFor="contract_id">Договор управления</label>
            <select id="contract_id" name="contract_id" required={isNew}
              defaultValue={terms.contractId ?? ''} className={inp}>
              <option value="">Не выбран</option>
              {visibleContracts.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            {isNew && (
              <p className="text-xs text-[var(--hp-sub)]">
                {propertyId && visibleContracts.length === 0
                  ? 'По этому объекту нет подписанного договора управления — сначала оформите его в разделе «Договоры»'
                  : 'Управление без подписанного договора — работа без основания: от договора берутся сроки и обязательства'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="hp-card p-5 space-y-4">
        <div className="space-y-1.5">
          <span className={lbl}>Схема расчёта с собственником</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SETTLEMENT_SCHEMES.map(s => (
              <label key={s.value}
                className="flex items-start gap-2 p-2.5 border border-[var(--hp-border)] cursor-pointer text-sm text-[var(--hp-ink)] transition-colors hover:border-[var(--hp-sub)] has-[:checked]:border-[var(--hp-accent)]">
                <input type="radio" name="settlement_scheme" value={s.value}
                  checked={scheme === s.value} onChange={() => setScheme(s.value)}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--hp-accent)]" />
                <span className="min-w-0">
                  {s.label}
                  <span className="block text-xs text-[var(--hp-sub)]">{s.description}</span>
                  <span className="block text-xs text-[var(--hp-warn)] mt-1">
                    Риск простоя: {s.vacancyRiskBearer === 'agency' ? 'на агентстве' : 'на собственнике'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {scheme === 'percent' ? (
          <div className="space-y-1.5 sm:max-w-xs">
            <label className={lbl} htmlFor="rate">Удержание агентства, %</label>
            <input id="rate" name="rate" type="number" step="0.01" min="0" max="100" required
              defaultValue={terms.rate ?? ''} placeholder="10" className={inp} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={lbl} htmlFor="owner_fixed_amount">Выплата собственнику, ₽/мес</label>
              <input id="owner_fixed_amount" name="owner_fixed_amount" type="number" min="0" required
                defaultValue={terms.ownerFixedAmount ?? ''} placeholder="40 000" className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className={lbl} htmlFor="owner_payout_day">День выплаты</label>
              <input id="owner_payout_day" name="owner_payout_day" type="number" min="1" max="28" required
                defaultValue={terms.ownerPayoutDay ?? 5} className={inp} />
              <p className="text-xs text-[var(--hp-sub)]">
                Обязательство наступает в этот день, заплатил арендатор или нет
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="hp-card p-5 space-y-1.5">
        <label className={lbl} htmlFor="notes">Примечание</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={terms.notes ?? ''} className={inp} />
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        <button type="submit" disabled={pending} className="hp-btn-primary">
          {pending
            ? (isNew ? 'Принимаем…' : 'Сохраняем…')
            : (isNew ? 'Принять в управление' : 'Сохранить условия')}
        </button>
        <Link href={backHref} className="hp-btn-secondary">Отмена</Link>
      </div>
    </form>
  )
}
