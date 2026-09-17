'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'

/**
 * Меню «…» для второстепенных и опасных действий карточки записи.
 * Правило простоты №2: на экране ровно одна главная кнопка; всё, что не нужно
 * каждый день (удалить, экспорт, дублировать), — здесь.
 *
 * Пункты передаются как children: ссылки `<Link className="hp-menu-item">`,
 * кнопки `ConfirmDeleteButton variant="menu"` и т.п. Закрывается кликом
 * снаружи и по Escape.
 */
export function OverflowMenu({ children, label = 'Ещё действия' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="overflow-menu"
        onClick={() => setOpen(v => !v)}
        className="hp-btn-secondary h-10 w-10 !px-0 justify-center"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div
          role="menu"
          // Закрываем после того, как браузер выполнит действие пункта по
          // умолчанию: submit-кнопка внутри формы теряла отправку, когда меню
          // размонтировалось синхронно в этом же клике («Отменить показ» не
          // работал — проход 17.09.2026, SH-2).
          onClick={() => setTimeout(() => setOpen(false), 0)}
          className="absolute right-0 top-full mt-1 min-w-[200px] z-20 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] py-1"
        >
          {children}
        </div>
      )}
    </div>
  )
}
