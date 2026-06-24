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

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Выполнено',    cls: 'bg-green-50 text-green-700' },
  planned:   { label: 'Запланировано', cls: 'bg-amber-50 text-amber-700' },
  cancelled: { label: 'Отменено',     cls: 'bg-slate-50 text-slate-500' },
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
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      valueColor: 'text-green-700',
    },
    {
      label: 'Расходы за месяц',
      value: fmt(stats.expenseThisMonth),
      sub: `Всего: ${fmt(stats.totalExpense)}`,
      Icon: TrendingDown,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      valueColor: 'text-red-600',
    },
    {
      label: 'Прибыль за месяц',
      value: fmt(stats.profitThisMonth),
      sub: `Всего: ${fmt(stats.profit)}`,
      Icon: DollarSign,
      iconBg: stats.profitThisMonth >= 0 ? 'bg-blue-50' : 'bg-red-50',
      iconColor: stats.profitThisMonth >= 0 ? 'text-blue-600' : 'text-red-500',
      valueColor: stats.profitThisMonth >= 0 ? 'text-blue-700' : 'text-red-600',
    },
    {
      label: 'Запланировано',
      value: fmt(stats.plannedIncome - stats.plannedExpense),
      sub: `+${fmt(stats.plannedIncome)} / −${fmt(stats.plannedExpense)}`,
      Icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      valueColor: 'text-amber-700',
    },
  ]

  const typeFilters = [
    { value: 'all',     label: 'Все' },
    { value: 'income',  label: 'Доходы' },
    { value: 'expense', label: 'Расходы' },
  ]
  const statusFilters = [
    { value: 'all',       label: 'Все статусы' },
    { value: 'completed', label: 'Выполнено' },
    { value: 'planned',   label: 'Запланировано' },
    { value: 'cancelled', label: 'Отменено' },
  ]

  function buildHref(newType?: string, newStatus?: string) {
    const t = newType   ?? filterType   ?? 'all'
    const s = newStatus ?? filterStatus ?? 'all'
    const params = new URLSearchParams()
    if (t !== 'all') params.set('type', t)
    if (s !== 'all') params.set('status', s)
    const qs = params.toString()
    return '/accounting' + (qs ? `?${qs}` : '')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">
            Бухгалтерия
          </h1>
          <p className="text-[#64748B] mt-1 text-sm font-medium">
            {transactions.length} транзакций
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportCsvButton transactions={transactions} />
          <Link
            href="/accounting/recurring"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-[14px] text-sm font-semibold text-[#374151] hover:bg-slate-50 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Периодические
          </Link>
          <Link
            href="/accounting/categories"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-[14px] text-sm font-semibold text-[#374151] hover:bg-slate-50 transition-all"
          >
            <Tag className="w-4 h-4" />
            Категории
          </Link>
          <Link
            href="/accounting/transactions/new"
            className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all"
            style={{
              background: 'linear-gradient(135deg, #16A34A, #22C55E)',
              boxShadow: '0 4px 16px rgba(22,163,74,0.35)',
            }}
          >
            <Plus className="w-4 h-4" />
            Транзакция
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => {
          const Icon = card.Icon
          return (
            <div
              key={card.label}
              className="bg-white rounded-[20px] border border-slate-100 p-5"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-xs font-medium text-[#64748B] min-w-0 leading-tight break-words">
                  {card.label}
                </p>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
                  <Icon className={card.iconColor} style={{ width: 17, height: 17 }} />
                </div>
              </div>
              <p className={`text-xl font-bold ${card.valueColor}`}>{card.value}</p>
              <p className="text-xs text-[#94A3B8] mt-0.5 font-medium">{card.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          className="lg:col-span-2 bg-white rounded-[20px] border border-slate-100 p-5"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
        >
          <h2 className="font-bold text-[#111827] text-[15px] mb-4">P&L — последние 6 месяцев</h2>
          <PnLChart data={chartData} />
        </div>
        <div
          className="bg-white rounded-[20px] border border-slate-100 p-5"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
        >
          <h2 className="font-bold text-[#111827] text-[15px] mb-4">Структура месяца</h2>
          <div className="space-y-5">
            <CategoryPieChart data={incomePie}  title="Доходы" />
            <div className="border-t border-slate-100 pt-5">
              <CategoryPieChart data={expensePie} title="Расходы" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {typeFilters.map(f => {
            const isActive = (f.value === 'all' && !filterType) || filterType === f.value
            return (
              <Link
                key={f.value}
                href={buildHref(f.value)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${isActive ? 'bg-white text-[#111827] shadow-sm' : 'text-slate-500 hover:text-[#111827]'}`}
              >
                {f.label}
              </Link>
            )
          })}
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {statusFilters.map(f => {
            const isActive = (f.value === 'all' && !filterStatus) || filterStatus === f.value
            return (
              <Link
                key={f.value}
                href={buildHref(undefined, f.value)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${isActive ? 'bg-white text-[#111827] shadow-sm' : 'text-slate-500 hover:text-[#111827]'}`}
              >
                {f.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Transactions table */}
      <div
        className="bg-white rounded-[20px] border border-slate-100"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
      >
        {transactions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <DollarSign style={{ width: 20, height: 20 }} className="text-slate-400" />
            </div>
            <p className="text-[#374151] font-semibold">Транзакций нет</p>
            <Link
              href="/accounting/transactions/new"
              className="mt-2 inline-block text-sm text-green-600 hover:underline font-medium"
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
                  <tr className="border-b border-slate-100" style={{ background: '#F8FAFC' }}>
                    {['Тип', 'Дата', 'Сумма', 'Категория', 'Договор / Сотрудник', 'Статус', ''].map(h => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map(t => {
                    const sc = STATUS_CFG[t.status] ?? STATUS_CFG.completed
                    const isIncome = t.type === 'income'
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          {isIncome
                            ? <ArrowDownCircle className="w-4 h-4 text-green-500" />
                            : <ArrowUpCircle   className="w-4 h-4 text-red-400" />
                          }
                        </td>
                        <td className="px-5 py-3.5">
                          <Link href={`/accounting/transactions/${t.id}`} className="hover:text-blue-600 transition-colors group">
                            <p className="text-sm font-semibold text-[#111827] group-hover:text-blue-600">
                              {fmtDate(t.date)}
                            </p>
                            {t.description && (
                              <p className="text-xs text-[#64748B] mt-0.5 truncate max-w-[160px]">{t.description}</p>
                            )}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-sm font-bold ${isIncome ? 'text-green-700' : 'text-red-600'}`}>
                            {isIncome ? '+' : '−'}{fmt(Number(t.amount))}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {t.category ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#374151]">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: t.category.color }}
                              />
                              {t.category.name}
                            </span>
                          ) : (
                            <span className="text-xs text-[#94A3B8]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {t.contract?.contract_number && (
                            <Link
                              href={`/contracts/${t.contract.id}`}
                              className="text-xs font-medium text-blue-600 hover:underline"
                            >
                              №{t.contract.contract_number}
                            </Link>
                          )}
                          {t.employee?.full_name && (
                            <p className="text-xs text-[#64748B]">{t.employee.full_name}</p>
                          )}
                          {!t.contract && !t.employee && <span className="text-xs text-[#94A3B8]">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sc.cls}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1 justify-end">
                            <Link
                              href={`/accounting/transactions/${t.id}/edit`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
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
            <div className="md:hidden divide-y divide-slate-100">
              {transactions.map(t => {
                const sc = STATUS_CFG[t.status] ?? STATUS_CFG.completed
                const isIncome = t.type === 'income'
                return (
                  <div key={t.id} className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <Link href={`/accounting/transactions/${t.id}`} className="min-w-0">
                        <div className="flex items-center gap-2">
                          {isIncome
                            ? <ArrowDownCircle className="w-4 h-4 text-green-500 shrink-0" />
                            : <ArrowUpCircle   className="w-4 h-4 text-red-400 shrink-0" />
                          }
                          <p className="text-sm font-bold text-[#111827]">{fmtDate(t.date)}</p>
                        </div>
                        {t.description && (
                          <p className="text-xs text-[#64748B] mt-0.5 ml-6 truncate">{t.description}</p>
                        )}
                      </Link>
                      <p className={`text-base font-bold shrink-0 ${isIncome ? 'text-green-700' : 'text-red-600'}`}>
                        {isIncome ? '+' : '−'}{fmt(Number(t.amount))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap ml-6">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.cls}`}>{sc.label}</span>
                      {t.category && (
                        <span className="inline-flex items-center gap-1 text-xs text-[#64748B]">
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
