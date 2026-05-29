'use client'

import { useState, useTransition } from 'react'
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

export function AddPaymentForm({ contractId }: AddPaymentFormProps) {
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('contract_id', contractId)
    setFeedback(null)

    startTransition(async () => {
      const result = await createPaymentAction(fd)
      if (result.error) {
        setFeedback({ type: 'error', msg: result.error })
      } else {
        setFeedback({ type: 'success', msg: 'Платёж добавлен' })
        ;(e.target as HTMLFormElement).reset()
        setTimeout(() => { setOpen(false); setFeedback(null) }, 1200)
      }
    })
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
        <button onClick={() => { setOpen(false); setFeedback(null) }}
          className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
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
              className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Тип</label>
            <select
              name="payment_type"
              className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
              className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Срок оплаты</label>
            <input
              name="due_date"
              type="date"
              className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Примечание</label>
          <input
            name="notes"
            type="text"
            placeholder="Комментарий..."
            className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          {feedback && (
            <div className={`flex items-center gap-1.5 text-xs ${feedback.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
              {feedback.type === 'success'
                ? <CheckCircle className="w-3.5 h-3.5" />
                : <AlertCircle className="w-3.5 h-3.5" />
              }
              {feedback.msg}
            </div>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-all"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Добавить
          </button>
        </div>
      </form>
    </div>
  )
}
