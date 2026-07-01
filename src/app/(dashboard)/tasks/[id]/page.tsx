import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, CheckSquare, Calendar, User, Clock,
  AlertTriangle, Building2, FileText, Banknote, Flag,
} from 'lucide-react'
import { TaskStatusSelect } from '@/features/tasks/components/TaskStatusSelect'
import { TaskDeleteButton } from '@/features/tasks/components/TaskDeleteButton'

const PRIORITY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: 'Низкий',    color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  medium: { label: 'Средний',   color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  high:   { label: 'Высокий',   color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  todo:        { label: 'К выполнению', color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200' },
  in_progress: { label: 'В работе',     color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  done:        { label: 'Выполнена',    color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  cancelled:   { label: 'Отменена',     color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200' },
}

function formatDate(dt: string | null | undefined) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateShort(dt: string | null | undefined) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

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
      deal:deals(id, deal_type, status),
      property:properties(id, title, address),
      contract:contracts(id, contract_number, contract_type),
      lead:leads(id, full_name, phone)
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

  const deadline = task.deadline ?? task.due_date
  const isOverdue = deadline && new Date(deadline) < new Date() && !['done', 'cancelled'].includes(task.status)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/tasks" className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#111827] transition-colors">
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Назад к задачам
      </Link>

      {/* Header */}
      <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: task.status === 'done' ? 'linear-gradient(135deg,#16A34A,#22C55E)' : 'linear-gradient(135deg,#2563EB,#3B82F6)', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}>
              <CheckSquare style={{ width: 22, height: 22, color: '#fff' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-[#111827] leading-snug">{task.title}</h1>
              <p className="text-sm text-[#64748B] mt-1">
                Создана {formatDateShort(task.created_at)}
                {(task.creator as { full_name?: string } | null)?.full_name ? ` · ${(task.creator as { full_name: string }).full_name}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Priority badge */}
            <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border rounded-lg ${priority.bg} ${priority.color}`}>
              <Flag style={{ width: 12, height: 12 }} />
              {priority.label}
            </span>

            {/* Overdue warning */}
            {isOverdue && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg">
                <AlertTriangle style={{ width: 12, height: 12 }} />
                Просрочена
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div className="mt-4 p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-sm text-[#374151] leading-relaxed whitespace-pre-wrap">
            {task.description}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Status + details */}
        <div className="md:col-span-2 space-y-6">
          {/* Status control */}
          <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#111827] mb-4">Статус задачи</h2>
            <TaskStatusSelect taskId={task.id} currentStatus={task.status} />
          </div>

          {/* Related entities */}
          <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#111827] mb-4">Связанные объекты</h2>
            <div className="space-y-2">
              {(task.deal as { id: string; deal_type: string; status: string } | null) && (
                <Link href={`/deals/${(task.deal as { id: string }).id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] hover:border-blue-300 hover:bg-blue-50/40 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Banknote style={{ width: 16, height: 16, color: '#2563EB' }} />
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B]">Сделка</p>
                    <p className="text-sm font-medium text-[#111827] group-hover:text-blue-600 transition-colors">
                      {(task.deal as { deal_type: string }).deal_type === 'rent' ? 'Аренда' :
                       (task.deal as { deal_type: string }).deal_type === 'sale' ? 'Продажа' : 'Управление'}
                    </p>
                  </div>
                </Link>
              )}

              {(task.property as { id: string; title: string; address?: string } | null) && (
                <Link href={`/properties/${(task.property as { id: string }).id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] hover:border-purple-300 hover:bg-purple-50/40 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Building2 style={{ width: 16, height: 16, color: '#7C3AED' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#64748B]">Объект</p>
                    <p className="text-sm font-medium text-[#111827] group-hover:text-purple-600 transition-colors truncate">
                      {(task.property as { title: string }).title}
                    </p>
                    {(task.property as { address?: string }).address && (
                      <p className="text-xs text-[#64748B] truncate">{(task.property as { address: string }).address}</p>
                    )}
                  </div>
                </Link>
              )}

              {(task.contract as { id: string; contract_number?: string } | null) && (
                <Link href={`/contracts/${(task.contract as { id: string }).id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] hover:border-green-300 hover:bg-green-50/40 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <FileText style={{ width: 16, height: 16, color: '#16A34A' }} />
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B]">Договор</p>
                    <p className="text-sm font-medium text-[#111827] group-hover:text-green-600 transition-colors">
                      № {(task.contract as { contract_number?: string }).contract_number ?? '—'}
                    </p>
                  </div>
                </Link>
              )}

              {(task.lead as { id: string; full_name?: string; phone?: string } | null) && (
                <Link href={`/leads/${(task.lead as { id: string }).id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] hover:border-orange-300 hover:bg-orange-50/40 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <User style={{ width: 16, height: 16, color: '#EA580C' }} />
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B]">Лид</p>
                    <p className="text-sm font-medium text-[#111827] group-hover:text-orange-600 transition-colors">
                      {(task.lead as { full_name?: string }).full_name ?? (task.lead as { phone?: string }).phone ?? '—'}
                    </p>
                  </div>
                </Link>
              )}

              {!task.deal && !task.property && !task.contract && !task.lead && (
                <p className="text-sm text-[#64748B] py-2">Нет связанных объектов</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Info panel */}
        <div className="space-y-4">
          {/* Assignee */}
          <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">Исполнитель</h2>
            {(task.assignee as { full_name?: string; email?: string; role?: string } | null) ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                  {(task.assignee as { full_name: string }).full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{(task.assignee as { full_name: string }).full_name}</p>
                  <p className="text-xs text-[#64748B]">{(task.assignee as { email?: string }).email ?? ''}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#64748B]">Не назначен</p>
            )}
          </div>

          {/* Deadline */}
          <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">Сроки</h2>
            <div className="space-y-2">
              {deadline && (
                <div className={`flex items-center gap-2.5 p-3 rounded-xl border ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-[#F8FAFC] border-[#E2E8F0]'}`}>
                  <Clock style={{ width: 15, height: 15, color: isOverdue ? '#DC2626' : '#64748B', flexShrink: 0 }} />
                  <div>
                    <p className="text-xs text-[#64748B]">Дедлайн</p>
                    <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-[#111827]'}`}>
                      {formatDate(deadline)}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <Calendar style={{ width: 15, height: 15, color: '#64748B', flexShrink: 0 }} />
                <div>
                  <p className="text-xs text-[#64748B]">Создана</p>
                  <p className="text-sm font-medium text-[#111827]">{formatDateShort(task.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Current status badge */}
          <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">Текущий статус</h2>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border rounded-lg ${status.bg} ${status.color}`}>
              {status.label}
            </span>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-5 shadow-sm space-y-2">
            <Link href={`/tasks/new?deal_id=${task.deal_id ?? ''}&contract_id=${task.contract_id ?? ''}`}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-[#2563EB] bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all">
              <CheckSquare style={{ width: 15, height: 15 }} />
              Создать похожую
            </Link>
            {canDelete && <TaskDeleteButton taskId={task.id} />}
          </div>
        </div>
      </div>
    </div>
  )
}
