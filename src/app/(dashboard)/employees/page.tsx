import { createClient } from '@/lib/supabase/server'
import { Users, Shield, UserCheck, User, Plus } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'

const roleLabels: Record<string, string> = {
 admin: 'Администратор', manager: 'Менеджер',
 agent: 'Риелтор', accountant: 'Бухгалтер',
}
const roleColors: Record<string, string> = {
 admin: 'bg-[var(--hp-danger-tint)]/80 text-[var(--hp-danger)]',
 manager: 'bg-[var(--hp-info-tint)]/80 text-[var(--hp-info)]',
 agent: 'bg-[var(--hp-good-tint)]/80 text-[var(--hp-good)]',
 accountant: 'bg-[var(--hp-neutral-tint)]/80 text-[var(--hp-sub)]',
}
const roleIconColors: Record<string, string> = {
 admin: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]', manager: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]',
 agent: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]', accountant: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]',
}
const roleIcons: Record<string, typeof Shield> = {
 admin: Shield, manager: UserCheck, agent: User, accountant: User,
}

export default async function EmployeesPage() {
 const supabase = await createClient()

 const { data: employees } = await supabase
 .from('users')
 .select('id, full_name, email, role, phone, is_active, created_at')
 .order('created_at', { ascending: false })

 const empIds = employees?.map(e => e.id) ?? []
 const [{ data: contractStats }, { data: dealStats }] = await Promise.all([
 supabase.from('contracts').select('manager_id').in('manager_id', empIds),
 supabase.from('deals').select('manager_id').in('manager_id', empIds),
 ])

 const countBy = (arr: { manager_id: string }[] | null, id: string) =>
 (arr ?? []).filter(x => x.manager_id === id).length

 return (
 <div className="space-y-6">
 <PageHeader
 title="Сотрудники"
 subtitle={`${employees?.length ?? 0} сотрудников`}
 actions={
 <Link href="/employees/new" className={buttonVariants({ size: 'lg' })}>
 <Plus style={{ width: 16, height: 16 }} />
 Добавить
 </Link>
 }
 />

 {/* Role stats */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {(['admin', 'manager', 'agent', 'accountant'] as const).map(role => {
 const count = employees?.filter(e => e.role === role).length ?? 0
 const Icon = roleIcons[role]
 return (
 <div key={role} className="hp-card p-5 flex items-center gap-3 sm:gap-4">
 <div className={`w-11 h-11 flex items-center justify-center shrink-0 ${roleIconColors[role]}`}>
 <Icon style={{ width: 20, height: 20 }} />
 </div>
 <div className="min-w-0">
 <p className="text-2xl font-bold text-foreground">{count}</p>
 <p className="text-xs text-muted-foreground font-medium mt-0.5 leading-tight break-words">{roleLabels[role]}</p>
 </div>
 </div>
 )
 })}
 </div>

 {/* Employees list */}
 <div
 className="hp-card overflow-hidden"
 style={{ }}
 >
 {!employees?.length ? (
 <div className="text-center py-16">
 <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4"
 style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.1), rgba(34,197,94,0.1))' }}>
 <Users style={{ width: 24, height: 24, color: 'var(--hp-accent)' }} />
 </div>
 <p className="text-foreground font-bold text-base">Сотрудников ещё нет</p>
 <p className="text-muted-foreground text-sm mt-1">Добавьте первого сотрудника</p>
 <Link href="/employees/new"
 className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold transition-all"
 style={{ background: 'var(--hp-accent)', }}>
 <Plus style={{ width: 16, height: 16 }} />
 Добавить
 </Link>
 </div>
 ) : (
 <div className="divide-y divide-[var(--hp-border-soft)]">
 {employees.map(emp => {
 const Icon = roleIcons[emp.role] ?? User
 const deals = countBy(dealStats as { manager_id: string }[], emp.id)
 const contracts = countBy(contractStats as { manager_id: string }[], emp.id)

 return (
 <Link
 key={emp.id}
 href={`/employees/${emp.id}`}
 className="flex items-center gap-4 px-6 py-4 hover:bg-background transition-all duration-200 group"
 >
 {/* Avatar */}
 <div
 className="w-11 h-11 rounded-[var(--hp-radius)] flex items-center justify-center shrink-0 text-white text-sm font-bold"
 style={{ background: 'var(--hp-accent)', }}
 >
 {emp.full_name?.charAt(0)?.toUpperCase() ?? '?'}
 </div>

 {/* Info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap min-w-0">
 <p className="font-semibold text-foreground group-hover:text-[var(--hp-accent)] transition-colors text-sm truncate max-w-[200px] sm:max-w-none">
 {emp.full_name}
 </p>
 <span className={`text-[10px] px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-bold shrink-0 ${roleColors[emp.role] ?? 'bg-[var(--hp-neutral-tint)]'}`}>
 {roleLabels[emp.role] ?? emp.role}
 </span>
 {!emp.is_active && (
 <span className="text-[10px] px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-bold bg-[var(--hp-danger-tint)] text-[var(--hp-danger)] shrink-0">
 Неактивен
 </span>
 )}
 </div>
 <p className="text-xs text-muted-foreground mt-0.5 truncate">{emp.email}</p>
 {emp.phone && <p className="text-xs text-[var(--hp-tertiary)] truncate">{emp.phone}</p>}
 </div>

 {/* Stats */}
 <div className="hidden sm:flex items-center gap-6 shrink-0">
 <div className="text-center">
 <p className="text-lg font-bold text-foreground">{deals}</p>
 <p className="text-[10px] text-muted-foreground font-medium">Сделок</p>
 </div>
 <div className="text-center">
 <p className="text-lg font-bold text-foreground">{contracts}</p>
 <p className="text-[10px] text-muted-foreground font-medium">Договоров</p>
 </div>
 <div className="text-center">
 <p className="text-xs text-[var(--hp-tertiary)] font-medium">
 с {new Date(emp.created_at).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })}
 </p>
 </div>
 </div>
 </Link>
 )
 })}
 </div>
 )}
 </div>
 </div>
 )
}
