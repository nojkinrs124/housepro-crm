import { createClient } from '@/lib/supabase/server'
import { Users, Shield, UserCheck, User, Plus } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { EmployeesView, ROLE_LABELS, type EmployeeRow } from '@/features/employees/components/EmployeesView'

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

  const countBy = (arr: { manager_id: string | null }[] | null, id: string) =>
    (arr ?? []).filter(x => x.manager_id === id).length

  const rows: EmployeeRow[] = (employees ?? []).map(e => ({
    id: e.id,
    fullName: e.full_name,
    email: e.email,
    phone: e.phone,
    role: e.role,
    isActive: e.is_active !== false,
    deals: countBy(dealStats, e.id),
    contracts: countBy(contractStats, e.id),
    createdAt: e.created_at,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Сотрудники"
        subtitle={`${rows.length} сотрудников`}
        actions={
          <Link href="/employees/new" className={buttonVariants({ size: 'sm' })}>
            <Plus style={{ width: 16, height: 16 }} />
            Пригласить
          </Link>
        }
      />

      {/* Role stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['admin', 'manager', 'agent', 'accountant'] as const).map(role => {
          const count = rows.filter(e => e.role === role).length
          const Icon = roleIcons[role]
          return (
            <div key={role} className="hp-card p-5 flex items-center gap-3 sm:gap-4">
              <div className={`w-11 h-11 flex items-center justify-center shrink-0 ${roleIconColors[role]}`}>
                <Icon style={{ width: 20, height: 20 }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5 leading-tight break-words">{ROLE_LABELS[role]}</p>
              </div>
            </div>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <div className="hp-card hp-empty">
          <div className="w-12 h-12 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] flex items-center justify-center mx-auto mb-3">
            <Users style={{ width: 20, height: 20 }} className="text-[var(--hp-tertiary)]" />
          </div>
          <p className="text-[var(--hp-ink)] font-semibold">Сотрудников ещё нет</p>
          <Link href="/employees/new" className="hp-btn-primary mt-5">
            <Plus style={{ width: 16, height: 16 }} />
            Пригласить сотрудника
          </Link>
        </div>
      ) : (
        <EmployeesView employees={rows} />
      )}
    </div>
  )
}
