'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, RotateCcw } from 'lucide-react'
import { updateDealStatusAction } from '@/features/deals/actions/deals.actions'
import { confirmDialog, promptDialog } from '@/components/forms/ConfirmDialog'
import {
  STAGE_CANCELLED,
  stagesOf,
  stageIndex,
  stageLabel,
} from '@/features/directions/config/directions'

/**
 * Степпер стадий сделки — горизонтальная полоса, где пройденные стадии
 * подсвечены, текущая залита акцентом. Клик переводит работу на стадию
 * (оптимистично, с откатом при ошибке).
 *
 * Направление обязательно: у каждого из четырёх своя воронка. Раньше степпер
 * рисовал одни и те же шесть стадий всем подряд.
 */
export function DealStageBar({
  dealId,
  status,
  direction,
}: {
  dealId: string
  status: string
  direction: string
}) {
  const [current, setCurrent] = useState(status)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const stages = stagesOf(direction).filter(s => s.value !== STAGE_CANCELLED.value)
  const cancelled = current === STAGE_CANCELLED.value
  const currentIndex = stageIndex(direction, current)
  const firstStage = stages[0]?.value ?? current

  async function move(next: string) {
    if (next === current || isPending) return

    // Отмена — необратимое по смыслу действие, и ей нужна причина
    // (проход 17.09.2026, RA-13: сделка отменялась одним кликом).
    let reason: string | undefined
    if (next === STAGE_CANCELLED.value) {
      const answer = await promptDialog(
        'Сделка уйдёт из воронки и аналитики. Договоры, задачи и операции останутся, вернуть в работу можно будет позже.',
        { title: 'Отменить сделку?', inputLabel: 'Причина отмены', placeholder: 'Собственник передумал, клиент нашёл другой вариант…', confirmLabel: 'Отменить сделку' },
      )
      if (answer === null) return
      reason = answer
    } else if (!cancelled && stageIndex(direction, next) < currentIndex) {
      // Назад — свободно по правилам, но не молча: клик по пилюле выглядит
      // как навигация, а стадия в базе меняется (TS-1).
      const ok = await confirmDialog(
        `Вернуть сделку на стадию «${stageLabel(direction, next)}»? Отметки чек-листов сохранятся.`,
        { title: 'Вернуть на предыдущую стадию', confirmLabel: 'Вернуть', danger: false },
      )
      if (!ok) return
    }

    const prev = current
    setCurrent(next)
    startTransition(async () => {
      const res = await updateDealStatusAction(dealId, next, reason)
      if (res && 'error' in res && res.error) {
        setCurrent(prev)
        toast.error(res.error)
      } else {
        toast.success(`Стадия: ${stageLabel(direction, next)}`)
        // Чек-лист и предусловия рендерит сервер — без обновления карточка
        // показывала прежнюю стадию до перезагрузки (RA-1/RA-4/RA-5).
        router.refresh()
      }
    })
  }

  return (
    <div className="hp-block">
      <div className="hp-block-header flex items-center justify-between">
        <span className="flex items-center gap-2">
          Стадии
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
        </span>
        {cancelled ? (
          <button
            type="button"
            onClick={() => move(firstStage)}
            className="flex items-center gap-1.5 normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Вернуть в работу
          </button>
        ) : (
          <button
            type="button"
            onClick={() => move(STAGE_CANCELLED.value)}
            disabled={isPending}
            className="normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-danger)] transition-colors disabled:opacity-40"
          >
            Отменить сделку
          </button>
        )}
      </div>

      <div className="p-4">
        {cancelled ? (
          <div className="hp-stage cancel" style={{ flex: '1 1 100%' }}>
            {STAGE_CANCELLED.label}
          </div>
        ) : (
          <div className="hp-stages">
            {stages.map((stage, i) => {
              const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : ''
              return (
                <button
                  key={stage.value}
                  type="button"
                  onClick={() => move(stage.value)}
                  disabled={isPending}
                  className={`hp-stage ${state} disabled:opacity-60`}
                  aria-current={i === currentIndex ? 'step' : undefined}
                >
                  {stage.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
