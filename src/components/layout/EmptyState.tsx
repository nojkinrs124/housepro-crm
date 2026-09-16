import type { ReactNode } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

/**
 * Пустое состояние — эталон правила «нет пустых экранов»: что это за раздел и
 * что здесь делать, плюс одна кнопка, которая это делает.
 *
 * Два режима:
 *   - данных нет вообще — заголовок про раздел и кнопка создания;
 *   - данные есть, но фильтр ничего не нашёл — короткий текст и «Сбросить фильтры».
 * Второй режим передаётся через `children`/`action` из клиентского кода (сброс —
 * функция, поэтому кнопку рендерит вызывающий компонент).
 *
 * Серверный компонент. Раньше один и тот же блок `hp-card hp-empty` был
 * скопирован вручную в восьми модулях.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
  action,
  compact = false,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  /** Ссылка главной кнопки — «Новая сделка», «Добавить контакт» */
  actionHref?: string
  actionLabel?: string
  /** Готовая кнопка, когда действие — не ссылка (например, сброс фильтров) */
  action?: ReactNode
  /** Внутри блока карточки: меньше отступ, без рамки */
  compact?: boolean
}) {
  const body = (
    <>
      {icon && <div className="hp-page-icon mx-auto mb-4">{icon}</div>}
      <p className="text-[15px] font-semibold text-[var(--hp-ink)]">{title}</p>
      {description && <p className="text-sm text-[var(--hp-sub)] mt-1.5 max-w-md mx-auto">{description}</p>}
      {(actionHref || action) && (
        <div className="mt-5 flex justify-center">
          {actionHref ? (
            <Link href={actionHref} className={buttonVariants({ size: 'sm' })}>
              {actionLabel}
            </Link>
          ) : action}
        </div>
      )}
    </>
  )

  if (compact) return <div className="text-center px-6 py-10">{body}</div>
  return <div className="hp-card hp-empty">{body}</div>
}
