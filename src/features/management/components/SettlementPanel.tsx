'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowDownLeft, ArrowUpRight, Wrench } from 'lucide-react'
import {
  registerTenantPaymentAction,
  payOwnerAction,
  addExpenseAction,
} from '@/features/management/actions/settlement.actions'

type Form = 'payment' | 'payout' | 'expense' | null

const EXPENSE_CATEGORIES = [
  { code: 'repair_minor', label: 'Мелкий ремонт' },
  { code: 'cleaning',     label: 'Клининг' },
  { code: 'utilities',    label: 'Коммунальные платежи' },
  { code: 'contractor',   label: 'Услуги подрядчиков' },
]

/**
 * Операции взаиморасчёта: поступление от арендатора, выплата собственнику,
 * расход по объекту.
 *
 * Три отдельные формы, а не одна универсальная «операция»: у каждой свои
 * правила, и именно они защищают от ошибок — удержание агентства при
 * процентной схеме считается само, выплата сверх сальдо требует пометки
 * «аванс», а расход на ремонт сверх лимита тарифа не проводится молча.
 */
export function SettlementPanel({
  engagementId,
  scheme,
  balance,
  repairLimit,
}: {
  engagementId: string
  scheme: string | null
  balance: number
  repairLimit: number | null
}) {
  const [open, setOpen] = useState<Form>(null)
  const [pending, start] = useTransition()
  const [advance, setAdvance] = useState(false)
  const [borneBy, setBorneBy] = useState<'agency' | 'owner'>('agency')
  const today = new Date().toISOString().slice(0, 10)

  if (!scheme) {
    return (
      <div className="p-[18px] text-sm text-[var(--hp-sub)]">
        Схема расчёта не выбрана — операции взаиморасчёта заводить не по чему.
        Сначала заполните условия обслуживания.
      </div>
    )
  }

  function run(action: (fd: FormData) => Promise<{ error?: string; success?: boolean }>, okText: string) {
    return (formData: FormData) => start(async () => {
      const res = await action(formData)
      if (res.error) toast.error(res.error)
      else {
        toast.success(okText)
        setOpen(null)
        setAdvance(false)
      }
    })
  }

  const inp = 'hp-input'
  const lbl = 'hp-label'

  return (
    <div className="p-[18px] space-y-4">
      <div className="flex flex-wrap gap-2 shrink-0">
        <button type="button" onClick={() => setOpen(open === 'payment' ? null : 'payment')} className="hp-btn-secondary">
          <ArrowDownLeft style={{ width: 16, height: 16 }} />
          Поступление от арендатора
        </button>
        <button type="button" onClick={() => setOpen(open === 'payout' ? null : 'payout')} className="hp-btn-secondary">
          <ArrowUpRight style={{ width: 16, height: 16 }} />
          Выплата собственнику
        </button>
        <button type="button" onClick={() => setOpen(open === 'expense' ? null : 'expense')} className="hp-btn-secondary">
          <Wrench style={{ width: 16, height: 16 }} />
          Расход по объекту
        </button>
      </div>

      {open === 'payment' && (
        <form action={run(registerTenantPaymentAction, 'Поступление проведено')} className="space-y-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className={lbl}>Сумма, ₽</label>
              <input name="amount" type="number" min="0" step="0.01" required className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>Дата</label>
              <input name="date" type="date" max={today} defaultValue={today} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>Период с</label>
              <input name="period_start" type="date" className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>по</label>
              <input name="period_end" type="date" className={inp} />
            </div>
          </div>
          {scheme === 'percent' && (
            <p className="text-xs text-[var(--hp-sub)]">
              Удержание агентства проведётся отдельной операцией автоматически — по ставке из условий
            </p>
          )}
          <button type="submit" disabled={pending} className="hp-btn-primary">
            {pending ? 'Проводим…' : 'Провести поступление'}
          </button>
        </form>
      )}

      {open === 'payout' && (
        <form action={run(payOwnerAction, 'Выплата проведена')} className="space-y-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className={lbl}>Сумма, ₽</label>
              <input name="amount" type="number" min="0" step="0.01" required
                placeholder={balance > 0 ? String(balance) : '0'} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>Дата</label>
              <input name="date" type="date" max={today} defaultValue={today} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>Период с</label>
              <input name="period_start" type="date" className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>по</label>
              <input name="period_end" type="date" className={inp} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--hp-ink)]">
            <input type="checkbox" name="as_advance" checked={advance}
              onChange={e => setAdvance(e.target.checked)} className="w-4 h-4 accent-[var(--hp-accent)]" />
            Это аванс — выплата больше текущего сальдо
          </label>
          <p className="text-xs text-[var(--hp-sub)]">
            Сальдо сейчас: {balance.toLocaleString('ru-RU')} ₽. Больше этой суммы без пометки
            «аванс» провести нельзя — иначе след денег теряется
          </p>
          <button type="submit" disabled={pending} className="hp-btn-primary">
            {pending ? 'Проводим…' : 'Провести выплату'}
          </button>
        </form>
      )}

      {open === 'expense' && (
        <form action={run(addExpenseAction, 'Расход проведён')} className="space-y-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className={lbl}>Категория</label>
              <select name="category_code" className={inp}>
                {EXPENSE_CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>Сумма, ₽</label>
              <input name="amount" type="number" min="0" step="0.01" required className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>Дата</label>
              <input name="date" type="date" max={today} defaultValue={today} className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className={lbl}>За чей счёт</label>
              <select name="borne_by" value={borneBy}
                onChange={e => setBorneBy(e.target.value as 'agency' | 'owner')} className={inp}>
                <option value="agency">Агентства</option>
                <option value="owner">Собственника</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={lbl}>Описание</label>
            <input name="description" required placeholder="Замена смесителя в ванной" className={inp} />
          </div>
          {borneBy === 'agency' && repairLimit != null && (
            <p className="text-xs text-[var(--hp-sub)]">
              Лимит мелкого ремонта за счёт агентства — {repairLimit.toLocaleString('ru-RU')} ₽ в месяц.
              Превышение придётся либо убрать, либо отнести на собственника
            </p>
          )}
          <button type="submit" disabled={pending} className="hp-btn-primary">
            {pending ? 'Проводим…' : 'Провести расход'}
          </button>
        </form>
      )}
    </div>
  )
}
