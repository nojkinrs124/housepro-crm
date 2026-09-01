'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Target } from 'lucide-react'
import { saveEmployeeTargetAction } from '../actions/targets.actions'

interface TargetPanelProps {
 userId: string
 /** Период в виде YYYY-MM — текущий месяц. */
 period: string
 target: {
 deals_target: number | null
 revenue_target: number | null
 commission_target: number | null
 note: string | null
 } | null
 fact: {
 deals: number
 revenue: number
 commission: number
 }
 /** План правит только руководитель; сотруднику показываем без формы. */
 canEdit: boolean
}

function fmt(value: number): string {
 return value.toLocaleString('ru-RU')
}

/** Полоска выполнения плана. Круглая намеренно — это прогресс, а не карточка. */
function Progress({ fact, plan }: { fact: number; plan: number | null }) {
 if (!plan || plan <= 0) return null
 const percent = Math.min(Math.round((fact / plan) * 100), 100)
 const reached = fact >= plan

 return (
 <div className="mt-1.5">
 <div className="h-1.5 w-full rounded-full bg-[var(--hp-neutral-tint)] overflow-hidden">
 <div
 className="h-full rounded-full transition-all"
 style={{
 width: `${percent}%`,
 background: reached ? 'var(--hp-good)' : 'var(--hp-accent)',
 }}
 />
 </div>
 <p className="text-[11px] text-[var(--hp-sub)] mt-1">
 {percent}% от плана {fmt(plan)}
 </p>
 </div>
 )
}

/**
 * План и факт по сотруднику за месяц.
 *
 * Раньше на карточке был только факт: цифры есть, а понять «много это или мало»
 * нельзя. План хранится помесячно, поэтому сравнение всегда идёт с той целью,
 * которая стояла в этом месяце.
 */
export function EmployeeTargetPanel({ userId, period, target, fact, canEdit }: TargetPanelProps) {
 const [open, setOpen] = useState(false)
 const [isPending, startTransition] = useTransition()

 function submit(formData: FormData) {
 startTransition(async () => {
 const res = await saveEmployeeTargetAction(userId, formData)
 if (res.error) {
 toast.error(res.error)
 return
 }
 toast.success('План сохранён')
 setOpen(false)
 })
 }

 const rows = [
 { label: 'Сделок закрыто', fact: fact.deals, plan: target?.deals_target ?? null, suffix: '' },
 { label: 'Выручка', fact: fact.revenue, plan: target?.revenue_target ?? null, suffix: ' ₽' },
 { label: 'Комиссия', fact: fact.commission, plan: target?.commission_target ?? null, suffix: ' ₽' },
 ]

 return (
 <div className="hp-card p-5 space-y-4">
 <div className="flex items-center justify-between gap-3 flex-wrap">
 <div className="flex items-center gap-2">
 <Target className="w-4 h-4 text-[var(--hp-sub)]" />
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">План и факт за месяц</h2>
 </div>
 {canEdit && !open && (
 <button
 type="button"
 onClick={() => setOpen(true)}
 className="text-sm font-medium text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
 >
 {target ? 'Изменить план' : 'Поставить план'}
 </button>
 )}
 </div>

 {!target && !open && (
 <p className="text-sm text-[var(--hp-sub)]">
 План на этот месяц не задан — сравнивать факт не с чем.
 </p>
 )}

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 {rows.map((row) => (
 <div key={row.label} className="min-w-0">
 <p className="text-2xl font-bold text-[var(--hp-ink)]">
 {fmt(row.fact)}
 <span className="text-sm font-medium text-[var(--hp-sub)]">{row.suffix}</span>
 </p>
 <p className="text-xs text-[var(--hp-sub)] font-medium mt-0.5 leading-tight break-words">
 {row.label}
 </p>
 <Progress fact={row.fact} plan={row.plan} />
 </div>
 ))}
 </div>

 {target?.note && <p className="text-sm text-[var(--hp-sub)]">{target.note}</p>}

 {open && (
 <form action={submit} className="border-t border-[var(--hp-border-soft)] pt-4 space-y-4">
 <input type="hidden" name="period_month" value={period} />

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="t-deals">Сделок за месяц</label>
 <input
 id="t-deals"
 name="deals_target"
 inputMode="numeric"
 defaultValue={target?.deals_target ?? ''}
 placeholder="5"
 className="hp-input"
 />
 </div>
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="t-revenue">Выручка, ₽</label>
 <input
 id="t-revenue"
 name="revenue_target"
 inputMode="decimal"
 defaultValue={target?.revenue_target ?? ''}
 placeholder="1 500 000"
 className="hp-input"
 />
 </div>
 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="t-commission">Комиссия, ₽</label>
 <input
 id="t-commission"
 name="commission_target"
 inputMode="decimal"
 defaultValue={target?.commission_target ?? ''}
 placeholder="150 000"
 className="hp-input"
 />
 </div>
 </div>

 <div className="space-y-1.5">
 <label className="hp-label" htmlFor="t-note">Комментарий</label>
 <input
 id="t-note"
 name="note"
 defaultValue={target?.note ?? ''}
 placeholder="Например: упор на коммерческую аренду"
 className="hp-input"
 />
 </div>

 <div className="flex items-center gap-3 flex-wrap">
 <button
 type="submit"
 disabled={isPending}
 className="px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 {isPending ? 'Сохраняем…' : 'Сохранить план'}
 </button>
 <button
 type="button"
 onClick={() => setOpen(false)}
 className="px-5 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-semibold text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
 >
 Отмена
 </button>
 </div>
 </form>
 )}
 </div>
 )
}
