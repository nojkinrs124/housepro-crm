import type { ReactNode } from 'react'
import { OverflowMenu } from './OverflowMenu'

/**
 * Панель действий карточки записи — правило простоты №2.
 *
 *   <RecordActions
 *     primary={<Link href=".../complete" className="hp-btn-primary">Оформить</Link>}
 *     secondary={<Link href=".../edit" className="hp-btn-secondary">Редактировать</Link>}
 *     more={<ConfirmDeleteButton variant="menu" … />}
 *   />
 *
 * `primary` — ровно одна кнопка, визуально акцентная (`hp-btn-primary`).
 * `secondary` — одна-две обычные (`hp-btn-secondary`), обычно «Редактировать».
 * `more` — всё остальное уходит в меню «…»; опасные действия только там.
 *
 * Серверный компонент: принимает готовые элементы, функции не передаёт.
 */
export function RecordActions({
  primary,
  secondary,
  more,
}: {
  primary?: ReactNode
  secondary?: ReactNode
  more?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap shrink-0" data-testid="record-actions">
      {primary}
      {secondary}
      {more && <OverflowMenu>{more}</OverflowMenu>}
    </div>
  )
}
