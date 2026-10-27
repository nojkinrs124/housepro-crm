import { createClient } from '@/lib/supabase/server'
import { ExportCsvButton } from '@/features/accounting/components/ExportCsvButton'
import { TransactionsView, type TransactionRow } from '@/features/accounting/components/TransactionsView'
import { AccountingFilters } from '@/features/accounting/components/AccountingFilters'
import { DollarSign, Plus, Tag, Landmark, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import type { AccountingTransaction } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/layout/EmptyState'
import { RecordActions } from '@/components/layout/RecordActions'
import { plural } from '@/lib/utils'
import { transactionDirection, type AccountingFilters as Filters } from '@/features/accounting/utils/direction'
import { isAgencyRevenue } from '@/features/accounting/utils/money-classification'
import type { DirectionCode } from '@/features/directions/config/directions'

/**
 * Бухгалтерия — ТОЛЬКО журнал операций: что и когда внесено, фильтры, поиск.
 * Разбор по направлениям, суммы по категориям, тренды, P&L — на /analytics
 * (решение владельца 27.10.2026: «в бухгалтерии — операции, в аналитике —
 * общая аналитика» — разделение по смыслу страницы, не по формуле расчёта).
 * Карточки Оборот/Доход/Прибыль и графики, которые были здесь раньше, —
 * перенесены на /analytics, см. PATCHLOG.
 */
export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string; property?: string; direction?: string }>
}) {
  const { employee, property, direction } = await searchParams
  const filters: Filters = {
    ...(employee && { employeeId: employee }),
    ...(property && { propertyId: property }),
    ...(direction && { direction: direction as DirectionCode }),
  }

  const supabase = await createClient()

  const [employeesRes, propertiesRes] = await Promise.all([
    supabase.from('users').select('id, full_name').order('full_name'),
    supabase.from('properties').select('id, title, address').order('title').limit(300),
  ])

  let query = supabase
    .from('accounting_transactions')
    .select(`
      id, type, amount, date, description, status, payment_method,
      employee_id, property_id, engagement_id,
      category:accounting_categories(id, name, color, code),
      contract:contracts(id, contract_number, contract_type),
      deal:deals(deal_type),
      employee:users(id, full_name)
    `)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)
  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
  if (filters.propertyId) query = query.eq('property_id', filters.propertyId)

  const { data: rawTxns } = await query
  const allTransactions = (rawTxns ?? []) as unknown as AccountingTransaction[]

  const transactions = filters.direction
    ? allTransactions.filter(t => transactionDirection({
        contractType: t.contract?.contract_type ?? null,
        engagementId: t.engagement_id ?? null,
        dealType: t.deal?.deal_type ?? null,
      }) === filters.direction)
    : allTransactions

  const rows: TransactionRow[] = transactions.map(t => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    date: t.date,
    description: t.description ?? null,
    status: t.status,
    categoryName: t.category?.name ?? null,
    categoryColor: t.category?.color ?? null,
    contractId: t.contract?.id ?? null,
    contractNumber: t.contract?.contract_number ?? null,
    employeeName: t.employee?.full_name ?? null,
    // Доход агентства vs транзит клиентов (аренда жильцов, депозиты) — видно
    // прямо в строке журнала бейджем «доход»/«транзит» (находка владельца
    // 27.10.2026: операции суммировались в одну колонку «Приход», скрывая,
    // что реально заработало агентство).
    isRealIncome: t.type === 'expense' ? null : isAgencyRevenue(t.category?.code ?? null, 'income'),
  }))

  const hasFilters = Boolean(employee || property || direction)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Бухгалтерия"
        subtitle={plural(transactions.length, ['операция', 'операции', 'операций'])}
        actions={
          <RecordActions
            primary={
              <Link href="/accounting/transactions/new" className={buttonVariants({ size: 'sm' })}>
                <Plus className="w-4 h-4" />
                Новая операция
              </Link>
            }
            more={
              <>
                <Link href="/accounting/bank-import" className="hp-menu-item" role="menuitem">
                  <Landmark className="w-4 h-4" />
                  Сверка с банком
                </Link>
                <Link href="/accounting/recurring" className="hp-menu-item" role="menuitem">
                  <RefreshCw className="w-4 h-4" />
                  Периодические операции
                </Link>
                <Link href="/accounting/categories" className="hp-menu-item" role="menuitem">
                  <Tag className="w-4 h-4" />
                  Категории
                </Link>
                <ExportCsvButton transactions={transactions} variant="menu" />
              </>
            }
          />
        }
      />

      <AccountingFilters
        direction={direction}
        employee={employee}
        property={property}
        employees={employeesRes.data ?? []}
        properties={propertiesRes.data ?? []}
      />

      {/* Операции: поиск, фильтры и групповые действия — как в остальных реестрах.
          Разбивка по направлениям/суммы по категориям — на /analytics. */}
      {transactions.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={<DollarSign className="w-5 h-5 text-[var(--hp-sub)]" />}
            title="По этому фильтру операций нет"
            description="Попробуйте выбрать другое направление, сотрудника или объект."
            actionHref="/accounting"
            actionLabel="Сбросить фильтры"
          />
        ) : (
          <EmptyState
            icon={<DollarSign className="w-5 h-5 text-[var(--hp-sub)]" />}
            title="Операций пока нет"
            description="Здесь учитываются доходы и расходы агентства: платежи по договорам попадают сюда сами, остальное добавляется вручную."
            actionHref="/accounting/transactions/new"
            actionLabel="Новая операция"
          />
        )
      ) : (
        <TransactionsView transactions={rows} />
      )}
    </div>
  )
}
