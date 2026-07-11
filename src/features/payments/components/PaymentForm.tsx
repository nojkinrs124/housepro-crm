'use client'

import React, { useTransition, useState } from 'react'
import Link from 'next/link'
import { createPaymentAction } from '@/features/payments/actions/payments.actions'

type Contract = {
  id: string
  contract_number: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client_contact: any
}

type FormState = { error?: string; fields?: Record<string, string[]> }

export function PaymentForm({
  contracts,
  defaultContractId,
}: {
  contracts: Contract[]
  defaultContractId?: string
}) {
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<FormState>({})

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        const result = await createPaymentAction(formData)
        // if redirect() fired, we never get here
        // if we do get here, it's a validation/db error
        if (result && 'error' in result) {
          setState({ error: result.error, fields: result.fields as Record<string, string[]> | undefined })
        }
      } catch (err: unknown) {
        // NEXT_REDIRECT is thrown as an error — let it propagate (Next.js handles it)
        const e = err as { digest?: string }
        if (e?.digest?.startsWith('NEXT_REDIRECT')) throw err
        setState({ error: 'Неизвестная ошибка' })
      }
    })
  }

  const typeLabels = [
    { value: 'rent',       label: 'Аренда' },
    { value: 'deposit',    label: 'Депозит' },
    { value: 'commission', label: 'Комиссия' },
    { value: 'penalty',    label: 'Штраф' },
    { value: 'other',      label: 'Прочее' },
  ]

  const fieldErr = (name: string) => state.fields?.[name]?.[0]

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200/60 rounded-[20px] p-6 space-y-5 shadow-sm">
      {state.error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {state.error}
        </div>
      )}

      {/* Contract */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Договор</label>
        <select
          name="contract_id"
          defaultValue={defaultContractId ?? ''}
          className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
        >
          <option value="">Без договора</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.contract_number}{c.client_contact?.full_name ? ` — ${c.client_contact.full_name}` : ''}
            </option>
          ))}
        </select>
        {fieldErr('contract_id') && <p className="text-xs text-red-500">{fieldErr('contract_id')}</p>}
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Сумма *</label>
        <div className="relative">
          <input
            name="amount"
            type="number"
            min="1"
            step="0.01"
            required
            placeholder="25 000"
            className={`w-full h-10 px-3 pr-8 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-green-100 focus:border-green-400 transition-all ${
              fieldErr('amount') ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
            }`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₽</span>
        </div>
        {fieldErr('amount') && <p className="text-xs text-red-500">{fieldErr('amount')}</p>}
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Тип платежа</label>
        <select
          name="payment_type"
          defaultValue="rent"
          className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
        >
          {typeLabels.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Due date */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Срок оплаты</label>
        <input
          name="due_date"
          type="date"
          className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Примечание</label>
        <textarea
          name="notes"
          rows={2}
          placeholder="Дополнительная информация..."
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all resize-none"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Link
          href="/payments"
          className="flex-1 h-10 flex items-center justify-center border border-slate-200 text-[#374151] rounded-xl text-sm font-medium hover:bg-slate-50 transition-all"
        >
          Отмена
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 h-10 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}
        >
          {pending ? 'Сохранение...' : 'Создать платёж'}
        </button>
      </div>
    </form>
  )
}
