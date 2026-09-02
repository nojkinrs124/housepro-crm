'use client'

import Link from 'next/link'
import { LayoutGrid, List } from 'lucide-react'
import { TasksKanbanBoard } from './TasksKanban'
import { TASK_STATUSES } from '@/features/registry/config/registries'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { RegistryTable, type RegistryColumn } from '@/features/registry/components/RegistryTable'
import { BulkBar } from '@/features/registry/components/BulkBar'
import { useRegistryFilters } from '@/hooks/useRegistryFilters'
import { useSelection } from '@/hooks/useSelection'
import { usePersistedState } from '@/hooks/usePersistedFilters'
import { formatDeadline } from '@/lib/utils'

export interface TaskRow {
  id: string
  title: string
  status: string
  priority: string
  deadline: string | null
  assigneeName: string | null
}

type ViewMode = 'kanban' | 'list'

const STATUS_BADGE: Record<string, string> = {
  todo:        'hp-badge-neutral',
  in_progress: 'hp-badge-info',
  done:        'hp-badge-good',
  cancelled:   'hp-badge-neutral',
}
const STATUS_LABELS: Record<string, string> = Object.fromEntries(TASK_STATUSES.map(s => [s.value, s.label]))

const PRIORITY_LABELS: Record<string, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий' }
const PRIORITY_BADGE: Record<string, string> = { low: 'hp-badge-neutral', medium: 'hp-badge-warn', high: 'hp-badge-danger' }

const STATUS_OPTIONS = [
  { value: 'all', label: 'Статус: все' },
  ...TASK_STATUSES.map(s => ({ value: s.value, label: s.label })),
]
const PRIORITY_OPTIONS = [
  { value: 'all', label: 'Приоритет: любой' },
  ...Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
]

const VIEWS = [
  { value: 'kanban', label: 'Канбан', icon: LayoutGrid },
  { value: 'list',   label: 'Реестр', icon: List },
]

export function TasksView({ tasks }: { tasks: TaskRow[] }) {
  const [view, setView] = usePersistedState<ViewMode>('tasks:view', 'kanban')

  const { search, setSearch, filtered, toolbarFilters, reset } = useRegistryFilters(tasks, {
    storageKey: 'tasks',
    haystack: t => [t.title, t.assigneeName].filter(Boolean).join(' '),
    filters: [
      { key: 'status',   options: STATUS_OPTIONS,   field: t => t.status },
      { key: 'priority', options: PRIORITY_OPTIONS, field: t => t.priority },
    ],
  })

  const selection = useSelection(filtered)

  const columns: RegistryColumn<TaskRow>[] = [
    {
      key: 'title', title: 'Задача', cellClass: 'font-semibold max-w-[320px]',
      cell: t => (
        <Link href={`/tasks/${t.id}`} className="block truncate hover:text-[var(--hp-accent)] transition-colors">
          {t.title}
        </Link>
      ),
    },
    {
      key: 'assignee', title: 'Исполнитель', cellClass: 'sub whitespace-nowrap', headClass: 'hidden md:table-cell',
      cell: t => t.assigneeName ?? <span className="text-[var(--hp-tertiary)]">—</span>,
    },
    {
      key: 'priority', title: 'Приоритет',
      cell: t => (
        <span className={`hp-badge ${PRIORITY_BADGE[t.priority] ?? 'hp-badge-neutral'}`}>
          {PRIORITY_LABELS[t.priority] ?? t.priority}
        </span>
      ),
    },
    {
      key: 'status', title: 'Статус',
      cell: t => (
        <span className={`hp-badge ${STATUS_BADGE[t.status] ?? 'hp-badge-neutral'}`}>
          {STATUS_LABELS[t.status] ?? t.status}
        </span>
      ),
    },
    {
      key: 'deadline', title: 'Срок', cellClass: 'sub whitespace-nowrap',
      cell: t => {
        const dl = formatDeadline(t.deadline)
        if (!dl) return <span className="text-[var(--hp-tertiary)]">—</span>
        return <span className={dl.overdue ? 'text-[var(--hp-danger)] font-semibold' : ''}>{dl.label}</span>
      },
    },
  ]

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск: задача, исполнитель"
        filters={toolbarFilters}
        views={VIEWS}
        view={view}
        onViewChange={v => setView(v as ViewMode)}
        onReset={reset}
        foundLabel={<>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filtered.length}</span> из {tasks.length}</>}
      />

      {/* Групповые действия — только в реестре: на канбане строк с чекбоксами нет */}
      {view === 'list' && <BulkBar registry="tasks" selection={selection} />}

      {/* Без AnimatePresence: mode="wait" ждал exit уходящего вида и при
          переключении с канбана на реестр новый вид не монтировался вовсе —
          таблица не появлялась ни через секунду, ни через шесть. */}
      {view === 'kanban' ? (
        <TasksKanbanBoard tasks={filtered} />
      ) : (
        <RegistryTable
          rows={filtered}
          columns={columns}
          href={t => `/tasks/${t.id}`}
          selection={selection}
          empty="Нет задач по выбранным фильтрам"
        />
      )}
    </div>
  )
}
