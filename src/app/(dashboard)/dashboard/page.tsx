import { createClient } from '@/lib/supabase/server'
import {
 Users, Home, FileText, CheckSquare, TrendingUp,
 Zap, Clock, DollarSign, AlertTriangle, ArrowUpRight,
 Calendar, Banknote, Wallet
} from 'lucide-react'
import Link from 'next/link'
import { DashboardKpiCards } from '@/features/dashboard/components/DashboardKpiCards'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatDate } from '@/lib/utils'
import { DEAL_TYPE_LABELS as dealTypeLabels, DEAL_STATUS_LABELS as dealStatusLabels } from '@/features/deals/config/deal-stages'

export default async function DashboardPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 const now = new Date().toISOString()

 const [
 { count: contactsCount },
 { count: propertiesCount },
 { count: contractsCount },
 { count: activeTasksCount },
 { count: newLeadsCount },
 { count: activeDealsCount },
 { count: overdueTasksCount },
 { count: overduePaymentsCount },
 { data: dealsByStatus },
 { data: paymentStats },
 { data: recentContacts },
 { data: recentDeals },
 { data: myTasks },
 { data: overduePaymentsList },
 { data: upcomingDeadlines },
 ] = await Promise.all([
 supabase.from('contacts').select('id', { count: 'exact', head: true }),
 supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'available'),
 supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'signed'),
 supabase.from('tasks').select('id', { count: 'exact', head: true }).not('status', 'in', '(done,cancelled)'),
 supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
 supabase.from('deals').select('id', { count: 'exact', head: true }).not('status', 'in', '(completed,cancelled)'),
 supabase.from('tasks').select('id', { count: 'exact', head: true })
 .lt('deadline', now).not('status', 'in', '(done,cancelled)'),
 supabase.from('payments').select('id', { count: 'exact', head: true })
 .eq('payment_status', 'overdue'),
 supabase.from('deals').select('status'),
 supabase.from('payments')
 .select('amount, payment_status')
 .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
 supabase.from('contacts').select('id, full_name, phone, role, status, created_at')
 .order('created_at', { ascending: false }).limit(5),
 supabase.from('deals').select('id, deal_type, status, amount, created_at, owner_contact:contacts!deals_owner_contact_id_fkey(full_name), client_contact:contacts!deals_client_contact_id_fkey(full_name)')
 .order('created_at', { ascending: false }).limit(5),
 supabase.from('tasks').select('id, title, priority, deadline, status')
 .eq('assigned_to', user?.id ?? '')
 .not('status', 'in', '(done,cancelled)')
 .order('deadline', { ascending: true }).limit(6),
 supabase.from('payments').select('id, amount, payment_type, due_date, contract:contracts(contract_number)')
 .eq('payment_status', 'overdue')
 .order('due_date', { ascending: true }).limit(4),
 supabase.from('tasks').select('id, title, priority, deadline')
 .gte('deadline', now)
 .lte('deadline', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
 .not('status', 'in', '(done,cancelled)')
 .order('deadline', { ascending: true }).limit(5),
 ])

 const paidThisMonth = (paymentStats ?? [])
 .filter(p => p.payment_status === 'paid')
 .reduce((s, p) => s + Number(p.amount ?? 0), 0)
 const pendingThisMonth = (paymentStats ?? [])
 .filter(p => ['pending', 'partial'].includes(p.payment_status ?? ''))
 .reduce((s, p) => s + Number(p.amount ?? 0), 0)

 // bg через color-mix(...,var(--hp-surface)) вместо голой rgba(...,0.12): на тёмной
 // поверхности та же rgba-прозрачность почти не видна (12% альфы поверх тёмного —
 // это всё ещё тёмный), color-mix подмешивает цвет в текущий --hp-surface, а не в
 // абсолютный белый/прозрачный — тон одинаково читается в обеих темах.
 const funnelStages = [
 { key: 'new', label: 'Новые', color: '#5A6B82', bg: 'color-mix(in srgb, #60A5FA 18%, var(--hp-surface))' },
 { key: 'showing', label: 'Показы', color: '#9C8B5A', bg: 'color-mix(in srgb, #FBBF24 18%, var(--hp-surface))' },
 { key: 'negotiation', label: 'Переговоры', color: '#8A6B3F', bg: 'color-mix(in srgb, #F97316 18%, var(--hp-surface))' },
 { key: 'contract', label: 'Договор', color: 'var(--hp-tertiary)', bg: 'color-mix(in srgb, #A78BFA 18%, var(--hp-surface))' },
 { key: 'payment', label: 'Оплата', color: '#22D3EE', bg: 'color-mix(in srgb, #22D3EE 18%, var(--hp-surface))' },
 { key: 'completed', label: 'Завершено', color: 'var(--hp-accent)', bg: 'color-mix(in srgb, #22C55E 18%, var(--hp-surface))' },
 ]
 const dealCounts = Object.fromEntries(
 funnelStages.map(s => [s.key, (dealsByStatus ?? []).filter(d => d.status === s.key).length])
 )
 const maxDeals = Math.max(...Object.values(dealCounts), 1)

 const roleLabels: Record<string, string> = { client: 'Клиент', owner: 'Собственник', both: 'Кл.+Собств.' }
 const dealStatusColors: Record<string, string> = {
 new: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]', showing: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]',
 negotiation: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]', contract: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]',
 payment: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]', completed: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]',
 cancelled: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]',
 }
 const priorityColors: Record<string, { bg: string; text: string; dot: string }> = {
 low: { bg: 'bg-[var(--hp-neutral-tint)]', text: 'text-[var(--hp-sub)]', dot: 'bg-[var(--hp-tertiary)]' },
 medium: { bg: 'bg-[var(--hp-warn-tint)]', text: 'text-[var(--hp-warn)]', dot: 'bg-[var(--hp-warn)]' },
 high: { bg: 'bg-[var(--hp-danger-tint)]', text: 'text-[var(--hp-danger)]', dot: 'bg-[var(--hp-danger)]' },
 }
 const priorityLabels: Record<string, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий' }
 const contactStatusColors: Record<string, string> = {
 new: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]', active: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]',
 vip: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]', inactive: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]',
 }
 const contactStatusLabels: Record<string, string> = {
 new: 'Новый', active: 'Активный', vip: 'VIP', inactive: 'Неактивный',
 }

 const today = new Date()
 const todayStr = today.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

 const kpiData = [
 { title: 'Новые лиды', value: newLeadsCount ?? 0, icon: 'Zap', color: 'var(--hp-info)', iconBg: 'color-mix(in srgb, #3B82F6 16%, var(--hp-surface))', href: '/leads', trend: '+12%', trendPos: true },
 { title: 'Активных сделок', value: activeDealsCount ?? 0, icon: 'TrendingUp', color: 'var(--hp-accent)', iconBg: 'color-mix(in srgb, #16A34A 16%, var(--hp-surface))', href: '/deals', trend: '+8%', trendPos: true },
 { title: 'Контактов', value: contactsCount ?? 0, icon: 'Users', color: 'var(--hp-sub)', iconBg: 'color-mix(in srgb, #8B5CF6 16%, var(--hp-surface))', href: '/contacts', trend: '+5%', trendPos: true },
 { title: 'Своб. объектов', value: propertiesCount ?? 0, icon: 'Home', color: 'var(--hp-accent)', iconBg: 'color-mix(in srgb, #10B981 16%, var(--hp-surface))', href: '/properties', trend: '0%', trendPos: null },
 { title: 'Активных догов.', value: contractsCount ?? 0, icon: 'FileText', color: 'var(--hp-warn)', iconBg: 'color-mix(in srgb, #F59E0B 16%, var(--hp-surface))', href: '/contracts', trend: '+3%', trendPos: true },
 { title: 'Задач в работе', value: activeTasksCount ?? 0, icon: 'CheckSquare', color: 'var(--hp-danger)', iconBg: 'color-mix(in srgb, #EF4444 16%, var(--hp-surface))', href: '/tasks', trend: '-2%', trendPos: false },
 ]

 return (
 <div className="space-y-6">

 {/* Page Header */}
 <PageHeader
 title="Дашборд"
 subtitle={<span className="capitalize">{todayStr}</span>}
 actions={
 <div className="flex items-center gap-2 flex-wrap">
 {(overdueTasksCount ?? 0) > 0 && (
 <Link href="/tasks" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[var(--hp-danger-tint)] text-[var(--hp-danger)] border border-[var(--hp-border)] hover:bg-[var(--hp-danger-tint)] transition-colors">
 <AlertTriangle style={{ width: 14, height: 14 }} />
 {overdueTasksCount} просроч. задач
 </Link>
 )}
 {(overduePaymentsCount ?? 0) > 0 && (
 <Link href="/payments" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[var(--hp-warn-tint)] text-[var(--hp-warn)] border border-[var(--hp-border)] hover:bg-[var(--hp-warn-tint)] transition-colors">
 <DollarSign style={{ width: 14, height: 14 }} />
 {overduePaymentsCount} просроч. платежей
 </Link>
 )}
 </div>
 }
 />

 {/* KPI Cards — animated client component */}
 <DashboardKpiCards cards={kpiData} />

 {/* Finance + Funnel */}
 <div className="grid lg:grid-cols-2 gap-4">

 {/* Finance */}
 <div className="hp-card p-5 h-full flex flex-col" style={{ }}>
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="font-bold text-foreground text-[16px] tracking-tight">Финансы</h2>
 <p className="text-xs text-muted-foreground mt-0.5 font-medium">Текущий месяц</p>
 </div>
 <Link href="/payments" className="flex items-center gap-1 text-xs text-[var(--hp-accent)] font-semibold hover:underline">
 Подробнее <ArrowUpRight style={{ width: 13, height: 13 }} />
 </Link>
 </div>

 <div className="grid grid-cols-2 gap-3 mb-5">
 {/* Paid */}
 <div className="p-4 relative overflow-hidden"
 style={{ background: 'var(--hp-good-tint)', border: '1px solid var(--hp-border)' }}>
 <div className="flex items-center gap-2 mb-3">
 <div className="w-8 h-8 flex items-center justify-center bg-[var(--hp-surface)]/80">
 <Banknote style={{ width: 15, height: 15, color: 'var(--hp-accent)' }} />
 </div>
 <p className="text-xs font-semibold text-[var(--hp-good)]">Получено</p>
 </div>
 <p className="text-xl font-bold text-foreground">
 {paidThisMonth.toLocaleString('ru-RU')} ₽
 </p>
 </div>
 {/* Pending */}
 <div className="p-4 relative overflow-hidden"
 style={{ background: 'var(--hp-warn-tint)', border: '1px solid var(--hp-border)' }}>
 <div className="flex items-center gap-2 mb-3">
 <div className="w-8 h-8 flex items-center justify-center bg-[var(--hp-surface)]/80">
 <Wallet style={{ width: 15, height: 15, color: 'var(--hp-warn)' }} />
 </div>
 <p className="text-xs font-semibold text-[var(--hp-warn)]">Ожидается</p>
 </div>
 <p className="text-xl font-bold text-foreground">
 {pendingThisMonth.toLocaleString('ru-RU')} ₽
 </p>
 </div>
 </div>

 {(overduePaymentsList?.length ?? 0) > 0 && (
 <div>
 <p className="text-xs font-bold text-[var(--hp-danger)] mb-3 flex items-center gap-1.5">
 <AlertTriangle style={{ width: 12, height: 12 }} />
 Просроченные платежи
 </p>
 <div className="space-y-2">
 {overduePaymentsList!.map(p => (
 <Link key={p.id} href={`/payments/${p.id}/edit`}
 className="flex items-center justify-between px-4 py-3 border transition-all"
 style={{ background: 'var(--hp-danger-tint)', borderColor: 'var(--hp-border)' }}>
 <div>
 {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
 <p className="text-xs font-bold text-foreground">{(p.contract as any)?.contract_number ?? 'Без договора'}</p>
 <p className="text-xs text-muted-foreground mt-0.5">
 {p.due_date ? formatDate(p.due_date) : '—'}
 </p>
 </div>
 <p className="text-sm font-bold text-[var(--hp-danger)]">{Number(p.amount).toLocaleString('ru-RU')} ₽</p>
 </Link>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Funnel */}
 <div className="hp-card p-5 h-full flex flex-col" style={{ }}>
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="font-bold text-foreground text-[16px] tracking-tight">Воронка сделок</h2>
 <p className="text-xs text-muted-foreground mt-0.5 font-medium">По стадиям</p>
 </div>
 <Link href="/deals" className="flex items-center gap-1 text-xs text-[var(--hp-accent)] font-semibold hover:underline">
 Все сделки <ArrowUpRight style={{ width: 13, height: 13 }} />
 </Link>
 </div>
 <div className="space-y-3">
 {funnelStages.map(stage => {
 const count = dealCounts[stage.key] ?? 0
 const pct = Math.round((count / maxDeals) * 100)
 return (
 <div key={stage.key} className="flex items-center gap-3">
 <span className="text-xs font-semibold text-muted-foreground w-24 shrink-0">{stage.label}</span>
 <div className="flex-1 h-8 overflow-hidden" style={{ background: 'var(--hp-surface)' }}>
 <div
 className="h-full flex items-center justify-end pr-3 transition-all duration-700"
 style={{
 width: count > 0 ? `${Math.max(pct, 8)}%` : '0%',
 background: count > 0 ? stage.color : 'transparent',
 minWidth: count > 0 ? '32px' : '0',
 }}
 >
 {count > 0 && <span className="text-white text-xs font-bold">{count}</span>}
 </div>
 </div>
 {count === 0 && <span className="text-xs text-[var(--hp-tertiary)] font-medium w-4">0</span>}
 </div>
 )
 })}
 </div>
 </div>
 </div>

 {/* 3-column */}
 <div className="grid lg:grid-cols-3 gap-4">

 {/* Recent contacts */}
 <div className="hp-card p-5 h-full flex flex-col" style={{ }}>
 <div className="flex items-center justify-between mb-5">
 <h2 className="font-bold text-foreground text-[15px]">Последние контакты</h2>
 <Link href="/contacts" className="text-xs text-[var(--hp-accent)] font-semibold flex items-center gap-0.5 hover:underline">
 Все <ArrowUpRight style={{ width: 12, height: 12 }} />
 </Link>
 </div>
 {!recentContacts?.length ? (
 <div className="text-center py-8">
 <div className="w-12 h-12 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] flex items-center justify-center mx-auto mb-3">
 <Users style={{ width: 20, height: 20 }} className="text-[var(--hp-tertiary)]" />
 </div>
 <p className="text-sm text-muted-foreground">Нет контактов</p>
 <Link href="/contacts/new" className="text-xs text-[var(--hp-accent)] hover:underline mt-1 block font-semibold">+ Добавить</Link>
 </div>
 ) : (
 <div className="space-y-1">
 {recentContacts.map(c => (
 <Link key={c.id} href={`/contacts/${c.id}`}
 className="flex items-center justify-between p-2.5 hover:bg-background transition-colors group">
 <div className="flex items-center gap-2.5 min-w-0">
 <div className="w-8 h-8 rounded-[var(--hp-radius)] flex items-center justify-center shrink-0 text-white text-xs font-bold"
 style={{ background: 'var(--hp-accent)' }}>
 {c.full_name?.charAt(0)?.toUpperCase()}
 </div>
 <div className="min-w-0">
 <p className="text-sm font-semibold text-foreground truncate group-hover:text-[var(--hp-accent)] transition-colors">{c.full_name}</p>
 <p className="text-xs text-muted-foreground">{roleLabels[c.role] ?? c.role}</p>
 </div>
 </div>
 <span className={`text-[10px] px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-bold shrink-0 ${contactStatusColors[c.status ?? ''] ?? 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]'}`}>
 {contactStatusLabels[c.status ?? ''] ?? c.status}
 </span>
 </Link>
 ))}
 </div>
 )}
 </div>

 {/* Recent deals */}
 <div className="hp-card p-5 h-full flex flex-col" style={{ }}>
 <div className="flex items-center justify-between mb-5">
 <h2 className="font-bold text-foreground text-[15px]">Последние сделки</h2>
 <Link href="/deals" className="text-xs text-[var(--hp-accent)] font-semibold flex items-center gap-0.5 hover:underline">
 Все <ArrowUpRight style={{ width: 12, height: 12 }} />
 </Link>
 </div>
 {!recentDeals?.length ? (
 <div className="text-center py-8">
 <div className="w-12 h-12 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] flex items-center justify-center mx-auto mb-3">
 <TrendingUp style={{ width: 20, height: 20 }} className="text-[var(--hp-tertiary)]" />
 </div>
 <p className="text-sm text-muted-foreground">Нет сделок</p>
 <Link href="/deals/new" className="text-xs text-[var(--hp-accent)] hover:underline mt-1 block font-semibold">+ Создать</Link>
 </div>
 ) : (
 <div className="space-y-1">
 {recentDeals.map(d => {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const clientName = (d.client_contact as any)?.full_name ?? (d.owner_contact as any)?.full_name
 return (
 <Link key={d.id} href={`/deals/${d.id}`}
 className="flex items-center justify-between p-2.5 hover:bg-background transition-colors group">
 <div className="min-w-0">
 <p className="text-sm font-semibold text-foreground group-hover:text-[var(--hp-accent)] transition-colors">{dealTypeLabels[d.deal_type] ?? d.deal_type}</p>
 <p className="text-xs text-muted-foreground truncate">{clientName ?? formatDate(d.created_at)}</p>
 </div>
 <div className="shrink-0 text-right">
 <span className={`text-[10px] px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-bold block ${dealStatusColors[d.status] ?? 'bg-[var(--hp-neutral-tint)]'}`}>
 {dealStatusLabels[d.status] ?? d.status}
 </span>
 {d.amount && <p className="text-xs text-muted-foreground mt-0.5 font-medium">{Number(d.amount).toLocaleString('ru-RU')} ₽</p>}
 </div>
 </Link>
 )
 })}
 </div>
 )}
 </div>

 {/* My tasks */}
 <div className="hp-card p-5 h-full flex flex-col" style={{ }}>
 <div className="flex items-center justify-between mb-5">
 <h2 className="font-bold text-foreground text-[15px]">Мои задачи</h2>
 <Link href="/tasks" className="text-xs text-[var(--hp-accent)] font-semibold flex items-center gap-0.5 hover:underline">
 Все <ArrowUpRight style={{ width: 12, height: 12 }} />
 </Link>
 </div>
 {!myTasks?.length ? (
 <div className="text-center py-8">
 <div className="w-12 h-12 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] flex items-center justify-center mx-auto mb-3">
 <CheckSquare style={{ width: 20, height: 20 }} className="text-[var(--hp-tertiary)]" />
 </div>
 <p className="text-sm text-muted-foreground">Нет активных задач</p>
 <Link href="/tasks/new" className="text-xs text-[var(--hp-accent)] hover:underline mt-1 block font-semibold">+ Создать задачу</Link>
 </div>
 ) : (
 <div className="space-y-2">
 {myTasks.map(task => {
 const isOverdue = task.deadline && new Date(task.deadline) < new Date()
 const pr = priorityColors[task.priority] ?? priorityColors.low
 return (
 <Link key={task.id} href={`/tasks/${task.id}`}>
 <div
 className="p-3 border transition-all cursor-pointer"
 style={isOverdue
 ? { background: 'var(--hp-danger-tint)', borderColor: 'var(--hp-border)' }
 : { background: 'var(--hp-surface)', borderColor: 'var(--hp-border)' }}>
 <div className="flex items-start justify-between gap-2">
 <p className="text-sm font-semibold text-foreground leading-snug">{task.title}</p>
 <span className={`text-[10px] px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-bold shrink-0 flex items-center gap-1 ${pr.bg} ${pr.text}`}>
 <span className={`w-1.5 h-1.5 rounded-full ${pr.dot}`} />
 {priorityLabels[task.priority] ?? task.priority}
 </span>
 </div>
 {task.deadline && (
 <div className={`flex items-center gap-1 mt-1.5 text-xs font-semibold ${isOverdue ? 'text-[var(--hp-danger)]' : 'text-muted-foreground'}`}>
 <Clock style={{ width: 11, height: 11 }} />
 {formatDate(task.deadline)}
 </div>
 )}
 </div>
 </Link>
 )
 })}
 </div>
 )}

 {(upcomingDeadlines?.length ?? 0) > 0 && (
 <div className="mt-4 pt-4 border-t border-[var(--hp-border-soft)]">
 <p className="text-xs font-bold text-muted-foreground mb-2.5 flex items-center gap-1.5 uppercase tracking-wide">
 <Calendar style={{ width: 11, height: 11 }} />
 Дедлайны · 7 дней
 </p>
 <div className="space-y-1.5">
 {upcomingDeadlines!.map(t => (
 <Link key={t.id} href={`/tasks/${t.id}`}
 className="flex items-center justify-between text-xs hover:bg-background transition-colors">
 <span className="text-[var(--hp-ink)] truncate max-w-32 font-medium">{t.title}</span>
 <span className="text-[var(--hp-tertiary)] shrink-0 ml-2 font-medium">
 {t.deadline ? formatDate(t.deadline, { day: 'numeric', month: 'short' }) : ''}
 </span>
 </Link>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 )
}
