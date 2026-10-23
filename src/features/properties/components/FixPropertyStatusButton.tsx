'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Wrench, Loader2 } from 'lucide-react'
import { fixPropertyStatusAction } from '../actions/properties.actions'

/**
 * «Исправить» рядом с находкой «статус объекта расходится с договором
 * аренды» — одним кликом, без перехода в форму редактирования и поиска
 * поля «Статус» среди остальных (аудит 23.10.2026, K4).
 */
export function FixPropertyStatusButton({ propertyId, title = 'Исправить' }: { propertyId: string; title?: string }) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      const res = await fixPropertyStatusAction(propertyId)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Статус объекта приведён в соответствие договору')
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--hp-accent)] hover:underline disabled:opacity-50"
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
      {title}
    </button>
  )
}
