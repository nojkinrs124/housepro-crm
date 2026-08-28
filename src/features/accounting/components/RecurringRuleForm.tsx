'use client'

import { useActionState } from 'react'
import { createRecurringRuleAction, updateRecurringRuleAction } from '../actions/recurring.actions'
import type { AccountingRecurringRule, AccountingCategory, User } from '@/types/database'

interface Props {
 rule?: AccountingRecurringRule
 categories: AccountingCategory[]
 employees: Pick<User, 'id' | 'full_name'>[]
}

type State = { error?: string; success?: boolean; id?: string } | null

const FREQ_LABELS: Record<string, string> = {
 daily: 'Ежедневно', weekly: 'Еженедельно', monthly: 'Ежемесячно', yearly: 'Ежегодно',
}

export function RecurringRuleForm({ rule, categories, employees }: Props) {
 const action = rule
 ? updateRecurringRuleAction.bind(null, rule.id)
 : createRecurringRuleAction

 const [state, formAction, isPending] = useActionState(action, null)

 const incomeCategories = categories.filter(c => c.type === 'income')
 const expenseCategories = categories.filter(c => c.type === 'expense')

 return (
 <form action={formAction} className="space-y-6">
 {state && 'error' in state && state.error && (
 <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
 {state.error}
 </div>
 )}

 <div
 className="bg-white border border-slate-100 p-5"
 style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
 >
 <h2 className="font-bold text-foreground text-[15px] mb-4">Правило повторения</h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-1.5 sm:col-span-2">
 <label className="block text-sm font-semibold text-foreground">Название *</label>
 <input
 type="text"
 name="name"
 defaultValue={rule?.name ?? ''}
 placeholder="Аренда офиса, Зарплата Иванова..."
 className="w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
 />
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Тип *</label>
 <select
 name="type"
 defaultValue={rule?.type ?? 'expense'}
 className="w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
 >
 <option value="income">Доход</option>
 <option value="expense">Расход</option>
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Сумма (₽) *</label>
 <input
 type="text"
 name="amount"
 inputMode="decimal"
 defaultValue={rule?.amount ?? ''}
 placeholder="0.00"
 className="w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
 />
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Частота *</label>
 <select
 name="frequency"
 defaultValue={rule?.frequency ?? 'monthly'}
 className="w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
 >
 {Object.entries(FREQ_LABELS).map(([k, v]) => (
 <option key={k} value={k}>{v}</option>
 ))}
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">День месяца</label>
 <input
 type="number"
 name="day_of_month"
 min={1}
 max={31}
 defaultValue={rule?.day_of_month ?? ''}
 placeholder="1–31 (для ежемесячных)"
 className="w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
 />
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Дата начала *</label>
 <input
 type="date"
 name="start_date"
 defaultValue={rule?.start_date ?? new Date().toISOString().slice(0, 10)}
 className="w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
 />
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Дата окончания</label>
 <input
 type="date"
 name="end_date"
 defaultValue={rule?.end_date ?? ''}
 className="w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
 />
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Категория (доходы)</label>
 <select
 name="category_id"
 defaultValue={rule?.category_id ?? ''}
 className="w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
 >
 <option value="">— не выбрана —</option>
 <optgroup label="Доходы">
 {incomeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
 </optgroup>
 <optgroup label="Расходы">
 {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
 </optgroup>
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="block text-sm font-semibold text-foreground">Сотрудник (зарплаты)</label>
 <select
 name="employee_id"
 defaultValue={rule?.employee_id ?? ''}
 className="w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
 >
 <option value="">— не привязан —</option>
 {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
 </select>
 </div>
 {rule && (
 <div className="space-y-1.5 sm:col-span-2">
 <label className="block text-sm font-semibold text-foreground">Активно</label>
 <select
 name="is_active"
 defaultValue={rule.is_active ? 'true' : 'false'}
 className="w-full h-10 px-4 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
 >
 <option value="true">Активно</option>
 <option value="false">Приостановлено</option>
 </select>
 </div>
 )}
 <div className="space-y-1.5 sm:col-span-2">
 <label className="block text-sm font-semibold text-foreground">Примечание</label>
 <textarea
 name="notes"
 rows={2}
 defaultValue={rule?.notes ?? ''}
 placeholder="Дополнительные сведения"
 className="w-full px-4 py-2.5 border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
 />
 </div>
 </div>
 </div>

 <div className="flex items-center justify-end gap-3">
 <a
 href="/accounting/recurring"
 className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-sm font-semibold text-[#374151] hover:bg-slate-50 transition-all"
 >
 Отмена
 </a>
 <button
 type="submit"
 disabled={isPending}
 className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold hover:-translate-y-0.5 transition-all disabled:opacity-60"
 style={{
 background: 'var(--hp-gradient-primary)',
 boxShadow: '0 4px 16px rgba(22,163,74,0.35)',
 }}
 >
 {isPending ? 'Сохранение...' : (rule ? 'Сохранить' : 'Создать')}
 </button>
 </div>
 </form>
 )
}
