'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { SETTLEMENT_SCHEMES } from '@/features/plans/config/settlement'
import { updateEngagementTermsAction } from '@/features/management/actions/engagements.actions'

interface Option { id: string; label: string }

export interface EngagementTerms {
  id: string
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
 * Условия расчёта с собственником.
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
  backHref,
}: {
  terms: EngagementTerms
  owners: Option[]
  plans: Option[]
  contracts: Option[]
  backHref: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [scheme, setScheme] = useState(terms.settlementScheme ?? 'percent')

  const inp = 'hp-input'
  const lbl = 'hp-label'

  function submit(formData: FormData) {
    start(async () => {
      const res = await updateEngagementTermsAction(formData)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Условия обслуживания сохранены')
        router.push(backHref)
      }
    })
  }

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="id" value={terms.id} />

      <div className="hp-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={lbl} htmlFor="owner_contact_id">Собственник</label>
            <select id="owner_contact_id" name="owner_contact_id" required
              defaultValue={terms.ownerContactId ?? ''} className={inp}>
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
            <select id="contract_id" name="contract_id" defaultValue={terms.contractId ?? ''} className={inp}>
              <option value="">Не выбран</option>
              {contracts.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
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
          {pending ? 'Сохраняем…' : 'Сохранить условия'}
        </button>
        <Link href={backHref} className="hp-btn-secondary">Отмена</Link>
      </div>
    </form>
  )
}
