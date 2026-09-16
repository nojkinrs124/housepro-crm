import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckSquare, TrendingUp, Home, FileText, Zap, Edit } from 'lucide-react'
import { TaskStatusSelect } from '@/features/tasks/components/TaskStatusSelect'
import { deleteTaskAction } from '@/features/tasks/actions/tasks.actions'
import { PageHeader } from '@/components/layout/PageHeader'
import { RecordActions } from '@/components/layout/RecordActions'
import { ConfirmDeleteButton } from '@/components/forms/ConfirmDeleteButton'
import { DEAL_TYPE_LABELS, DEAL_STATUS_LABELS } from '@/features/deals/config/deal-stages'
import { CONTRACT_TYPE_LABELS } from '@/features/contracts/config/contract-types'
import { formatDate, formatDeadline, initials } from '@/lib/utils'

const PRIORITY_LABELS: Record<string, { label: string; cls: string }> = {
  low:    { label: 'Низкий приоритет',  cls: 'hp-badge-neutral' },
  medium: { label: 'Средний приоритет', cls: 'hp-badge-info' },
  high:   { label: 'Высокий приоритет', cls: 'hp-badge-warn' },
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  todo:        { label: 'К выполнению', cls: 'hp-badge-info' },
  in_progress: { label: 'В работе',     cls: 'hp-badge-warn' },
  done:        { label: 'Выполнена',    cls: 'hp-badge-good' },
  cancelled:   { label: 'Отменена',     cls: 'hp-badge-neutral' },
}

const LONG_DATE = { day: '2-digit', month: 'long', year: 'numeric' } as const
const LONG_DATE_TIME = { ...LONG_DATE, hour: '2-digit', minute: '2-digit' } as const

/**
 * Карточка задачи — по скелету эталона (сделки): шапка с одной главной кнопкой,
 * блоки hp-block, действия в «…». Главное действие здесь — смена статуса, она
 * прямо под шапкой, без лишнего клика.
 */
