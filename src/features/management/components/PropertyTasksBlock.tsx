import Link from 'next/link'
import { CheckSquare, Plus, Repeat } from 'lucide-react'
import { formatDeadline } from '@/lib/utils'

export interface PropertyTaskRow {
  id: string
  title: string
  status: string
  deadline: string | null
  due_date: string | null
  regulation_code: string | null
}

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'К выполнению', in_progress: 'В работе', done: 'Выполнено', cancelled: 'Отменено',
}

const dueOf = (t: PropertyTaskRow) => t.due_date ?? t.deadline ?? ''

/**
 * Открытые задачи по объекту одним списком: регламентные (их заводит крон по
 * правилам тарифа) идут первыми и помечены, просроченные — красным. До
 * 16.09.2026 регламент и ручные задачи жили в двух блоках на разных концах
 * карточки, и «снять показания» терялось между ними.
 *
 * Server Component: только разметка.
 */
export function PropertyTasksBlock({ propertyId, tasks }: { propertyId: string; tasks: PropertyTaskRow[] }) {
  const open = tasks.filter(t => !['done', 'cancelled'].includes(t.status))
  const byDue = (a: PropertyTaskRow, b: PropertyTaskRow) => dueOf(a).localeCompare(dueOf(b))
  const regulation = open.filter(t => t.regulation_code).sort(byDue)
  const manual = open.filter(t => !t.regulation_code)
  const overdue = open.filter(t => formatDeadline(dueOf(t) || null)?.overdue).length

  return (
    <div className="hp-block">
      <div className="hp-block-header flex items-center justify-between gap-2">
        <span>Задачи по объекту</span>
        {overdue > 0 && <span className="hp-badge hp-badge-danger">Просрочено: {overdue}</span>}
      </div>

      {open.length === 0 && (
        <div className="hp-block-item text-[var(--hp-tertiary)]">
          <CheckSquare className="w-4 h-4 shrink-0" />
          Открытых задач нет
        </div>
      )}

      {[...regulation, ...manual].map(task => {
        const dl = formatDeadline(dueOf(task) || null)
        return (
          <Link key={task.id} href={`/tasks/${task.id}`} className="hp-block-item">
            {task.regulation_code
              ? <Repeat className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" aria-label="Регламентная" />
              : <CheckSquare className="w-4 h-4 shrink-0 text-[var(--hp-tertiary)]" />}
            <span className="flex-1 min-w-0">
              <span className="block truncate text-[var(--hp-ink)]">{task.title}</span>
              <span className="block text-[11.5px] text-[var(--hp-sub)]">
                {task.regulation_code ? 'По регламенту' : TASK_STATUS_LABELS[task.status] ?? task.status}
              </span>
            </span>
            {dl && (
              <span className={`shrink-0 text-[12px] font-medium ${dl.overdue ? 'text-[var(--hp-danger)]' : 'text-[var(--hp-sub)]'}`}>
                {dl.label}
              </span>
            )}
          </Link>
        )
      })}

      <Link href={`/tasks/new?property_id=${propertyId}`} className="hp-block-item text-[var(--hp-accent)] font-semibold">
        <Plus className="w-4 h-4 shrink-0" />
        Новая задача
      </Link>
    </div>
  )
}
