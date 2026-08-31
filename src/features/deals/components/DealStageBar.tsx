'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, RotateCcw } from 'lucide-react'
import { updateDealStatusAction } from '@/features/deals/actions/deals.actions'
import { DEAL_STAGES, DEAL_STAGE_CANCELLED, dealStageIndex } from '@/features/deals/config/deal-stages'

/**
 * Степпер этапов сделки — горизонтальная полоса, где пройденные этапы
 * подсвечены светло-зелёным, текущий залит акцентом. Клик по этапу
 * переводит сделку на него (оптимистично, с откатом при ошибке).
 */
export function DealStageBar({ dealId, status }: { dealId: string; status: string }) {
  const [current, setCurrent] = useState(status)
  const [isPending, startTransition] = useTransition()

  const cancelled = current === DEAL_STAGE_CANCELLED.value
  const currentIndex = dealStageIndex(current)

  function move(next: string) {
    if (next === current || isPending) return
    const prev = current
    setCurrent(next)
    startTransition(async () => {
      const res = await updateDealStatusAction(dealId, next)
      if (res && 'error' in res) {
        setCurrent(prev)
        toast.error(res.error)
      } else {
        const label = next === DEAL_STAGE_CANCELLED.value
          ? DEAL_STAGE_CANCELLED.label
          : DEAL_STAGES.find(s => s.value === next)?.label
        toast.success(`Этап: ${label}`)
      }
    })
  }

  return (
    <div className="hp-block">
      <div className="hp-block-header flex items-center justify-between">
        <span className="flex items-center gap-2">
          Этапы
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
        </span>
        {cancelled ? (
          <button
            type="button"
            onClick={() => move('new')}
            className="flex items-center gap-1.5 normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Вернуть в работу
          </button>
        ) : (
          <button
            type="button"
            onClick={() => move(DEAL_STAGE_CANCELLED.value)}
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
            {DEAL_STAGE_CANCELLED.label}
          </div>
        ) : (
          <div className="hp-stages">
            {DEAL_STAGES.map((stage, i) => {
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
