'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { submitTenantReadingAction } from '@/features/portal/actions/readings.actions'

/**
 * Внесение показания арендатором.
 *
 * Дата не спрашивается: показание считается снятым сегодня. Просить жильца
 * выбрать дату значит приглашать ошибиться, а спорные случаи всё равно
 * разбирает менеджер.
 */
export function TenantReadingForm({
  meterId,
  unit,
  lastValue,
}: {
  meterId: string
  unit: string
  lastValue: number | null
}) {
  const [pending, start] = useTransition()

  function submit(formData: FormData) {
    start(async () => {
      const res = await submitTenantReadingAction(formData)
      if (res.error) toast.error(res.error)
      else toast.success(res.message ?? 'Показание принято')
    })
  }

  return (
    <form action={submit} className="p-[18px] flex flex-wrap items-end gap-3 border-t border-[var(--hp-border-soft)]">
      <input type="hidden" name="meter_id" value={meterId} />
      <div className="space-y-1.5 flex-1 min-w-[160px]">
        <label className="hp-label">Новое показание{unit ? `, ${unit}` : ''}</label>
        <input
          name="value" type="number" step="0.001" min="0" required
          placeholder={lastValue !== null ? `больше ${lastValue}` : '0'}
          className="hp-input"
        />
      </div>
      <button type="submit" disabled={pending} className="hp-btn-primary shrink-0">
        {pending ? 'Отправляем…' : 'Передать'}
      </button>
    </form>
  )
}
