'use client'

import { useTransition } from 'react'
import { HandCoins, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { chargeAgencyFeeAction } from '../actions/payment-schedule.actions'

/**
 * Агентский договор: одна кнопка «Начислить вознаграждение» вместо формы
 * помесячного графика (QA 28.10.2026, A-08).
 */
export function ChargeAgencyFeeButton({ contractId, amount, alreadyCharged }: {
  contractId: string
  amount: number | null
  alreadyCharged: boolean
}) {
  const [isPending, startTransition] = useTransition()

  if (alreadyCharged) {
    return (
      <p className="text-[12.5px] text-[var(--hp-sub)]">
        Вознаграждение по договору начислено — отметьте «Оплачено», когда деньги придут.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border border-[var(--hp-border)] p-3">
      <p className="text-[12.5px] text-[var(--hp-sub)] flex-1 min-w-[220px]">
        По агентскому договору вознаграждение разовое
        {amount ? <> — <span className="text-[var(--hp-ink)] font-semibold">{amount.toLocaleString('ru-RU')} ₽</span></> : null}.
        Начислите его, чтобы оно появилось в бухгалтерии и в сроках оплаты.
      </p>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(async () => {
          const result = await chargeAgencyFeeAction(contractId)
          if (result.error) toast.error(result.error)
          else toast.success(result.message ?? 'Вознаграждение начислено')
        })}
        className="hp-btn-secondary shrink-0 disabled:opacity-60"
      >
        {isPending
          ? <Loader2 strokeWidth={1.6} className="w-4 h-4 animate-spin" />
          : <HandCoins strokeWidth={1.6} className="w-4 h-4" />}
        Начислить вознаграждение
      </button>
    </div>
  )
}
