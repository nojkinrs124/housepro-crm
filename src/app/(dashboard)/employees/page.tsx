import { createClient } from '@/lib/supabase/server'
import { Users, Plus } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { StatStrip } from '@/components/layout/StatStrip'
import { EmptyState } from '@/components/layout/EmptyState'
import { EmployeesView, ROLE_LABELS, type EmployeeRow } from '@/features/employees/components/EmployeesView'


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
    <div className="space-y-5">
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

      {rows.length > 1 && (
        <StatStrip
          items={(['admin', 'manager', 'agent', 'accountant'] as const).map(role => ({
            label: ROLE_LABELS[role],
            value: rows.filter(e => e.role === role).length,
          }))}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="w-5 h-5 text-[var(--hp-sub)]" />}
          title="Сотрудников пока нет"
          description="Пригласите коллегу по email — он получит письмо со ссылкой на вход и роль, которую вы выберете."
          actionHref="/employees/new"
          actionLabel="Пригласить сотрудника"
        />
      ) : (
        <EmployeesView employees={rows} />
      )}
    </div>
  )
}
