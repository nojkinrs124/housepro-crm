'use client'

import { useState, useActionState } from 'react'
import { Plus, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { createPaymentAction } from '../actions/payments.actions'

interface AddPaymentFormProps {
  contractId: string
}

const PAYMENT_TYPES = [
  { value: 'rent',       label: 'Аренда' },
  { value: 'deposit',    label: 'Залог' },
  { value: 'commission', label: 'Комиссия' },
  { value: 'penalty',    label: 'Штраф' },
  { value: 'other',      label: 'Прочее' },
]

type ActionState = { error?: string; success?: boolean } | null

async function createPaymentBound(contractId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  formData.set('contract_id', contractId)
  return createPaymentAction(formData)
}

export function AddPaymentForm({ contractId }: AddPaymentFormProps) {
  const [open, setOpen] = useState(false)

  const boundAction = createPaymentBound.bind(null, contractId)
  const [state, formAction, isPending] = useActionState(boundAction, null)

  // Закрываем после успеха
  if (state?.success && open) {
    setTimeout(() => setOpen(false), 1000)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-accent/50 transition-all"
      >
        <Plus className="w-4 h-4" />
        Добавить платёж
      </button>
    )
  }

  return (
    <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Новый платёж</p>
        <button
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form action={formAction} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Сумма, ₽ *</label>
            <input
              name="amount"
              type="number"
              min="1"
              step="0.01"
              required
              placeholder="50 000"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Тип</label>
            <select
              name="payment_type"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
            >
              {PAYMENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Дата оплаты</label>
            <input
              name="payment_date"
              type="date"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Срок оплаты</label>
            <input
              name="due_date"
              type="date"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Примечание</label>
          <input
            name="notes"
            type="text"
            placeholder="Комментарий..."
            className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          {state?.error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5" />
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle className="w-3.5 h-3.5" />
              Платёж добавлен
            </div>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="ml-auto flex items-center gap-2 px-4 py-2 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 transition-all"
            style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Добавить
          </button>
        </div>
      </form>
    </div>
  )
}
