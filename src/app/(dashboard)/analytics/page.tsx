import {
 TrendingUp, Banknote, Users, Home,
 AlertTriangle, CheckCircle2, Clock, FileText,
} from 'lucide-react'
import {
 DealsAreaChart,
 DealFunnelChart,
 LeadsConversionChart,
 PaymentsMonthlyChart,
 DealTypePieChart,
 type MonthlyDealsData,
 type FunnelData,
 type LeadsConversionData,
 type PaymentMonthlyData,
 type DealTypeData,
} from '@/features/analytics/components/AnalyticsCharts'
import {
 getAnalyticsData,
 getLast12Months,
 monthLabel,
} from '@/features/analytics/data'
import { formatMoney } from '@/lib/utils'
import { DateRangePicker } from '@/features/analytics/components/DateRangePicker'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function AnalyticsPage({
 searchParams,
}: {
 searchParams: Promise<{ from?: string; to?: string }>
}) {
 const { from, to } = await searchParams

 const {
 deals,
 payments,
 leads,
 leadsConverted,
 properties,
 overduePayments,
 overdueTasks,
 contracts,
 } = await getAnalyticsData(from, to)

 const last12 = getLast12Months()

 // ── KPI ──────────────────────────────────────────────────────────────────────

 const totalRevenue = deals
 .filter(d => d.status === 'completed')
 .reduce((s, d) => s + Number(d.commission ?? 0), 0)

 const totalDealsAmount = deals
 .filter(d => d.status === 'completed')
 .reduce((s, d) => s + Number(d.amount ?? 0), 0)

 const activeDeals = deals.filter(d => !['completed', 'cancelled'].includes(d.status)).length
 const completedDeals = deals.filter(d => d.status === 'completed').length
 const conversionRate = leads.length > 0
 ? Math.round((leadsConverted.length / leads.length) * 100)
 : 0

 const paidTotal = payments
 .filter(p => p.payment_status === 'paid')
 .reduce((s, p) => s + Number(p.amount ?? 0), 0)

 const overdueTotal = payments
 .filter(p => p.payment_status === 'overdue')
 .reduce((s, p) => s + Number(p.amount ?? 0), 0)

 const availableProps = properties.filter(p => p.status === 'available').length
 const rentedProps = properties.filter(p => p.status === 'rented').length
 const soldProps = properties.filter(p => p.status === 'sold').length
 const activeContracts = contracts.filter(c => c.status === 'signed').length

 // ── Chart data ────────────────────────────────────────────────────────────────

 const monthlyDeals: MonthlyDealsData[] = last12.map(m => {
 const md = deals.filter(d => d.created_at?.startsWith(m))
 return {
 month: monthLabel(m),
 count: md.length,
 amount: md.reduce((s, d) => s + Number(d.amount ?? 0), 0),
 commission: md.reduce((s, d) => s + Number(d.commission ?? 0), 0),
 }
 })

 const funnelStages: FunnelData[] = (
 ['new', 'showing', 'negotiation', 'contract', 'payment', 'completed'] as const
 ).map((status, i) => ({
 stage: ['Новые', 'Показы', 'Переговоры', 'Договор', 'Оплата', 'Завершено'][i],
 color: ['#60A5FA', '#FBBF24', '#F97316', '#A78BFA', '#22D3EE', 'var(--hp-accent)'][i],
 count: deals.filter(d => d.status === status).length,
 }))

 const leadsConversionData: LeadsConversionData[] = last12.map(m => ({
 month: monthLabel(m),
 leads: leads.filter(l => l.created_at?.startsWith(m)).length,
 converted: leadsConverted.filter(l => l.created_at?.startsWith(m)).length,
 }))

 const paymentsMonthly: PaymentMonthlyData[] = last12.map(m => {
 const mp = payments.filter(p => p.created_at?.startsWith(m))
 return {
 month: monthLabel(m),
 paid: mp.filter(p => p.payment_status === 'paid').reduce((s, p) => s + Number(p.amount ?? 0), 0),
 pending: mp.filter(p => p.payment_status === 'pending').reduce((s, p) => s + Number(p.amount ?? 0), 0),
 overdue: mp.filter(p => p.payment_status === 'overdue').reduce((s, p) => s + Number(p.amount ?? 0), 0),
 }
 })

 const dealTypeMap: Record<string, { name: string; color: string }> = {
 rent: { name: 'Аренда', color: 'var(--hp-accent)' },
 sale: { name: 'Продажа', color: '#2563EB' },
 management: { name: 'Управление', color: '#7C3AED' },
 commercial: { name: 'Коммерция', color: '#EA580C' },
 subrent: { name: 'Субаренда', color: '#0891B2' },
 }
 const dealTypeCounts: Record<string, number> = {}
 for (const d of deals) {
 dealTypeCounts[d.deal_type] = (dealTypeCounts[d.deal_type] ?? 0) + 1
 }
 const dealTypePie: DealTypeData[] = Object.entries(dealTypeCounts)
 .filter(([, v]) => v > 0)
 .map(([k, v]) => ({
 name: dealTypeMap[k]?.name ?? k,
 value: v,
 color: dealTypeMap[k]?.color ?? '#94A3B8',
 }))
 .sort((a, b) => b.value - a.value)

 const priorityBadge: Record<string, string> = {
 high: 'bg-red-100 text-red-700',
 medium: 'bg-yellow-100 text-yellow-700',
 low: 'bg-slate-100 text-[var(--hp-sub)]',
 }
 const priorityLabel: Record<string, string> = {
 high: 'Высокий', medium: 'Средний', low: 'Низкий',
 }

 return (
 <div className="space-y-6">
 <PageHeader
 title="Аналитика"
 subtitle={from && to ? `${from} — ${to}` : 'Данные за последние 12 месяцев'}
 actions={<DateRangePicker from={from} to={to} />}
 />

 {/* KPI Cards */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 {[
 {
 label: 'Комиссия (закрытые)',
 value: formatMoney(totalRevenue),
 sub: `${completedDeals} сделок закрыто`,
 icon: <Banknote style={{ width: 20, height: 20 }} />,
 gradient: 'from-green-500 to-emerald-600',
 },
 {
 label: 'Объём сделок',
 value: formatMoney(totalDealsAmount),
 sub: `${activeDeals} в работе`,
 icon: <TrendingUp style={{ width: 20, height: 20 }} />,
 gradient: 'from-blue-500 to-blue-600',
 },
 {
 label: 'Платежи получены',
 value: formatMoney(paidTotal),
 sub: overdueTotal > 0 ? `Просрочено: ${formatMoney(overdueTotal)}` : 'Нет просроченных',
 icon: <CheckCircle2 style={{ width: 20, height: 20 }} />,
 gradient: 'from-violet-500 to-purple-600',
 },
 {
 label: 'Конверсия лидов',
 value: `${conversionRate}%`,
 sub: `${leads.length} лидов, ${leadsConverted.length} закрыто`,
 icon: <Users style={{ width: 20, height: 20 }} />,
 gradient: 'from-orange-500 to-orange-600',
 },
 ].map(card => (
 <div key={card.label} className="bg-white border border-border p-5">
 <div className={`w-10 h-10 bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white mb-3`}>
 {card.icon}
 </div>
 <p className="text-2xl font-bold text-foreground">{card.value}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
 <p className="text-xs text-[var(--hp-tertiary)] mt-1">{card.sub}</p>
 </div>
 ))}
 </div>

 {/* Secondary KPIs */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 {[
 { label: 'Объектов свободно', value: availableProps, icon: <Home style={{ width: 16, height: 16 }} />, color: 'text-green-600 bg-green-50' },
 { label: 'Сдано в аренду', value: rentedProps, icon: <Clock style={{ width: 16, height: 16 }} />, color: 'text-blue-600 bg-blue-50' },
 { label: 'Продано объектов', value: soldProps, icon: <CheckCircle2 style={{ width: 16, height: 16 }} />, color: 'text-violet-600 bg-violet-50' },
 { label: 'Активных договоров', value: activeContracts, icon: <FileText style={{ width: 16, height: 16 }} />, color: 'text-orange-600 bg-orange-50' },
 ].map(item => (
 <div key={item.label} className="bg-white border border-border p-4 flex items-center gap-3">
 <div className={`w-9 h-9 flex items-center justify-center ${item.color}`}>
 {item.icon}
 </div>
 <div>
 <p className="text-xl font-bold text-foreground">{item.value}</p>
 <p className="text-xs text-muted-foreground">{item.label}</p>
 </div>
 </div>
 ))}
 </div>

 {/* Charts row 1 */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="bg-white border border-border p-5">
 <h2 className="text-sm font-semibold text-foreground mb-4">Сумма и комиссия по сделкам</h2>
 <DealsAreaChart data={monthlyDeals} />
 <div className="flex items-center gap-4 mt-3">
 <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
 <span className="w-3 h-0.5 bg-green-600 inline-block" /> Сумма сделок
 </span>
 <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
 <span className="w-3 h-0.5 bg-blue-600 inline-block" /> Комиссия
 </span>
 </div>
 </div>
 <div className="bg-white border border-border p-5">
 <h2 className="text-sm font-semibold text-foreground mb-4">Воронка сделок</h2>
 <DealFunnelChart data={funnelStages} />
 </div>
 </div>

 {/* Charts row 2 */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="bg-white border border-border p-5">
 <h2 className="text-sm font-semibold text-foreground mb-4">Платежи по месяцам</h2>
 <PaymentsMonthlyChart data={paymentsMonthly} />
 </div>
 <div className="bg-white border border-border p-5">
 <h2 className="text-sm font-semibold text-foreground mb-4">Типы сделок</h2>
 {dealTypePie.length > 0 ? (
 <DealTypePieChart data={dealTypePie} />
 ) : (
 <div className="h-[220px] flex items-center justify-center text-sm text-[var(--hp-tertiary)]">
 Нет данных о сделках
 </div>
 )}
 </div>
 </div>

 {/* Chart row 3 */}
 <div className="bg-white border border-border p-5">
 <h2 className="text-sm font-semibold text-foreground mb-4">Лиды и конверсия по месяцам</h2>
 <LeadsConversionChart data={leadsConversionData} />
 </div>

 {/* Alerts row */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Overdue payments */}
 <div className="bg-white border border-border p-5">
 <div className="flex items-center gap-2 mb-4">
 <div className="w-7 h-7 bg-red-100 flex items-center justify-center">
 <AlertTriangle style={{ width: 14, height: 14, color: '#DC2626' }} />
 </div>
 <h2 className="text-sm font-semibold text-foreground">Просроченные платежи</h2>
 {overduePayments.length > 0 && (
 <span className="ml-auto text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-[var(--hp-radius-badge)]">
 {overduePayments.length}
 </span>
 )}
 </div>
 {overduePayments.length === 0 ? (
 <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200">
 <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--hp-accent)' }} />
 <p className="text-sm text-green-700 font-medium">Просроченных платежей нет</p>
 </div>
 ) : (
 <div className="space-y-2">
 {overduePayments.map(p => {
 const contract = p.contract as { contract_number?: string } | null
 const daysOverdue = p.due_date
 ? Math.floor((Date.now() - new Date(p.due_date).getTime()) / 86400000)
 : 0
 return (
 <a key={p.id} href={`/payments/${p.id}`}
 className="flex items-center justify-between p-3 border border-red-100 hover:border-red-300 hover:bg-red-50/40 transition-all group">
 <div>
 <p className="text-sm font-medium text-foreground group-hover:text-red-700 transition-colors">
 Договор № {contract?.contract_number ?? '—'}
 </p>
 <p className="text-xs text-red-500">Просрочен на {daysOverdue} дн.</p>
 </div>
 <p className="text-sm font-bold text-red-600">
 {formatMoney(Number(p.amount ?? 0))}
 </p>
 </a>
 )
 })}
 </div>
 )}
 </div>

 {/* Overdue tasks */}
 <div className="bg-white border border-border p-5">
 <div className="flex items-center gap-2 mb-4">
 <div className="w-7 h-7 bg-orange-100 flex items-center justify-center">
 <Clock style={{ width: 14, height: 14, color: '#EA580C' }} />
 </div>
 <h2 className="text-sm font-semibold text-foreground">Просроченные задачи</h2>
 {overdueTasks.length > 0 && (
 <span className="ml-auto text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-[var(--hp-radius-badge)]">
 {overdueTasks.length}
 </span>
 )}
 </div>
 {overdueTasks.length === 0 ? (
 <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200">
 <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--hp-accent)' }} />
 <p className="text-sm text-green-700 font-medium">Просроченных задач нет</p>
 </div>
 ) : (
 <div className="space-y-2">
 {overdueTasks.map(t => {
 const assignee = t.assignee as { full_name?: string } | null
 const daysOverdue = t.deadline
 ? Math.floor((Date.now() - new Date(t.deadline).getTime()) / 86400000)
 : 0
 return (
 <a key={t.id} href={`/tasks/${t.id}`}
 className="flex items-center justify-between p-3 border border-orange-100 hover:border-orange-300 hover:bg-orange-50/40 transition-all group">
 <div className="min-w-0">
 <p className="text-sm font-medium text-foreground group-hover:text-orange-700 transition-colors truncate">
 {t.title}
 </p>
 <p className="text-xs text-[var(--hp-tertiary)]">
 {assignee?.full_name ? `${assignee.full_name} · ` : ''}
 Просрочена на {daysOverdue} дн.
 </p>
 </div>
 <span className={`shrink-0 ml-2 text-xs font-medium px-2 py-0.5 rounded-[var(--hp-radius-badge)] ${priorityBadge[t.priority ?? 'medium']}`}>
 {priorityLabel[t.priority ?? 'medium']}
 </span>
 </a>
 )
 })}
 </div>
 )}
 </div>
 </div>
 </div>
 )
}