export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignee:users!tasks_assigned_to_fkey(id, full_name, email, role),
      creator:users!tasks_created_by_fkey(id, full_name),
      deal:deals(id, deal_type, status, deal_number),
      property:properties(id, title, address),
      contract:contracts(id, contract_number, contract_type),
      lead:leads(id, full_name, phone),
      contact:contacts(id, full_name, company_name)
    `)
    .eq('id', id)
    .single()

  if (taskError && taskError.code !== 'PGRST116') {
    throw new Error(`Не удалось загрузить задачу: ${taskError.message}`)
  }
  if (!task) notFound()

  const { data: currentUserData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user!.id)
    .single()
  const canDelete = ['admin', 'manager'].includes(currentUserData?.role ?? '')

  const priority = PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS.medium
  const status = STATUS_LABELS[task.status] ?? STATUS_LABELS.todo
  const isClosed = ['done', 'cancelled'].includes(task.status)

  const deadline = task.deadline ?? task.due_date
  const dl = deadline ? formatDeadline(deadline) : null
  const isOverdue = !!dl?.overdue && !isClosed

  const assignee = task.assignee as { id: string; full_name: string; email?: string | null } | null
  const creator  = task.creator as { full_name?: string | null } | null
  const deal     = task.deal as { id: string; deal_type: string; status: string; deal_number?: number | null } | null
  const property = task.property as { id: string; title: string; address?: string | null } | null
  const contract = task.contract as { id: string; contract_number?: string | null; contract_type: string } | null
  const lead     = task.lead as { id: string; full_name?: string | null; phone?: string | null } | null
  const contact  = task.contact as { id: string; full_name: string; company_name?: string | null } | null

  const related = [
    deal && {
      href: `/deals/${deal.id}`, icon: TrendingUp, kind: 'Сделка',
      title: `${deal.deal_number ? `СД-${deal.deal_number} · ` : ''}${DEAL_TYPE_LABELS[deal.deal_type] ?? deal.deal_type}`,
      sub: DEAL_STATUS_LABELS[deal.status] ?? deal.status,
    },
    contact && {
      href: `/contacts/${contact.id}`, icon: CheckSquare, kind: 'Контакт',
      title: contact.company_name || contact.full_name, sub: null,
    },
    property && {
      href: `/properties/${property.id}`, icon: Home, kind: 'Объект',
      title: property.title, sub: property.address ?? null,
    },
    contract && {
      href: `/contracts/${contract.id}`, icon: FileText, kind: 'Договор',
      title: CONTRACT_TYPE_LABELS[contract.contract_type] ?? contract.contract_type,
      sub: contract.contract_number ?? null,
    },
    lead && {
      href: `/leads/${lead.id}`, icon: Zap, kind: 'Лид',
      title: lead.full_name || 'Без имени', sub: lead.phone ?? null,
    },
  ].filter((r): r is NonNullable<typeof r> => Boolean(r))

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        crumbs={[{ label: 'Задачи', href: '/tasks' }, { label: status.label }]}
        title={task.title}
        badges={
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className={`hp-badge ${status.cls}`}>{status.label}</span>
            <span className={`hp-badge ${priority.cls}`}>{priority.label}</span>
            {isOverdue && <span className="hp-badge hp-badge-danger">Просрочена</span>}
          </span>
        }
        meta={
          <>
            <span>создана {formatDate(task.created_at, LONG_DATE)}</span>
            {creator?.full_name && (
              <>
                <span className="sep">·</span>
                <span>{creator.full_name}</span>
              </>
            )}
          </>
        }
        actions={
          <RecordActions
            secondary={
              <Link href={`/tasks/new?deal_id=${task.deal_id ?? ''}&contact_id=${task.contact_id ?? ''}&property_id=${task.property_id ?? ''}&contract_id=${task.contract_id ?? ''}`}
                className="hp-btn-secondary">
                <Edit className="w-4 h-4" />
                Создать похожую
              </Link>
            }
            more={canDelete && (
              <ConfirmDeleteButton
                action={deleteTaskAction.bind(null, id)}
                confirmText={`Удалить задачу «${task.title}»? Она пропадёт из списка и календаря. Отменить нельзя.`}
                label="Удалить задачу"
              />
            )}
          />
        }
      />

      {/* Главное действие — статус. Это то, зачем открывают карточку задачи. */}
      <div className="hp-block">
        <div className="hp-block-header">Статус</div>
        <div className="px-[18px] py-3">
          <TaskStatusSelect taskId={task.id} currentStatus={task.status} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          {task.description && (
            <div className="hp-block">
              <div className="hp-block-header">Описание</div>
              <p className="px-[18px] py-3 text-sm text-[var(--hp-sub)] whitespace-pre-wrap leading-relaxed">
                {task.description}
              </p>
            </div>
          )}

          <div className="hp-block">
            <div className="hp-block-header">Связано с</div>
            {related.length === 0 ? (
              <div className="hp-block-item text-[var(--hp-tertiary)]">Задача ни к чему не привязана</div>
            ) : (
              related.map(r => {
                const Icon = r.icon
                return (
                  <Link key={r.href} href={r.href} className="hp-block-item">
                    <Icon className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[var(--hp-ink)] font-medium">{r.title}</span>
                      {r.sub && <span className="block text-[11.5px] text-[var(--hp-sub)] truncate">{r.sub}</span>}
                    </span>
                    <span className="shrink-0 text-[11px] uppercase tracking-wide text-[var(--hp-tertiary)]">{r.kind}</span>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="hp-block">
            <div className="hp-block-header">Исполнитель</div>
            {assignee ? (
              <div className="hp-block-item">
                <div className="hp-avatar">{initials(assignee.full_name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--hp-ink)] truncate">{assignee.full_name}</p>
                  {assignee.email && <p className="text-[11.5px] text-[var(--hp-sub)] truncate">{assignee.email}</p>}
                </div>
              </div>
            ) : (
              <div className="hp-block-item text-[var(--hp-tertiary)]">Не назначен</div>
            )}
          </div>

          <div className="hp-block">
            <div className="hp-block-header">Сроки</div>
            <div className="hp-block-row">
              <span className="label">Срок</span>
              <span className={`value${isOverdue ? ' danger' : ''}`}>
                {deadline ? formatDate(deadline, LONG_DATE_TIME) : <span className="text-[var(--hp-tertiary)]">не задан</span>}
              </span>
            </div>
            {dl && !isClosed && (
              <div className="hp-block-row">
                <span className="label">Осталось</span>
                <span className={`value${isOverdue ? ' danger' : ''}`}>{dl.label}</span>
              </div>
            )}
            <div className="hp-block-row">
              <span className="label">Создана</span>
              <span className="value">{formatDate(task.created_at, LONG_DATE)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
