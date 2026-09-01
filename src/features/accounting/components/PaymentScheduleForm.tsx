'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, CalendarRange, ChevronDown, ChevronUp } from 'lucide-react'
import { generatePaymentScheduleAction } from '../actions/payment-schedule.actions'
import {
 buildPaymentSchedule,
 scheduleTotal,
 PERIODICITY_LABELS,
 type SchedulePeriodicity,
} from '../services/payment-schedule.service'

type State = { error?: string; success?: boolean; message?: string } | undefined

interface PaymentScheduleFormProps {
 contractId: string
 startDate: string | null
 endDate: string | null
 amount: number | null
 deposit: number | null
 indexationPercent: number | null
 indexationPeriodMonths: number | null
 /** Сколько начислений уже сгенерировано по договору — от этого зависит текст кнопки. */
 existingCount: number
}

function fmtMoney(n: number) {
 return `${n.toLocaleString('ru-RU')} ₽`
}

function fmtDate(iso: string) {
 return new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', {
 day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
 })
}

/**
 * Форма разворачивания договора в график платежей с живым предпросмотром.
 *
 * Предпросмотр считает тот же buildPaymentSchedule, что и Server Action —
 * функция чистая и не тянет ни БД, ни серверных модулей, поэтому клиент и сервер
 * гарантированно показывают одно и то же (а не «на экране 12 строк, в базе 13»).
 */
