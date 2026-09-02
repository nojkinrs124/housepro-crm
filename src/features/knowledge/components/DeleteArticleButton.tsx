'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

/** Удаление статьи — с подтверждением: восстановить её будет неоткуда. */
export function DeleteArticleButton({
  action,
  title,
}: {
  action: () => Promise<{ error?: string } | void>
  title: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Удалить статью «${title}»? Это действие нельзя отменить.`)) return
        startTransition(async () => {
          const res = await action()
          if (res?.error) toast.error(res.error)
        })
      }}
      className="hp-chip text-[var(--hp-danger)]"
    >
      <Trash2 className="w-3.5 h-3.5 shrink-0" />
      Удалить
    </button>
  )
}
