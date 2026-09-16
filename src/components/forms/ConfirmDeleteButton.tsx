'use client'

import { useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type ActionResult = { error?: string } | void | undefined

/**
 * Удаление записи с подтверждением — правило простоты №7: необратимое действие
 * спрашивает, и в вопросе сказано, что именно произойдёт.
 *
 *   <ConfirmDeleteButton
 *     action={deleteDealAction.bind(null, id)}
 *     confirmText="Удалить сделку СД-12? Договоры и задачи останутся, но потеряют связь со сделкой. Отменить нельзя."
 *   />
 *
 * `action` — Server Action, уже забинженный на id (bind сериализуется, поэтому
 * его можно передать из Server Component). Экшен либо делает redirect, либо
 * возвращает `{ error }` — ошибка показывается toast'ом, а не проглатывается,
 * как было в пяти старых Delete*Button.
 *
 * `variant="menu"` — пункт меню «…» (OverflowMenu), `"button"` — отдельная кнопка.
 */
export function ConfirmDeleteButton({
  action,
  confirmText,
  label = 'Удалить',
  variant = 'menu',
  testId = 'delete-button',
}: {
  action: () => Promise<ActionResult>
  confirmText: string
  label?: string
  variant?: 'menu' | 'button'
  testId?: string
}) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    if (!window.confirm(confirmText)) return
    startTransition(async () => {
      const res = await action()
      if (res && 'error' in res && res.error) toast.error(res.error)
    })
  }

  const cls = variant === 'menu'
    ? 'hp-menu-item text-[var(--hp-danger)]'
    : 'hp-btn-secondary text-[var(--hp-danger)] hover:border-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)]'

  return (
    <button type="button" role={variant === 'menu' ? 'menuitem' : undefined} onClick={handleClick}
      disabled={isPending} data-testid={testId} className={cls}>
      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      {label}
    </button>
  )
}
