'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCheck } from 'lucide-react'

/**
 * «Проверил — всё верно». Продлевает срок годности статьи.
 *
 * Кнопка живёт рядом с текстом, а не в форме редактирования: подтверждать
 * актуальность должен тот, кто только что прочитал инструкцию, и ему не надо
 * ради этого открывать редактор и рисковать случайной правкой.
 */
export function ReviewButton({
  action,
  overdue,
}: {
  action: () => Promise<{ error?: string } | { ok: true } | void>
  overdue: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await action()
          if (res && 'error' in res && res.error) toast.error(res.error)
          else toast.success('Отмечено: инструкция актуальна')
        })
      }}
      className="hp-chip"
    >
      <CheckCheck className="w-3.5 h-3.5 shrink-0" />
      {pending ? 'Отмечаем…' : overdue ? 'Проверил — актуальна' : 'Подтвердить актуальность'}
    </button>
  )
}
