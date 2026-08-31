import { createClient } from '@/lib/supabase/server'
import { getAccountingStats, getMonthlyPnL, getCategoryBreakdown } from '@/features/accounting/actions/accounting.actions'
import { PnLChart } from '@/features/accounting/components/PnLChart'
import { CategoryPieChart } from '@/features/accounting/components/CategoryPieChart'
import { ExportCsvButton } from '@/features/accounting/components/ExportCsvButton'
import { DeleteTransactionButton } from '@/features/accounting/components/DeleteTransactionButton'
import {
 TrendingUp, TrendingDown, DollarSign, Clock,
 Plus, ArrowDownCircle, ArrowUpCircle, Pencil,
 RefreshCw, Tag,
} from 'lucide-react'
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

export default async function AccountingPage({
 searchParams,
}: {
 searchParams: Promise<{ type?: string; status?: string }>
}) {
 const { type: filterType, status: filterStatus } = await searchParams
 const supabase = await createClient()

 const [stats, chartData, incomePie, expensePie] = await Promise.all([
 getAccountingStats(),
 getMonthlyPnL(6),
 getCategoryBreakdown('income', 'month'),
 getCategoryBreakdown('expense', 'month'),
 ])

 let query = supabase
 .from('accounting_transactions')
 .select(`
 id, type, amount, date, description, status, payment_method,
 category:accounting_categories(id, name, color),
 contract:contracts(id, contract_number, contract_type),
 employee:users(id, full_name)
 `)
 .order('date', { ascending: false })
 .order('created_at', { ascending: false })
 .limit(50)

 if (filterType && filterType !== 'all') query = query.eq('type', filterType)
 if (filterStatus && filterStatus !== 'all') query = query.eq('status', filterStatus)

 const { data: rawTxns } = await query
 const transactions = (rawTxns ?? []) as unknown as AccountingTransaction[]

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

 const typeFilters = [
 { value: 'all', label: 'Все' },
 { value: 'income', label: 'Доходы' },
 { value: 'expense', label: 'Расходы' },
 ]
 const statusFilters = [
 { value: 'all', label: 'Все статусы' },
 { value: 'completed', label: 'Выполнено' },
 { value: 'planned', label: 'Запланировано' },
 { value: 'cancelled', label: 'Отменено' },
 ]

 function buildHref(newType?: string, newStatus?: string) {
 const t = newType ?? filterType ?? 'all'
 const s = newStatus ?? filterStatus ?? 'all'
 const params = new URLSearchParams()
 if (t !== 'all') params.set('type', t)
 if (s !== 'all') params.set('status', s)
 const qs = params.toString()
 return '/accounting' + (qs ? `?${qs}` : '')
 }

 return (
 <div className="space-y-6">
 <PageHeader
 title="Бухгалтерия"
 subtitle={`${transactions.length} транзакций`}
 actions={
 <div className="flex items-center gap-2 flex-wrap">
 <ExportCsvButton transactions={transactions} />
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

 {/* Filters */}
 <div className="flex flex-wrap gap-3 items-center">
 <div className="flex items-center gap-1 p-1 bg-[var(--hp-neutral-tint)] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
 {typeFilters.map(f => {
 const isActive = (f.value === 'all' && !filterType) || filterType === f.value
 return (
 <Link
 key={f.value}
 href={buildHref(f.value)}
 className={`px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap ${isActive ? 'bg-white text-foreground' : 'text-[var(--hp-sub)] hover:text-foreground'}`}
 >
 {f.label}
 </Link>
 )
 })}
 </div>
 <div className="flex items-center gap-1 p-1 bg-[var(--hp-neutral-tint)] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
 {statusFilters.map(f => {
 const isActive = (f.value === 'all' && !filterStatus) || filterStatus === f.value
 return (
 <Link
 key={f.value}
 href={buildHref(undefined, f.value)}
 className={`px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap ${isActive ? 'bg-white text-foreground' : 'text-[var(--hp-sub)] hover:text-foreground'}`}
 >
 {f.label}
 </Link>
 )
 })}
 </div>
 </div>

 {/* Transactions table */}
 <div
 className="hp-card"
 style={{ }}
 >
 {transactions.length === 0 ? (
 <div className="py-16 text-center">
 <div className="w-12 h-12 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] flex items-center justify-center mx-auto mb-3">
 <DollarSign style={{ width: 20, height: 20 }} className="text-[var(--hp-tertiary)]" />
 </div>
 <p className="text-[var(--hp-ink)] font-semibold">Транзакций нет</p>
 <Link
 href="/accounting/transactions/new"
 className="mt-2 inline-block text-sm text-[var(--hp-good)] hover:underline font-medium"
 >
 Создать первую транзакцию →
 </Link>
 </div>
 ) : (
 <>
 {/* Desktop */}
 <div className="hidden md:block w-full overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b border-[var(--hp-border-soft)]" style={{ background: '#FBFBF8' }}>
 {['Тип', 'Дата', 'Сумма', 'Категория', 'Договор / Сотрудник', 'Статус', ''].map(h => (
 <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
 {h}
 </th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--hp-border-soft)]">
 {transactions.map(t => {
 const sc = STATUS_CFG[t.status] ?? STATUS_CFG.completed
 const isIncome = t.type === 'income'
 return (
 <tr key={t.id} className="hover:bg-[var(--hp-neutral-tint)] transition-colors">
 <td className="px-5 py-3.5">
 {isIncome
 ? <ArrowDownCircle className="w-4 h-4 text-[var(--hp-good)]" />
 : <ArrowUpCircle className="w-4 h-4 text-[var(--hp-danger)]" />
 }
 </td>
 <td className="px-5 py-3.5">
 <Link href={`/accounting/transactions/${t.id}`} className="hover:text-[var(--hp-info)] transition-colors group">
 <p className="text-sm font-semibold text-foreground group-hover:text-[var(--hp-info)]">
 {fmtDate(t.date)}
 </p>
 {t.description && (
 <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">{t.description}</p>
 )}
 </Link>
 </td>
 <td className="px-5 py-3.5">
 <span className={`text-sm font-bold ${isIncome ? 'text-[var(--hp-good)]' : 'text-[var(--hp-danger)]'}`}>
 {isIncome ? '+' : '−'}{fmt(Number(t.amount))}
 </span>
 </td>
 <td className="px-5 py-3.5">
 {t.category ? (
 <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--hp-ink)]">
 <span
 className="w-2 h-2 rounded-full shrink-0"
 style={{ background: t.category.color }}
 />
 {t.category.name}
 </span>
 ) : (
 <span className="text-xs text-[var(--hp-tertiary)]">—</span>
 )}
 </td>
 <td className="px-5 py-3.5">
 {t.contract?.contract_number && (
 <Link
 href={`/contracts/${t.contract.id}`}
 className="text-xs font-medium text-[var(--hp-info)] hover:underline"
 >
 №{t.contract.contract_number}
 </Link>
 )}
 {t.employee?.full_name && (
 <p className="text-xs text-muted-foreground">{t.employee.full_name}</p>
 )}
 {!t.contract && !t.employee && <span className="text-xs text-[var(--hp-tertiary)]">—</span>}
 </td>
 <td className="px-5 py-3.5">
 <span className={`text-xs font-semibold px-2.5 py-1 rounded-[var(--hp-radius-badge)] ${sc.cls}`}>
 {sc.label}
 </span>
 </td>
 <td className="px-5 py-3.5">
 <div className="flex items-center gap-1 justify-end">
 <Link
 href={`/accounting/transactions/${t.id}/edit`}
 className="p-1.5 text-[var(--hp-tertiary)] hover:text-[var(--hp-good)] hover:bg-[var(--hp-good-tint)] transition-colors"
 title="Редактировать"
 >
 <Pencil style={{ width: 14, height: 14 }} />
 </Link>
 <DeleteTransactionButton id={t.id} />
 </div>
 </td>
 </tr>
 )
 })}
 </tbody>
 </table>
 </div>

 {/* Mobile */}
 <div className="md:hidden divide-y divide-[var(--hp-border-soft)]">
 {transactions.map(t => {
 const sc = STATUS_CFG[t.status] ?? STATUS_CFG.completed
 const isIncome = t.type === 'income'
 return (
 <div key={t.id} className="p-4">
 <div className="flex items-start justify-between gap-3 mb-2">
 <Link href={`/accounting/transactions/${t.id}`} className="min-w-0">
 <div className="flex items-center gap-2">
 {isIncome
 ? <ArrowDownCircle className="w-4 h-4 text-[var(--hp-good)] shrink-0" />
 : <ArrowUpCircle className="w-4 h-4 text-[var(--hp-danger)] shrink-0" />
 }
 <p className="text-sm font-bold text-foreground">{fmtDate(t.date)}</p>
 </div>
 {t.description && (
 <p className="text-xs text-muted-foreground mt-0.5 ml-6 truncate">{t.description}</p>
 )}
 </Link>
 <p className={`text-base font-bold shrink-0 ${isIncome ? 'text-[var(--hp-good)]' : 'text-[var(--hp-danger)]'}`}>
 {isIncome ? '+' : '−'}{fmt(Number(t.amount))}
 </p>
 </div>
 <div className="flex items-center gap-2 flex-wrap ml-6">
 <span className={`text-xs font-semibold px-2 py-0.5 rounded-[var(--hp-radius-badge)] ${sc.cls}`}>{sc.label}</span>
 {t.category && (
 <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
 <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.category.color }} />
 {t.category.name}
 </span>
 )}
 </div>
 </div>
 )
 })}
 </div>
 </>
 )}
 </div>
 </div>
 )
}
