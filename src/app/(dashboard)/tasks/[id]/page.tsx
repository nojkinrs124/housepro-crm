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
 low: { label: 'Низкий', color: 'text-[var(--hp-good)]', bg: 'bg-[var(--hp-good-tint)] border-[var(--hp-border)]' },
 medium: { label: 'Средний', color: 'text-[var(--hp-warn)]', bg: 'bg-[var(--hp-warn-tint)] border-[var(--hp-border)]' },
 high: { label: 'Высокий', color: 'text-[var(--hp-danger)]', bg: 'bg-[var(--hp-danger-tint)] border-[var(--hp-border)]' },
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
 todo: { label: 'К выполнению', color: 'text-[var(--hp-info)]', bg: 'bg-[var(--hp-info-tint)] border-[var(--hp-border)]' },
 in_progress: { label: 'В работе', color: 'text-[var(--hp-warn)]', bg: 'bg-[var(--hp-warn-tint)] border-[var(--hp-border)]' },
 done: { label: 'Выполнена', color: 'text-[var(--hp-good)]', bg: 'bg-[var(--hp-good-tint)] border-[var(--hp-border)]' },
 cancelled: { label: 'Отменена', color: 'text-[var(--hp-sub)]', bg: 'bg-[var(--hp-neutral-tint)] border-[var(--hp-border)]' },
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
 <Link href="/tasks" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
 <ArrowLeft style={{ width: 16, height: 16 }} />
 Назад к задачам
 </Link>

 {/* Header */}
 <div className="bg-white border border-border p-6">
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-start gap-4 flex-1 min-w-0">
 <div className="w-12 h-12 flex items-center justify-center shrink-0"
 style={{ background: task.status === 'done' ? 'var(--hp-accent)' : 'linear-gradient(135deg,#2563EB,#3B82F6)', }}>
 <CheckSquare style={{ width: 22, height: 22, color: '#fff' }} />
 </div>
 <div className="flex-1 min-w-0">
 <h1 className="text-xl font-bold text-foreground leading-snug">{task.title}</h1>
 <p className="text-sm text-muted-foreground mt-1">
 Создана {formatDateShort(task.created_at)}
 {(task.creator as { full_name?: string } | null)?.full_name ? ` · ${(task.creator as { full_name: string }).full_name}` : ''}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2 shrink-0">
 {/* Priority badge */}
 <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold border ${priority.bg} ${priority.color}`}>
 <Flag style={{ width: 12, height: 12 }} />
 {priority.label}
 </span>

 {/* Overdue warning */}
 {isOverdue && (
 <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-[var(--hp-danger-tint)] text-[var(--hp-danger)] border border-[var(--hp-border)]">
 <AlertTriangle style={{ width: 12, height: 12 }} />
 Просрочена
 </span>
 )}
 </div>
 </div>

 {/* Description */}
 {task.description && (
 <div className="mt-4 p-4 bg-background border border-border text-sm text-[var(--hp-ink)] leading-relaxed whitespace-pre-wrap">
 {task.description}
 </div>
 )}
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {/* Left: Status + details */}
 <div className="md:col-span-2 space-y-6">
 {/* Status control */}
 <div className="bg-white border border-border p-5">
 <h2 className="text-sm font-semibold text-foreground mb-4">Статус задачи</h2>
 <TaskStatusSelect taskId={task.id} currentStatus={task.status} />
 </div>

 {/* Related entities */}
 <div className="bg-white border border-border p-5">
 <h2 className="text-sm font-semibold text-foreground mb-4">Связанные объекты</h2>
 <div className="space-y-2">
 {(task.deal as { id: string; deal_type: string; status: string } | null) && (
 <Link href={`/deals/${(task.deal as { id: string }).id}`}
 className="flex items-center gap-3 p-3 border border-border hover:border-[var(--hp-border)] hover:bg-[var(--hp-info-tint)]/40 transition-all group">
 <div className="w-8 h-8 bg-[var(--hp-info-tint)] flex items-center justify-center">
 <Banknote style={{ width: 16, height: 16, color: '#2563EB' }} />
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Сделка</p>
 <p className="text-sm font-medium text-foreground group-hover:text-[var(--hp-info)] transition-colors">
 {(task.deal as { deal_type: string }).deal_type === 'rent' ? 'Аренда' :
 (task.deal as { deal_type: string }).deal_type === 'sale' ? 'Продажа' : 'Управление'}
 </p>
 </div>
 </Link>
 )}

 {(task.property as { id: string; title: string; address?: string } | null) && (
 <Link href={`/properties/${(task.property as { id: string }).id}`}
 className="flex items-center gap-3 p-3 border border-border hover:border-[var(--hp-border)] hover:bg-[var(--hp-neutral-tint)]/40 transition-all group">
 <div className="w-8 h-8 bg-[var(--hp-neutral-tint)] flex items-center justify-center">
 <Building2 style={{ width: 16, height: 16, color: '#7C3AED' }} />
 </div>
 <div className="min-w-0">
 <p className="text-xs text-muted-foreground">Объект</p>
 <p className="text-sm font-medium text-foreground group-hover:text-[var(--hp-sub)] transition-colors truncate">
 {(task.property as { title: string }).title}
 </p>
 {(task.property as { address?: string }).address && (
 <p className="text-xs text-muted-foreground truncate">{(task.property as { address: string }).address}</p>
 )}
 </div>
 </Link>
 )}

 {(task.contract as { id: string; contract_number?: string } | null) && (
 <Link href={`/contracts/${(task.contract as { id: string }).id}`}
 className="flex items-center gap-3 p-3 border border-border hover:border-[var(--hp-border)] hover:bg-[var(--hp-good-tint)]/40 transition-all group">
 <div className="w-8 h-8 bg-[var(--hp-good-tint)] flex items-center justify-center">
 <FileText style={{ width: 16, height: 16, color: 'var(--hp-accent)' }} />
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Договор</p>
 <p className="text-sm font-medium text-foreground group-hover:text-[var(--hp-good)] transition-colors">
 № {(task.contract as { contract_number?: string }).contract_number ?? '—'}
 </p>
 </div>
 </Link>
 )}

 {(task.lead as { id: string; full_name?: string; phone?: string } | null) && (
 <Link href={`/leads/${(task.lead as { id: string }).id}`}
 className="flex items-center gap-3 p-3 border border-border hover:border-[var(--hp-border)] hover:bg-[var(--hp-warn-tint)]/40 transition-all group">
 <div className="w-8 h-8 bg-[var(--hp-warn-tint)] flex items-center justify-center">
 <User style={{ width: 16, height: 16, color: '#EA580C' }} />
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Лид</p>
 <p className="text-sm font-medium text-foreground group-hover:text-[var(--hp-warn)] transition-colors">
 {(task.lead as { full_name?: string }).full_name ?? (task.lead as { phone?: string }).phone ?? '—'}
 </p>
 </div>
 </Link>
 )}

 {!task.deal && !task.property && !task.contract && !task.lead && (
 <p className="text-sm text-muted-foreground py-2">Нет связанных объектов</p>
 )}
 </div>
 </div>
 </div>

 {/* Right: Info panel */}
 <div className="space-y-4">
 {/* Assignee */}
 <div className="bg-white border border-border p-5">
 <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Исполнитель</h2>
 {(task.assignee as { full_name?: string; email?: string; role?: string } | null) ? (
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-[var(--hp-radius)] bg-[var(--hp-accent)] flex items-center justify-center text-white text-sm font-bold">
 {(task.assignee as { full_name: string }).full_name.charAt(0).toUpperCase()}
 </div>
 <div>
 <p className="text-sm font-semibold text-foreground">{(task.assignee as { full_name: string }).full_name}</p>
 <p className="text-xs text-muted-foreground">{(task.assignee as { email?: string }).email ?? ''}</p>
 </div>
 </div>
 ) : (
 <p className="text-sm text-muted-foreground">Не назначен</p>
 )}
 </div>

 {/* Deadline */}
 <div className="bg-white border border-border p-5">
 <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Сроки</h2>
 <div className="space-y-2">
 {deadline && (
 <div className={`flex items-center gap-2.5 p-3 border ${isOverdue ? 'bg-[var(--hp-danger-tint)] border-[var(--hp-border)]' : 'bg-background border-border'}`}>
 <Clock style={{ width: 15, height: 15, color: isOverdue ? '#DC2626' : '#64748B', flexShrink: 0 }} />
 <div>
 <p className="text-xs text-muted-foreground">Дедлайн</p>
 <p className={`text-sm font-semibold ${isOverdue ? 'text-[var(--hp-danger)]' : 'text-foreground'}`}>
 {formatDate(deadline)}
 </p>
 </div>
 </div>
 )}
 <div className="flex items-center gap-2.5 p-3 bg-background border border-border">
 <Calendar style={{ width: 15, height: 15, color: '#64748B', flexShrink: 0 }} />
 <div>
 <p className="text-xs text-muted-foreground">Создана</p>
 <p className="text-sm font-medium text-foreground">{formatDateShort(task.created_at)}</p>
 </div>
 </div>
 </div>
 </div>

 {/* Current status badge */}
 <div className="bg-white border border-border p-5">
 <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Текущий статус</h2>
 <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border ${status.bg} ${status.color}`}>
 {status.label}
 </span>
 </div>

 {/* Actions */}
 <div className="bg-white border border-border p-5 space-y-2">
 <Link href={`/tasks/new?deal_id=${task.deal_id ?? ''}&contract_id=${task.contract_id ?? ''}`}
 className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-[#2563EB] bg-[var(--hp-info-tint)] border border-[var(--hp-border)] hover:bg-[var(--hp-info-tint)] transition-all">
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
