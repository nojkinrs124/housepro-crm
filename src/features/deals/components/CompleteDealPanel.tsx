'use client'

import { useActionState, useMemo, useState } from 'react'
import { AlertCircle, FileText, CalendarRange, CheckSquare, Home } from 'lucide-react'
import {
  buildPaymentSchedule,
  scheduleTotal,
  PERIODICITY_LABELS,
  type SchedulePeriodicity,
} from '@/features/accounting/services/payment-schedule.service'
import { needsSchedule, type DealCompletionPlan } from '../services/deal-completion'
import { completeDealAction, type CompleteDealResult } from '../actions/complete-deal.actions'

const input = 'hp-input'
const label = 'hp-label'

function fmtMoney(n: number) {
  return `${n.toLocaleString('ru-RU')} ₽`
}

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  })
}

/**
 * Мастер оформления сделки: один экран вместо цепочки из пяти.
 *
 * Предпросмотр графика считает тот же buildPaymentSchedule, что и Server
 * Action, — на экране и в базе гарантированно одно и то же.
 */
export function CompleteDealPanel({
  dealId,
  plan,
  contractTypeLabel,
  propertyTitle,
  propertyStatusLabel,
  clientName,
}: {
  dealId: string
  plan: DealCompletionPlan
  contractTypeLabel: string
  propertyTitle: string | null
  propertyStatusLabel: string | null
  clientName: string | null
}) {
  const [form, setForm] = useState({
    contract_number: plan.contractNumber,
    start_date: plan.startDate,
    end_date: plan.endDate ?? '',
    amount: plan.amount ? String(plan.amount) : '',
    deposit: plan.deposit ? String(plan.deposit) : '',
    periodicity: plan.periodicity,
    with_schedule: plan.withSchedule,
    with_deposit: false,
    with_task: true,
    with_property_status: plan.propertyStatus !== null,
    task_title: plan.taskTitle,
    task_deadline: plan.taskDeadline,
  })

  const bound = completeDealAction.bind(null, dealId)
  const [state, formAction, isPending] = useActionState<CompleteDealResult, FormData>(
    async (prev, formData) => bound(prev, formData),
    {}
  )

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const scheduleAvailable = needsSchedule(plan.contractType)

  const preview = useMemo(() => {
    if (!form.with_schedule || !scheduleAvailable) return []
    const amount = Number(form.amount.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0 || !form.start_date) return []
    return buildPaymentSchedule({
      startDate: form.start_date,
      endDate: form.end_date || null,
      amount,
      periodicity: form.periodicity,
      dayOfMonth: null,
      depositAmount: form.with_deposit
        ? Number(form.deposit.replace(/\s/g, '').replace(',', '.')) || null
        : null,
      prorateLastPeriod: false,
      indexationPercent: null,
      indexationPeriodMonths: null,
    })
  }, [form, scheduleAvailable])

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="flex items-start gap-2 border border-[var(--hp-border)] bg-[var(--hp-danger-tint)] px-4 py-3 text-sm text-[var(--hp-danger)]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {state.error}
        </div>
      )}

      {/* Договор — единственный обязательный шаг */}
      <div className="hp-block">
        <div className="hp-block-header flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" />
          Договор — {contractTypeLabel}
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Номер договора</label>
              <input
                name="contract_number"
                value={form.contract_number}
                onChange={e => set('contract_number', e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Сумма, ₽</label>
              <input
                name="amount"
                inputMode="decimal"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="50000"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Начало</label>
              <input
                name="start_date"
                type="date"
                required
                value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Окончание</label>
              <input
                name="end_date"
                type="date"
                value={form.end_date}
                onChange={e => set('end_date', e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Залог, ₽</label>
              <input
                name="deposit"
                inputMode="decimal"
                value={form.deposit}
                onChange={e => set('deposit', e.target.value)}
                placeholder="50000"
                className={input}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--hp-sub)]">
            Стороны и объект берутся из сделки. Дополнительные условия — сожители,
            опись имущества, порядок оплаты — дозаполняются в карточке договора.
          </p>
        </div>
      </div>

      {/* График начислений */}
      {scheduleAvailable && (
        <div className="hp-block">
          <div className="hp-block-header flex items-center gap-2">
            <CalendarRange className="w-3.5 h-3.5" />
            График начислений
          </div>
          <div className="p-5 space-y-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="with_schedule"
                checked={form.with_schedule}
                onChange={e => set('with_schedule', e.target.checked)}
                className="w-4 h-4 accent-[var(--hp-accent)]"
              />
              Развернуть договор в плановые начисления
            </label>

            {form.with_schedule && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={label}>Периодичность</label>
                    <select
                      name="periodicity"
                      value={form.periodicity}
                      onChange={e => set('periodicity', e.target.value as SchedulePeriodicity)}
                      className={input}
                    >
                      {Object.entries(PERIODICITY_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>{text}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer sm:mt-7">
                    <input
                      type="checkbox"
                      name="with_deposit"
                      checked={form.with_deposit}
                      onChange={e => set('with_deposit', e.target.checked)}
                      className="w-4 h-4 accent-[var(--hp-accent)]"
                    />
                    Отдельной строкой залог
                  </label>
                </div>

                {preview.length > 0 ? (
                  <div className="border border-[var(--hp-border-soft)]">
                    <div className="px-4 py-2 text-[12px] text-[var(--hp-sub)] border-b border-[var(--hp-border-soft)]">
                      {preview.length} начислений на {fmtMoney(scheduleTotal(preview))} · первое{' '}
                      {preview[0].dueDate ? fmtDate(preview[0].dueDate) : '—'}
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {preview.slice(0, 6).map(item => (
                        <div key={item.seq} className="flex justify-between px-4 py-1.5 text-[13px]">
                          <span className="text-[var(--hp-sub)] truncate">{item.label}</span>
                          <span className="text-[var(--hp-ink)] font-medium shrink-0">
                            {item.dueDate ? fmtDate(item.dueDate) : '—'} · {fmtMoney(item.amount)}
                          </span>
                        </div>
                      ))}
                      {preview.length > 6 && (
                        <div className="px-4 py-1.5 text-[12px] text-[var(--hp-tertiary)]">
                          и ещё {preview.length - 6}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--hp-warn)]">
                    График пока не построить — нужны сумма и даты договора.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Задача и статус объекта */}
      <div className="hp-block">
        <div className="hp-block-header flex items-center gap-2">
          <CheckSquare className="w-3.5 h-3.5" />
          Что ещё сделать
        </div>
        <div className="p-5 space-y-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="with_task"
              checked={form.with_task}
              onChange={e => set('with_task', e.target.checked)}
              className="w-4 h-4 accent-[var(--hp-accent)]"
            />
            Поставить задачу{clientName ? ` по клиенту ${clientName}` : ''}
          </label>

          {form.with_task && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
              <div>
                <label className={label}>Задача</label>
                <input
                  name="task_title"
                  value={form.task_title}
                  onChange={e => set('task_title', e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Срок</label>
                <input
                  name="task_deadline"
                  type="date"
                  value={form.task_deadline}
                  onChange={e => set('task_deadline', e.target.value)}
                  className={input}
                />
              </div>
            </div>
          )}

          {plan.propertyStatus && propertyStatusLabel && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="with_property_status"
                checked={form.with_property_status}
                onChange={e => set('with_property_status', e.target.checked)}
                className="w-4 h-4 accent-[var(--hp-accent)]"
              />
              <Home className="w-3.5 h-3.5 text-[var(--hp-sub)]" />
              Перевести объект{propertyTitle ? ` «${propertyTitle}»` : ''} в статус «{propertyStatusLabel}»
            </label>
          )}

          <p className="text-xs text-[var(--hp-sub)]">
            Сделка при оформлении переходит на этап «Договор». Назад автоматика
            её не двигает и завершённые сделки не трогает.
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="hp-btn-primary w-full justify-center disabled:opacity-50"
      >
        {isPending ? 'Оформляем…' : 'Оформить сделку'}
      </button>
    </form>
  )
}
