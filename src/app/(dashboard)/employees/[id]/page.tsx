import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Shield, UserCheck, User, Mail, Phone, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateEmployeeAction, deactivateEmployeeAction, activateEmployeeAction } from '@/features/users/actions/users.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { PageHeader } from '@/components/layout/PageHeader'

const roleLabels: Record<string, string> = {
 admin: 'Администратор', manager: 'Менеджер',
 agent: 'Риелтор', accountant: 'Бухгалтер',
}
const roleColors: Record<string, string> = {
 admin: 'bg-red-100 text-red-700', manager: 'bg-blue-100 text-blue-700',
 agent: 'bg-green-100 text-green-700', accountant: 'bg-purple-100 text-purple-700',
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

 const [{ data: clientStats }, { data: dealStats }, { data: contractStats }, { data: taskStats },
 monthDeals, monthCompleted, { data: commissionData }] = await Promise.all([
 supabase.from('clients').select('id', { count: 'exact', head: true }).eq('manager_id', id),
 supabase.from('deals').select('id', { count: 'exact', head: true }).eq('manager_id', id),
 supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('manager_id', id),
 supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', id),
 supabase.from('deals').select('id', { count: 'exact', head: true }).eq('manager_id', id).gte('created_at', monthStart),
 supabase.from('deals').select('id', { count: 'exact', head: true }).eq('manager_id', id).eq('status', 'completed').gte('created_at', monthStart),
 supabase.from('deals').select('commission').eq('manager_id', id).eq('status', 'completed').gte('created_at', monthStart),
 ])

 const totalCommission = (commissionData ?? []).reduce((s: number, d: { commission: number | null }) => s + Number(d.commission ?? 0), 0)
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
 <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${roleColors[emp.role] ?? 'bg-gray-100'}`}>
 {roleLabels[emp.role] ?? emp.role}
 </span>
 {emp.is_active ? (
 <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700 shrink-0">
 <CheckCircle className="w-3 h-3" /> Активен
 </span>
 ) : (
 <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-600 shrink-0">
 <XCircle className="w-3 h-3" /> Неактивен
 </span>
 )}
 </span>
 <span className="block mt-1">
 В системе с {new Date(emp.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
 </span>
 </>
 }
 />

 {/* Общая статистика */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
 {[
 { label: 'Клиентов', value: clientStats?.length ?? 0, sub: 'всего' },
 { label: 'Сделок', value: dealStats?.length ?? 0, sub: 'всего' },
 { label: 'Договоров', value: contractStats?.length ?? 0, sub: 'всего' },
 { label: 'Задач', value: taskStats?.length ?? 0, sub: 'назначено' },
 ].map(s => (
 <div key={s.label} className="hp-card p-4 text-center">
 <p className="text-2xl font-bold text-foreground">{s.value}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
 <p className="text-xs text-muted-foreground/60">{s.sub}</p>
 </div>
 ))}
 </div>

 {/* KPI текущего месяца */}
 <div className="hp-card p-5">
 <h2 className="font-semibold text-foreground mb-4">KPI за текущий месяц</h2>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
 {[
 { label: 'Сделок открыто', value: monthDeals.count ?? 0, color: 'text-blue-600', bg: 'bg-blue-50' },
 { label: 'Сделок закрыто', value: monthCompleted.count ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
 { label: 'Конверсия', value: `${conversionRate}%`, color: 'text-violet-600', bg: 'bg-violet-50' },
 { label: 'Комиссия', value: totalCommission > 0 ? `${(totalCommission / 1000).toFixed(0)}к ₽` : '—', color: 'text-amber-600', bg: 'bg-amber-50' },
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
 className="w-full h-10 border border-green-300 text-green-700 text-sm font-medium hover:bg-green-50 transition">
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
