'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { togglePlanActiveAction } from '@/features/plans/actions/plans.actions'

/**
 * Включение и скрытие тарифа. Скрытый тариф перестаёт предлагаться в новых
 * договорах, но не трогает заключённые: их ставка зафиксирована в самом договоре.
 */
export function PlanActiveToggle({ id, isActive, title }: { id: string; isActive: boolean; title: string }) {
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      className="hp-btn-secondary"
      onClick={() => start(async () => {
        const res = await togglePlanActiveAction(id, !isActive)
        if (res.error) toast.error(res.error)
        else toast.success(isActive ? `Тариф «${title}» скрыт` : `Тариф «${title}» включён`)
      })}
    >
      {isActive ? 'Скрыть' : 'Включить'}
    </button>
  )
}
