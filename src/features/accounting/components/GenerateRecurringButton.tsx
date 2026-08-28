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
 else if (res && 'generated' in res && res.generated > 0) toast.success(`Создано транзакций: ${res.generated}`)
 else toast.info('Всё уже актуально — новых транзакций нет')
 })
 }

 return (
 <button
 onClick={handleGenerate}
 disabled={isPending}
 className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-sm font-semibold text-[#374151] hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 whitespace-nowrap"
 title="Проверить и создать просроченные транзакции сейчас, не дожидаясь ночного крона"
 >
 <RefreshCw style={{ width: 14, height: 14 }} className={isPending ? 'animate-spin' : ''} />
 Сгенерировать сейчас
 </button>
 )
}
