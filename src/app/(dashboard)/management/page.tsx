import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
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
        <div className="hp-card hp-empty">
          <div className="w-12 h-12 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] flex items-center justify-center mx-auto mb-3">
            <Building2 style={{ width: 20, height: 20 }} className="text-[var(--hp-tertiary)]" />
          </div>
          <p className="text-[var(--hp-ink)] font-semibold">Объектов в управлении нет</p>
          <p className="text-[var(--hp-sub)] text-sm mt-1">
            Объект попадает сюда после приёма в управление — по подписанному договору
            управления или субаренды. Тип сделки «Управление» в карточке объекта сам по
            себе объект сюда не приводит: у обслуживания свои условия расчёта и свой срок
          </p>
          <Link href="/management/new" className="hp-btn-primary mt-5">
            <Plus style={{ width: 16, height: 16 }} />
            Принять объект в управление
          </Link>
        </div>
      ) : (
        <ManagementView rows={rows} />
      )}
    </div>
  )
}
