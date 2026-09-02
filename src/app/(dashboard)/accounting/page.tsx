import { createClient } from '@/lib/supabase/server'
import { getAccountingStats, getMonthlyPnL, getCategoryBreakdown } from '@/features/accounting/actions/accounting.actions'
import { PnLChart } from '@/features/accounting/components/PnLChart'
import { CategoryPieChart } from '@/features/accounting/components/CategoryPieChart'
import { ExportCsvButton } from '@/features/accounting/components/ExportCsvButton'
import { TransactionsView, type TransactionRow } from '@/features/accounting/components/TransactionsView'
import {
 TrendingUp, TrendingDown, DollarSign, Clock,
 Plus, ArrowDownCircle, ArrowUpCircle, Pencil,
 RefreshCw, Tag, Landmark } from 'lucide-react'
import Link from 'next/link'
import type { AccountingTransaction } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
 completed: { label: 'Выполнено', cls: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]' },
 planned: { label: 'Запланировано', cls: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]' },
 cancelled: { label: 'Отменено', cls: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]' },
}

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

 const statCards = [
 {
 label: 'Доходы за месяц',
 value: fmt(stats.incomeThisMonth),
 sub: `Всего: ${fmt(stats.totalIncome)}`,
 Icon: TrendingUp,
 iconBg: 'bg-[var(--hp-good-tint)]',
 iconColor: 'text-[var(--hp-good)]',
 valueColor: 'text-[var(--hp-good)]',
 },
 {
 label: 'Расходы за месяц',
 value: fmt(stats.expenseThisMonth),
 sub: `Всего: ${fmt(stats.totalExpense)}`,
 Icon: TrendingDown,
 iconBg: 'bg-[var(--hp-danger-tint)]',
 iconColor: 'text-[var(--hp-danger)]',
 valueColor: 'text-[var(--hp-danger)]',
 },
 {
 label: 'Прибыль за месяц',
 value: fmt(stats.profitThisMonth),
 sub: `Всего: ${fmt(stats.profit)}`,
 Icon: DollarSign,
 iconBg: stats.profitThisMonth >= 0 ? 'bg-[var(--hp-info-tint)]' : 'bg-[var(--hp-danger-tint)]',
 iconColor: stats.profitThisMonth >= 0 ? 'text-[var(--hp-info)]' : 'text-[var(--hp-danger)]',
 valueColor: stats.profitThisMonth >= 0 ? 'text-[var(--hp-info)]' : 'text-[var(--hp-danger)]',
 },
 {
 label: 'Запланировано',
 value: fmt(stats.plannedIncome - stats.plannedExpense),
 sub: `+${fmt(stats.plannedIncome)} / −${fmt(stats.plannedExpense)}`,
 Icon: Clock,
 iconBg: 'bg-[var(--hp-warn-tint)]',
 iconColor: 'text-[var(--hp-warn)]',
 valueColor: 'text-[var(--hp-warn)]',
 },
 ]

 return (
 <div className="space-y-6">
 <PageHeader
 title="Бухгалтерия"
 subtitle={`${transactions.length} транзакций`}
 actions={
 <div className="flex items-center gap-2 flex-wrap">
 <ExportCsvButton transactions={transactions} />
 <Link
 href="/accounting/bank-import"
 className="flex items-center gap-2 px-4 py-2.5 hp-card text-sm font-semibold text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-all"
 >
 <Landmark className="w-4 h-4" />
 Сверка с банком
 </Link>
 <Link
 href="/accounting/recurring"
 className="flex items-center gap-2 px-4 py-2.5 hp-card text-sm font-semibold text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-all"
 >
 <RefreshCw className="w-4 h-4" />
 Периодические
 </Link>
 <Link
 href="/accounting/categories"
 className="flex items-center gap-2 px-4 py-2.5 hp-card text-sm font-semibold text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-all"
 >
 <Tag className="w-4 h-4" />
 Категории
 </Link>
 <Link href="/accounting/transactions/new" className={buttonVariants({ size: 'lg' })}>
 <Plus className="w-4 h-4" />
 Транзакция
 </Link>
 </div>
 }
 />

 {/* Stat cards */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {statCards.map(card => {
 const Icon = card.Icon
 return (
 <div
 key={card.label}
 className="hp-card p-5"
 style={{ }}
 >
 <div className="flex items-center justify-between gap-2 mb-3">
 <p className="text-xs font-medium text-muted-foreground min-w-0 leading-tight break-words">
 {card.label}
 </p>
 <div className={`w-9 h-9 flex items-center justify-center shrink-0 ${card.iconBg}`}>
 <Icon className={card.iconColor} style={{ width: 17, height: 17 }} />
 </div>
 </div>
 <p className={`text-xl font-bold ${card.valueColor}`}>{card.value}</p>
 <p className="text-xs text-[var(--hp-tertiary)] mt-0.5 font-medium">{card.sub}</p>
 </div>
 )
 })}
 </div>

 {/* Charts row */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 <div
 className="lg:col-span-2 hp-card p-5"
 style={{ }}
 >
 <h2 className="font-bold text-foreground text-[15px] mb-4">P&L — последние 6 месяцев</h2>
 <PnLChart data={chartData} />
 </div>
 <div
 className="hp-card p-5"
 style={{ }}
 >
 <h2 className="font-bold text-foreground text-[15px] mb-4">Структура месяца</h2>
 <div className="space-y-5">
 <CategoryPieChart data={incomePie} title="Доходы" />
 <div className="border-t border-[var(--hp-border-soft)] pt-5">
 <CategoryPieChart data={expensePie} title="Расходы" />
 </div>
 </div>
 </div>
 </div>

 {/* Операции: поиск, фильтры и групповые действия — как в остальных реестрах */}
 <TransactionsView transactions={rows} />
 </div>
 )
}