export function PaymentScheduleForm({
 contractId,
 startDate,
 endDate,
 amount,
 deposit,
 indexationPercent,
 indexationPeriodMonths,
 existingCount,
}: PaymentScheduleFormProps) {
 const [open, setOpen] = useState(false)
 const [periodicity, setPeriodicity] = useState<SchedulePeriodicity>('monthly')
 const [form, setForm] = useState({
 start_date: startDate ?? '',
 end_date: endDate ?? '',
 amount: amount ? String(amount) : '',
 day_of_month: '',
 include_deposit: Boolean(deposit && deposit > 0),
 deposit_amount: deposit ? String(deposit) : '',
 prorate: false,
 indexation_percent: indexationPercent ? String(indexationPercent) : '',
 indexation_period_months: indexationPeriodMonths ? String(indexationPeriodMonths) : '',
 })

 const bound = generatePaymentScheduleAction.bind(null, contractId)
 const wrapped = async (_prev: State, formData: FormData): Promise<State> =>
 (await bound(_prev, formData)) as State
 const [state, formAction, isPending] = useActionState(wrapped, undefined)

 useEffect(() => {
 if (state?.success) {
 toast.success(state.message ?? 'График создан')
 setOpen(false)
 }
 }, [state])

 const preview = useMemo(() => {
 const parsed = Number(form.amount.replace(/\s/g, '').replace(',', '.'))
 if (!form.start_date || !Number.isFinite(parsed) || parsed <= 0) return []
 const day = Number(form.day_of_month)
 return buildPaymentSchedule({
 startDate: form.start_date,
 endDate: form.end_date || null,
 amount: parsed,
 periodicity,
 dayOfMonth: Number.isFinite(day) && day >= 1 && day <= 31 ? day : null,
 depositAmount: form.include_deposit
 ? Number(form.deposit_amount.replace(/\s/g, '').replace(',', '.')) || null
 : null,
 prorateLastPeriod: form.prorate,
 indexationPercent: Number(form.indexation_percent) || null,
 indexationPeriodMonths: Number(form.indexation_period_months) || null,
 })
 }, [form, periodicity])

 if (!open) {
 return (
 <button
 type="button"
 onClick={() => setOpen(true)}
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors whitespace-nowrap"
 >
 <CalendarRange className="w-4 h-4" />
 {existingCount > 0 ? 'Пересоздать график платежей' : 'Сформировать график платежей'}
 </button>
 )
 }

 return (
 <form action={formAction} className="hp-card p-5 space-y-4">
 <div className="flex items-center justify-between gap-3">
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">График платежей по договору</h2>
 <button
 type="button"
 onClick={() => setOpen(false)}
 className="text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
 aria-label="Свернуть"
 >
 <ChevronUp className="w-4 h-4" />
 </button>
 </div>

 {state?.error && (
 <div className="flex items-start gap-2 border border-[var(--hp-border)] bg-[var(--hp-danger-tint)] px-4 py-3 text-sm text-[var(--hp-danger)]">
 <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
 {state.error}
 </div>
 )}

 <fieldset disabled={isPending} className="contents">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="sch-periodicity">Периодичность</label>
 <select
 id="sch-periodicity"
 name="periodicity"
 value={periodicity}
 onChange={(e) => setPeriodicity(e.target.value as SchedulePeriodicity)}
 className="w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer transition-colors"
 >
 {(Object.keys(PERIODICITY_LABELS) as SchedulePeriodicity[]).map((key) => (
 <option key={key} value={key}>{PERIODICITY_LABELS[key]}</option>
 ))}
 </select>
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="sch-amount">Сумма платежа, ₽</label>
 <input
 id="sch-amount"
 name="amount"
 inputMode="decimal"
 value={form.amount}
 onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
 placeholder="50 000"
 className="hp-input"
 />
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="sch-start">Начало</label>
 <input
 id="sch-start"
 type="date"
 name="start_date"
 value={form.start_date}
 onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
 className="w-full min-w-0 h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors"
 />
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="sch-end">Окончание</label>
 <input
 id="sch-end"
 type="date"
 name="end_date"
 value={form.end_date}
 onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
 className="w-full min-w-0 h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors"
 />
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="sch-day">День платежа</label>
 <input
 id="sch-day"
 name="day_of_month"
 inputMode="numeric"
 value={form.day_of_month}
 onChange={(e) => setForm((f) => ({ ...f, day_of_month: e.target.value }))}
 placeholder="как в дате начала"
 className="hp-input"
 />
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="sch-indexation">Индексация, % в год</label>
 <input
 id="sch-indexation"
 name="indexation_percent"
 inputMode="decimal"
 value={form.indexation_percent}
 onChange={(e) => setForm((f) => ({ ...f, indexation_percent: e.target.value }))}
 placeholder="без индексации"
 className="hp-input"
 />
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="sch-indexation-period">Индексировать раз в, мес.</label>
 <input
 id="sch-indexation-period"
 name="indexation_period_months"
 inputMode="numeric"
 value={form.indexation_period_months}
 onChange={(e) => setForm((f) => ({ ...f, indexation_period_months: e.target.value }))}
 placeholder="12"
 className="hp-input"
 />
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="sch-deposit">Депозит, ₽</label>
 <input
 id="sch-deposit"
 name="deposit_amount"
 inputMode="decimal"
 value={form.deposit_amount}
 onChange={(e) => setForm((f) => ({ ...f, deposit_amount: e.target.value }))}
 disabled={!form.include_deposit}
 placeholder="—"
 className="hp-input disabled:opacity-50"
 />
 </div>
 </div>

 <div className="flex flex-col gap-2">
 <label className="flex items-center gap-2 text-sm text-[var(--hp-ink)]">
 <input
 type="checkbox"
 name="include_deposit"
 checked={form.include_deposit}
 onChange={(e) => setForm((f) => ({ ...f, include_deposit: e.target.checked }))}
 />
 Включить депозит отдельной строкой
 </label>
 <label className="flex items-center gap-2 text-sm text-[var(--hp-ink)]">
 <input
 type="checkbox"
 name="prorate"
 checked={form.prorate}
 onChange={(e) => setForm((f) => ({ ...f, prorate: e.target.checked }))}
 />
 Пересчитать неполный последний период пропорционально дням
 </label>
 {existingCount > 0 && (
 <label className="flex items-center gap-2 text-sm text-[var(--hp-danger)]">
 <input type="checkbox" name="replace" />
 Пересоздать график — {existingCount} начислений уже есть (оплаченные останутся)
 </label>
 )}
 </div>

 <SchedulePreview items={preview} />

 <div className="flex items-center gap-3 flex-wrap pt-1">
 <button
 type="submit"
 disabled={preview.length === 0}
 className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-50"
 >
 {isPending ? 'Создаём…' : `Создать ${preview.length} начислений`}
 </button>
 <button
 type="button"
 onClick={() => setOpen(false)}
 className="px-5 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-semibold text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 Отмена
 </button>
 </div>
 </fieldset>
 </form>
 )
}

function SchedulePreview({ items }: { items: ReturnType<typeof buildPaymentSchedule> }) {
 const [expanded, setExpanded] = useState(false)

 if (items.length === 0) {
 return (
 <p className="text-sm text-[var(--hp-sub)]">
 Заполните дату начала и сумму — здесь появится предпросмотр графика.
 </p>
 )
 }

 const visible = expanded ? items : items.slice(0, 4)

 return (
 <div className="hp-block">
 <div className="hp-block-header">
 Предпросмотр — {items.length} начислений на {fmtMoney(scheduleTotal(items))}
 </div>
 {visible.map((item) => (
 <div key={item.seq} className="hp-block-row">
 <span className="label">
 {fmtDate(item.dueDate)}
 {item.kind === 'deposit' && ' · депозит'}
 </span>
 <span className="value">{fmtMoney(item.amount)}</span>
 </div>
 ))}
 {items.length > 4 && (
 <button
 type="button"
 onClick={() => setExpanded((v) => !v)}
 className="flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
 >
 {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
 {expanded ? 'Свернуть' : `Показать ещё ${items.length - 4}`}
 </button>
 )}
 </div>
 )
}
