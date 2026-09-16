'use client'

import { useTransition } from 'react'
import { generateRecurringTransactionsAction } from '../actions/recurring.actions'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

// Ручной запуск той же генерации, что ежедневно гоняет cron
// (/api/cron/generate-recurring-transactions) — на случай, если нужно
// не ждать до утра и увидеть просроченные транзакции прямо сейчас.
export function GenerateRecurringButton() {
 const [isPending, startTransition] = useTransition()

 function handleGenerate() {
 startTransition(async () => {
 const res = await generateRecurringTransactionsAction()
 if (res && 'error' in res) toast.error(res.error)
 else if (res && 'generated' in res && res.generated > 0) toast.success(`Создано операций: ${res.generated}`)
 else toast.info('Всё уже актуально — новых операций нет')
 })
 }

 return (
 <button
 onClick={handleGenerate}
 disabled={isPending}
 className="flex items-center gap-2 px-4 py-2 hp-card text-sm font-semibold text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] hover:border-[var(--hp-sub)] transition-all disabled:opacity-50 whitespace-nowrap"
 title="Создать операции по правилам сейчас, не дожидаясь ночного запуска"
 >
 <RefreshCw style={{ width: 14, height: 14 }} className={isPending ? 'animate-spin' : ''} />
 Сгенерировать сейчас
 </button>
 )
}
