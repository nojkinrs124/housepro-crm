'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  updateRequestStatusAction,
  addRequestExpenseAction,
} from '@/features/requests/actions/requests.actions'
import {
  REQUEST_CATEGORY_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_BADGE,
  REQUEST_TRANSITIONS,
} from '@/features/portal/config/request-categories'

export interface RequestRow {
  id: string
  category: string
  description: string
  status: string
  rejectReason: string | null
  createdAt: string
  propertyTitle: string | null
  contactName: string | null
  hasExpense: boolean
}

const EXPENSE_CATEGORIES = [
  { code: 'contractor',   label: 'Услуги подрядчиков' },
  { code: 'repair_minor', label: 'Мелкий ремонт' },
  { code: 'cleaning',     label: 'Клининг' },
]

/**
 * Заявка арендатора в CRM: ведение по статусам и расход по факту.
 *
 * Кнопки показывают только допустимые переходы: из выполненной и отклонённой
 * возврата нет, и предлагать его значит приглашать сломать историю, которую
 * видит арендатор.
 */
export function RequestCard({ request }: { request: RequestRow }) {
  const [pending, start] = useTransition()
  const [rejecting, setRejecting] = useState(false)
  const [expensing, setExpensing] = useState(false)

  const next = REQUEST_TRANSITIONS[request.status] ?? []

  function move(formData: FormData) {
    start(async () => {
      const res = await updateRequestStatusAction(formData)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Статус изменён')
        setRejecting(false)
      }
    })
  }

  function expense(formData: FormData) {
    start(async () => {
      const res = await addRequestExpenseAction(formData)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Расход заведён')
        setExpensing(false)
      }
    })
  }

  return (
    <div className="hp-block">
      <div className="hp-block-header flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-2">
          {REQUEST_CATEGORY_LABELS[request.category] ?? request.category}
          <span className={`hp-badge ${REQUEST_STATUS_BADGE[request.status] ?? 'hp-badge-neutral'}`}>
            {REQUEST_STATUS_LABELS[request.status] ?? request.status}
          </span>
        </span>
        <span className="tracking-normal text-[11px] font-normal text-[var(--hp-sub)]">
          {request.createdAt.slice(0, 10)}
        </span>
      </div>

      <div className="hp-block-row">
        <span className="label">Объект</span>
        <span className="value">{request.propertyTitle ?? '—'}</span>
      </div>
      <div className="hp-block-row">
        <span className="label">От кого</span>
        <span className="value">{request.contactName ?? '—'}</span>
      </div>
      <div className="hp-block-row">
        <span className="label">Что случилось</span>
        <span className="value">{request.description}</span>
      </div>
      {request.rejectReason && (
        <div className="hp-block-row">
          <span className="label">Причина отказа</span>
          <span className="value danger">{request.rejectReason}</span>
        </div>
      )}

      <div className="p-[18px] space-y-3">
        <div className="flex flex-wrap gap-2 shrink-0">
          {next.filter(s => s !== 'rejected').map(status => (
            <form key={status} action={move}>
              <input type="hidden" name="id" value={request.id} />
              <input type="hidden" name="status" value={status} />
              <button type="submit" disabled={pending} className="hp-btn-secondary">
                {REQUEST_STATUS_LABELS[status]}
              </button>
            </form>
          ))}

          {next.includes('rejected') && !rejecting && (
            <button type="button" onClick={() => setRejecting(true)} className="hp-btn-secondary">
              Отклонить
            </button>
          )}

          {request.status === 'done' && !request.hasExpense && !expensing && (
            <button type="button" onClick={() => setExpensing(true)} className="hp-btn-secondary">
              Завести расход
            </button>
          )}
        </div>

        {rejecting && (
          <form action={move} className="space-y-2">
            <input type="hidden" name="id" value={request.id} />
            <input type="hidden" name="status" value="rejected" />
            <input
              name="reject_reason" required placeholder="Почему отказываем — арендатор это увидит"
              className="hp-input"
            />
            <div className="flex flex-wrap gap-2 shrink-0">
              <button type="submit" disabled={pending} className="hp-btn-primary">Отклонить</button>
              <button type="button" onClick={() => setRejecting(false)} className="hp-btn-secondary">Отмена</button>
            </div>
          </form>
        )}

        {expensing && (
          <form action={expense} className="space-y-2">
            <input type="hidden" name="id" value={request.id} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="hp-label">Категория</label>
                <select name="category_code" className="hp-input">
                  {EXPENSE_CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="hp-label">Сумма, ₽</label>
                <input name="amount" type="number" min="0" step="0.01" required className="hp-input" />
              </div>
              <div className="space-y-1.5">
                <label className="hp-label">За чей счёт</label>
                <select name="borne_by" className="hp-input">
                  <option value="agency">Агентства</option>
                  <option value="owner">Собственника</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-[var(--hp-sub)]">
              Расход попадёт в отчёт собственнику и во взаиморасчёт по объекту
            </p>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button type="submit" disabled={pending} className="hp-btn-primary">Завести расход</button>
              <button type="button" onClick={() => setExpensing(false)} className="hp-btn-secondary">Отмена</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
