import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'
import { StatStrip } from '@/components/layout/StatStrip'
import { buttonVariants } from '@/components/ui/button'
import { ManagementView, type ManagementRow } from '@/features/management/components/ManagementView'
import { collectManagement } from '@/features/management/services/management.service'
import { formatAmount } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Объекты в доверительном управлении — раздел, который сводит вместе всё, что
 * до этого лежало по разным местам: договор управления, платежи по объекту,
 * счётчики и задачи. Объект попадает сюда, если у него deal_type = management
 * либо есть договор property_management.
 */
export default async function ManagementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rows: ManagementRow[] = await collectManagement(supabase)

  const incomeMonth = rows.reduce((sum, r) => sum + r.incomeMonth, 0)
  const expenseMonth = rows.reduce((sum, r) => sum + r.expenseMonth, 0)
  const overdue = rows.reduce((sum, r) => sum + r.overdueAmount, 0)
  const withoutContract = rows.filter(r => r.state === 'no_contract').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Объекты в управлении"
        subtitle={`${rows.length} объектов в доверительном управлении`}
        actions={
          <Link href="/management/new" className={buttonVariants({ size: 'sm' })}>
            <Plus style={{ width: 16, height: 16 }} />
            Принять объект
          </Link>
        }
      />

      {rows.length > 0 && (
        <StatStrip
          items={[
            { label: 'Объектов', value: rows.length, hint: withoutContract > 0 ? `${withoutContract} без договора` : 'все с договором' },
            { label: 'Доход за месяц', value: `${formatAmount(incomeMonth)} ₽` },
            { label: 'Расход за месяц', value: `${formatAmount(expenseMonth)} ₽` },
            { label: 'Прибыль за месяц', value: `${formatAmount(incomeMonth - expenseMonth)} ₽`, alert: incomeMonth - expenseMonth < 0 },
            { label: 'Просрочено', value: `${formatAmount(overdue)} ₽`, alert: overdue > 0 },
          ]}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-5 h-5 text-[var(--hp-sub)]" />}
          title="Объектов в управлении нет"
          description="Объект в управлении — тот, который агентство ведёт за собственника: приёмка, платежи, отчёты. Возьмите первый — из карточки объекта или отсюда."
          actionHref="/management/new"
          actionLabel="Взять объект в управление"
        />
      ) : (
        <ManagementView rows={rows} />
      )}
    </div>
  )
}
