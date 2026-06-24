'use client'

import { useActionState } from 'react'
import { createTransactionAction, updateTransactionAction } from '../actions/accounting.actions'
import type { AccountingTransaction, AccountingCategory, Contract, Deal, User } from '@/types/database'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

interface Props {
  transaction?: AccountingTransaction
  categories: AccountingCategory[]
  contracts: Pick<Contract, 'id' | 'contract_number' | 'contract_type'>[]
  deals: Pick<Deal, 'id' | 'deal_type'>[]
  employees: Pick<User, 'id' | 'full_name'>[]
}

type State = { error?: string; fields?: Record<string, string[]> } | null

export function TransactionForm({ transaction, categories, contracts, deals, employees }: Props) {
  const action = transaction
    ? updateTransactionAction.bind(null, transaction.id)
    : createTransactionAction

  const [state, formAction, isPending] = useActionState(action, null)

  const incomeCategories  = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  const defaultType = transaction?.type ?? 'income'

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
          {state.error}
        </div>
      )}

      {/* Type selector */}
      <div
        className="bg-white rounded-[20px] border border-slate-100 p-5"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
      >
        <h2 className="font-bold text-[#111827] text-[15px] mb-4">Тип операции</h2>
        <div className="grid grid-cols-2 gap-3">
          {(['income', 'expense'] as const).map(t => (
            <label
              key={t}
              className="flex items-center gap-3 p-4 rounded-[14px] border-2 cursor-pointer transition-all has-[:checked]:border-current"
              style={{
                borderColor: t === 'income' ? '#22C55E20' : '#EF444420',
                background:  t === 'income' ? '#F0FDF4'   : '#FEF2F2',
              }}
            >
              <input
                type="radio"
                name="type"
                value={t}
                defaultChecked={defaultType === t}
                className="sr-only"
              />
              {t === 'income'
                ? <ArrowDownCircle className="w-5 h-5 text-green-600 shrink-0" />
                : <ArrowUpCircle   className="w-5 h-5 text-red-500 shrink-0" />
              }
              <div>
                <p className={`text-sm font-bold ${t === 'income' ? 'text-green-700' : 'text-red-600'}`}>
                  {t === 'income' ? 'Доход' : 'Расход'}
                </p>
                <p className="text-xs text-[#64748B]">
                  {t === 'income' ? 'Поступление средств' : 'Списание средств'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Main fields */}
      <div
        className="bg-white rounded-[20px] border border-slate-100 p-5"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
      >
        <h2 className="font-bold text-[#111827] text-[15px] mb-4">Основное</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#111827]">Сумма (₽) *</label>
            <input
              type="text"
              name="amount"
              inputMode="decimal"
              placeholder="0.00"
              defaultValue={transaction?.amount}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#111827]">Дата *</label>
            <input
              type="date"
              name="date"
              defaultValue={transaction?.date ?? new Date().toISOString().slice(0, 10)}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#111827]">Статус</label>
            <select
              name="status"
              defaultValue={transaction?.status ?? 'completed'}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
            >
              <option value="completed">Выполнено</option>
              <option value="planned">Запланировано</option>
              <option value="cancelled">Отменено</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#111827]">Способ оплаты</label>
            <select
              name="payment_method"
              defaultValue={transaction?.payment_method ?? ''}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
            >
              <option value="">— не указан —</option>
              <option value="bank">Банк (безнал)</option>
              <option value="cash">Наличные</option>
              <option value="card">Карта</option>
              <option value="other">Другое</option>
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <label className="block text-sm font-semibold text-[#111827]">Описание</label>
          <textarea
            name="description"
            rows={2}
            defaultValue={transaction?.description ?? ''}
            placeholder="Краткое описание операции"
            className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
          />
        </div>
      </div>

      {/* Category */}
      <div
        className="bg-white rounded-[20px] border border-slate-100 p-5"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
      >
        <h2 className="font-bold text-[#111827] text-[15px] mb-4">Категория</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#111827]">Категория дохода</label>
            <select
              name="category_id"
              defaultValue={transaction?.category_id ?? ''}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
              id="cat-income"
            >
              <option value="">— выберите категорию —</option>
              {incomeCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-[#94A3B8]">Для операций типа «Доход»</p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#111827]">Категория расхода</label>
            <select
              name="category_id"
              defaultValue={transaction?.category_id ?? ''}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
              id="cat-expense"
            >
              <option value="">— выберите категорию —</option>
              {expenseCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-[#94A3B8]">Для операций типа «Расход»</p>
          </div>
        </div>
      </div>

      {/* Links */}
      <div
        className="bg-white rounded-[20px] border border-slate-100 p-5"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
      >
        <h2 className="font-bold text-[#111827] text-[15px] mb-4">Привязки</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#111827]">Договор</label>
            <select
              name="contract_id"
              defaultValue={transaction?.contract_id ?? ''}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
            >
              <option value="">— не привязан —</option>
              {contracts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.contract_number ? `№${c.contract_number}` : c.id.slice(0, 8)} ({c.contract_type})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#111827]">Сделка</label>
            <select
              name="deal_id"
              defaultValue={transaction?.deal_id ?? ''}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
            >
              <option value="">— не привязана —</option>
              {deals.map(d => (
                <option key={d.id} value={d.id}>{d.deal_type} — {d.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-sm font-semibold text-[#111827]">Сотрудник (для зарплат)</label>
            <select
              name="employee_id"
              defaultValue={transaction?.employee_id ?? ''}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
            >
              <option value="">— не привязан —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <a
          href="/accounting"
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-[14px] text-sm font-semibold text-[#374151] hover:bg-slate-50 hover:border-slate-300 transition-all"
        >
          Отмена
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #22C55E)',
            boxShadow: '0 4px 16px rgba(22,163,74,0.35)',
          }}
        >
          {isPending ? 'Сохранение...' : (transaction ? 'Сохранить' : 'Создать')}
        </button>
      </div>
    </form>
  )
}
