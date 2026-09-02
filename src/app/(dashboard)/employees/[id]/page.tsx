import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Shield, UserCheck, User, Mail, Phone, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateEmployeeAction, deactivateEmployeeAction, activateEmployeeAction } from '@/features/users/actions/users.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmployeeTargetPanel } from '@/features/users/components/EmployeeTargetPanel'
import { formatDate } from '@/lib/utils'

const roleLabels: Record<string, string> = {
 admin: 'Администратор', manager: 'Менеджер',
 agent: 'Риелтор', accountant: 'Бухгалтер',
}
const roleColors: Record<string, string> = {
 admin: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]', manager: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]',
 agent: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]', accountant: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]',
}

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params
 const supabase = await createClient()

 const [{ data: emp }, { data: authUser }] = await Promise.all([
 supabase.from('users').select('*').eq('id', id).single(),
 supabase.auth.getUser(),
 ])

 if (!emp) notFound()

 // Статистика + KPI
 const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

 // count: 'exact' + head: true возвращает число в `count`, а `data` при этом ВСЕГДА null.
 // Раньше здесь бралось `data`, и все четыре счётчика на карточке показывали 0.
 const [{ count: clientsCount }, { count: dealsCount }, { count: contractsCount }, { count: tasksCount },
 monthDeals, monthCompleted, { data: commissionData }] = await Promise.all([
 supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('manager_id', id),
 supabase.from('deals').select('id', { count: 'exact', head: true }).eq('manager_id', id),
 supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('manager_id', id),
 supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', id),
 supabase.from('deals').select('id', { count: 'exact', head: true }).eq('manager_id', id).gte('created_at', monthStart),
 supabase.from('deals').select('id', { count: 'exact', head: true }).eq('manager_id', id).eq('status', 'completed').gte('created_at', monthStart),
 supabase.from('deals').select('commission, amount').eq('manager_id', id).eq('status', 'completed').gte('created_at', monthStart),
 ])

 const closedDeals = (commissionData ?? []) as { commission: number | null; amount: number | null }[]
 const totalCommission = closedDeals.reduce((s: number, d) => s + Number(d.commission ?? 0), 0)
 const totalRevenue = closedDeals.reduce((s: number, d) => s + Number(d.amount ?? 0), 0)

 // План на текущий месяц: ключ — первое число месяца (см. targets.actions.ts).
 const periodMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
 const { data: target } = await supabase
 .from('employee_targets')
 .select('deals_target, revenue_target, commission_target, note')
 .eq('user_id', id)
 .eq('period_month', `${periodMonth}-01`)
 .maybeSingle()
 const conversionRate = (monthDeals.count ?? 0) > 0
 ? Math.round(((monthCompleted.count ?? 0) / (monthDeals.count ?? 1)) * 100)
 : 0

 // Текущий пользователь — для проверки прав
 const { data: currentUserProfile } = await supabase
 .from('users').select('role').eq('id', authUser.user?.id ?? '').single()
 const isAdmin = currentUserProfile?.role === 'admin'
 const isSelf = authUser.user?.id === id

 const boundUpdate = updateEmployeeAction.bind(null, id)

 const inp = 'w-full h-10 px-4 border border-input bg-background text-sm outline-none focus:border-[var(--hp-ink)]'
 const lbl = 'block text-sm font-medium text-foreground mb-1.5'

 return (
 <div className="max-w-3xl mx-auto space-y-6">
 <PageHeader
 title={emp.full_name}
 backHref="/employees"
 backLabel="Все сотрудники"
 iconBg="bg-primary/10"
 iconBoxClassName="w-16 h-16"
 icon={
 <span className="text-primary text-2xl font-bold">
 {emp.full_name?.charAt(0)?.toUpperCase() ?? '?'}
 </span>
 }
 subtitle={
 <>
 <span className="flex items-center gap-2 flex-wrap">
 <span className={`text-xs px-2.5 py-1 rounded-[var(--hp-radius-badge)] font-medium shrink-0 ${roleColors[emp.role] ?? 'bg-[var(--hp-neutral-tint)]'}`}>
 {roleLabels[emp.role] ?? emp.role}
 </span>
 {emp.is_active ? (
 <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-[var(--hp-radius-badge)] font-medium bg-[var(--hp-good-tint)] text-[var(--hp-good)] shrink-0">
 <CheckCircle className="w-3 h-3" /> Активен
 </span>
 ) : (
 <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-[var(--hp-radius-badge)] font-medium bg-[var(--hp-danger-tint)] text-[var(--hp-danger)] shrink-0">
 <XCircle className="w-3 h-3" /> Неактивен
 </span>
 )}
 </span>
 <span className="block mt-1">
 В системе с {formatDate(emp.created_at, { month: 'long', year: 'numeric' })}
 </span>
 </>
 }
 />

 {/* Общая статистика */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
 {[
 { label: 'Контактов', value: clientsCount ?? 0, sub: 'всего' },
 { label: 'Сделок', value: dealsCount ?? 0, sub: 'всего' },
 { label: 'Договоров', value: contractsCount ?? 0, sub: 'всего' },
 { label: 'Задач', value: tasksCount ?? 0, sub: 'назначено' },
 ].map(s => (
 <div key={s.label} className="hp-card p-4 text-center">
 <p className="text-2xl font-bold text-foreground">{s.value}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
 <p className="text-xs text-muted-foreground/60">{s.sub}</p>
 </div>
 ))}
 </div>

 {/* План и факт — над фактическими KPI: сначала «сколько нужно», потом «сколько есть» */}
 <EmployeeTargetPanel
 userId={id}
 period={periodMonth}
 target={target ?? null}
 fact={{
 deals: monthCompleted.count ?? 0,
 revenue: totalRevenue,
 commission: totalCommission,
 }}
 canEdit={currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'manager'}
 />

 {/* KPI текущего месяца */}
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4">KPI за текущий месяц</h2>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
 {[
 { label: 'Сделок открыто', value: monthDeals.count ?? 0, color: 'text-[var(--hp-info)]', bg: 'bg-[var(--hp-info-tint)]' },
 { label: 'Сделок закрыто', value: monthCompleted.count ?? 0, color: 'text-[var(--hp-good)]', bg: 'bg-[var(--hp-good-tint)]' },
 { label: 'Конверсия', value: `${conversionRate}%`, color: 'text-[var(--hp-sub)]', bg: 'bg-[var(--hp-neutral-tint)]' },
 { label: 'Комиссия', value: totalCommission > 0 ? `${(totalCommission / 1000).toFixed(0)}к ₽` : '—', color: 'text-[var(--hp-warn)]', bg: 'bg-[var(--hp-warn-tint)]' },
 ].map(k => (
 <div key={k.label} className={`${k.bg} p-4 text-center`}>
 <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
 </div>
 ))}
 </div>
 </div>

 {/* Контакты */}
 <div className="hp-card p-5 space-y-3">
 <h2 className="font-semibold text-foreground">Контакты</h2>
 {emp.email && (
 <div className="flex items-center gap-3 text-sm min-w-0">
 <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
 <a href={`mailto:${emp.email}`} className="text-foreground hover:text-primary transition truncate">{emp.email}</a>
 </div>
 )}
 {emp.phone && (
 <div className="flex items-center gap-3 text-sm min-w-0">
 <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
 <a href={`tel:${emp.phone}`} className="text-foreground hover:text-primary transition truncate">{emp.phone}</a>
 </div>
 )}
 </div>

 {/* Редактирование — только для admin */}
 {isAdmin && (
 <div className="hp-card p-6 space-y-5">
 <h2 className="font-semibold text-foreground">Редактировать</h2>

 <ServerActionForm action={boundUpdate} className="space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className={lbl}>Полное имя</label>
 <input name="full_name" required defaultValue={emp.full_name ?? ''} className={inp} />
 </div>
 <div>
 <label className={lbl}>Телефон</label>
 <input name="phone" type="tel" defaultValue={emp.phone ?? ''} placeholder="+7 (999) 000-00-00" className={inp} />
 </div>
 <div>
 <label className={lbl}>Внутренний номер в АТС</label>
 <input name="phone_extension" defaultValue={emp.phone_extension ?? ''} placeholder="101" className={inp} />
 <p className="text-xs text-[var(--hp-sub)] mt-1">
 Нужен, чтобы звонки из телефонии подписывались этим сотрудником
 </p>
 </div>
 </div>
 <div>
 <label className={lbl}>Роль</label>
 <select name="role" defaultValue={emp.role}
 className="w-full h-10 px-4 border border-input bg-background text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer">
 <option value="admin">Администратор</option>
 <option value="manager">Менеджер</option>
 <option value="agent">Риелтор</option>
 <option value="accountant">Бухгалтер</option>
 </select>
 </div>
 <button type="submit"
 className="w-full h-10 text-white text-sm font-bold transition" style={{ background: 'var(--hp-accent)', }}>
 Сохранить изменения
 </button>
 </ServerActionForm>

 {/* Деактивация */}
 {!isSelf && (
 <div className="pt-4 border-t border-border">
 {emp.is_active ? (
 <ServerActionForm action={deactivateEmployeeAction.bind(null, id)}>
 <button type="submit"
 className="w-full h-10 border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition">
 Деактивировать сотрудника
 </button>
 </ServerActionForm>
 ) : (
 <ServerActionForm action={activateEmployeeAction.bind(null, id)}>
 <button type="submit"
 className="w-full h-10 border border-[var(--hp-border)] text-[var(--hp-good)] text-sm font-medium hover:bg-[var(--hp-good-tint)] transition">
 Восстановить доступ
 </button>
 </ServerActionForm>
 )}
 </div>
 )}
 </div>
 )}
 </div>
 )
}
