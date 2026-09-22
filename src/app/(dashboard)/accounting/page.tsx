import { createClient } from '@/lib/supabase/server'
import { getAccountingStats, getMonthlyPnL, getCategoryBreakdown } from '@/features/accounting/actions/accounting.actions'
import { PnLChart } from '@/features/accounting/components/PnLChart'
import { CategoryPieChart } from '@/features/accounting/components/CategoryPieChart'
import { ExportCsvButton } from '@/features/accounting/components/ExportCsvButton'
import { TransactionsView, type TransactionRow } from '@/features/accounting/components/TransactionsView'
import { DollarSign, Plus, Tag, Landmark, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import type { AccountingTransaction } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { StatStrip } from '@/components/layout/StatStrip'
import { EmptyState } from '@/components/layout/EmptyState'
import { RecordActions } from '@/components/layout/RecordActions'
import { plural } from '@/lib/utils'


function fmt(n: number) { return n.toLocaleString('ru-RU') + ' ₽' }
function fmtDate(d: string) {
 return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function AccountingPage() {
 const supabase = await createClient()

 const [stats, chartData, incomePie, expensePie] = await Promise.all([
 getAccountingStats(),
 getMonthlyPnL(6),
 getCategoryBreakdown('income', 'month'),
 getCategoryBreakdown('expense', 'month'),
 ])

 const query = supabase
 .from('accounting_transactions')
 .select(`
 id, type, amount, date, description, status, payment_method,
 category:accounting_categories(id, name, color),
 contract:contracts(id, contract_number, contract_type),
 employee:users(id, full_name)
 `)
 .order('date', { ascending: false })
 .order('created_at', { ascending: false })
 .limit(500)

 const { data: rawTxns } = await query
 const transactions = (rawTxns ?? []) as unknown as AccountingTransaction[]

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
 }))

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

 {transactions.length > 0 && (
 <>
 <StatStrip
 items={[
 { label: 'Приход за месяц', value: fmt(stats.incomeThisMonth), hint: `всего ${fmt(stats.totalIncome)}` },
 { label: 'Расход за месяц', value: fmt(stats.expenseThisMonth), hint: `всего ${fmt(stats.totalExpense)}` },
 { label: 'Сальдо за месяц', value: fmt(stats.profitThisMonth), hint: `всего ${fmt(stats.profit)}`, alert: stats.profitThisMonth < 0 },
 { label: 'Запланировано', value: fmt(stats.plannedIncome - stats.plannedExpense), hint: `+${fmt(stats.plannedIncome)} / −${fmt(stats.plannedExpense)}` },
 ]}
 />
 <StatStrip
 items={[
 { label: 'Доход агентства за месяц', value: fmt(stats.agencyIncomeThisMonth), hint: `всего ${fmt(stats.agencyIncomeTotal)}` },
 { label: 'Расход агентства за месяц', value: fmt(stats.agencyExpenseThisMonth), hint: `всего ${fmt(stats.agencyExpenseTotal)}` },
 { label: 'Прибыль агентства за месяц', value: fmt(stats.agencyProfitThisMonth), hint: `всего ${fmt(stats.agencyProfitTotal)}`, alert: stats.agencyProfitThisMonth < 0 },
 { label: 'Транзит за месяц', value: fmt(stats.incomeThisMonth - stats.agencyIncomeThisMonth), hint: 'аренда клиентов и депозиты — не доход агентства' },
 ]}
 />
 </>
 )}

 {/* Charts row */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 <div
 className="lg:col-span-2 hp-card p-5"
 style={{ }}
 >
 <h2 className="hp-h2 mb-4">P&L — последние 6 месяцев</h2>
 <PnLChart data={chartData} />
 </div>
 <div
 className="hp-card p-5"
 style={{ }}
 >
 <h2 className="hp-h2 mb-4">Структура месяца</h2>
 <div className="space-y-5">
 <CategoryPieChart data={incomePie} title="Доходы" />
 <div className="border-t border-[var(--hp-border-soft)] pt-5">
 <CategoryPieChart data={expensePie} title="Расходы" />
 </div>
 </div>
 </div>
 </div>

 {/* Операции: поиск, фильтры и групповые действия — как в остальных реестрах */}
 {transactions.length === 0 ? (
 <EmptyState
 icon={<DollarSign className="w-5 h-5 text-[var(--hp-sub)]" />}
 title="Операций пока нет"
 description="Здесь учитываются доходы и расходы агентства: платежи по договорам попадают сюда сами, остальное добавляется вручную."
 actionHref="/accounting/transactions/new"
 actionLabel="Новая операция"
 />
 ) : (
 <TransactionsView transactions={rows} />
 )}
 </div>
 )
}
