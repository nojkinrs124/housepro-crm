'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { PlugZap } from 'lucide-react'
import { checkPodpislonKeyAction } from '@/features/contracts/actions/podpislon.actions'

/**
 * Проверка API-ключа: запрашивает у Подпислона данные компании.
 *
 * Нужна потому, что ошибиться в ключе легко, а узнать об этом иначе можно
 * только в момент отправки договора клиенту — самый неподходящий момент.
 */
export function PodpislonKeyCheck() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  function check() {
    startTransition(async () => {
      const res = await checkPodpislonKeyAction()
      if (res.error) {
        setResult(null)
        toast.error(res.error)
        return
      }
      setResult(res.message ?? 'Ключ рабочий')
      toast.success('Связь с Подпислоном есть')
    })
  }

  return (
    <div className="hp-card p-5 space-y-3">
      <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Проверка подключения</h2>
      <p className="text-sm text-[var(--hp-sub)]">
        Запросим у сервиса данные вашей компании — так сразу видно, что ключ сохранён верно.
      </p>
      {result && <p className="text-sm text-[var(--hp-good)]">{result}</p>}
      <button
        type="button"
        onClick={check}
        disabled={isPending}
        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-semibold text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors disabled:opacity-60"
      >
        <PlugZap className="w-4 h-4" />
        {isPending ? 'Проверяем…' : 'Проверить ключ'}
      </button>
    </div>
  )
}
