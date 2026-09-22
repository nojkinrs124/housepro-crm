import { stagesOf, DIRECTION_SHORT_LABELS } from '@/features/directions/config/directions'
import { isDealSucceeded, isDealClosed, DEAL_TYPE_LABELS } from '@/features/deals/config/deal-stages'
import { DEAL_SOURCE_LABELS } from '@/features/deals/config/deal-sources'
import { CheckCircle2, Clock } from 'lucide-react'
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
import { CHART, CHART_SERIES } from '@/lib/design/chartColors'
import { isAgencyRevenue } from '@/features/accounting/utils/money-classification'
import {
 getAnalyticsData,
 getLast12Months,
 monthLabel,
 type AnalyticsRawData,
 type AnalyticsFilters as Filters,
} from '@/features/analytics/data'
import { formatMoney, plural } from '@/lib/utils'
import { AnalyticsFilters } from '@/features/analytics/components/AnalyticsFilters'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatStrip } from '@/components/layout/StatStrip'
import { createClient } from '@/lib/supabase/server'
import { todayIso } from '@/lib/timezone'
import type { DirectionCode } from '@/features/directions/config/directions'

/** Те же 4 формулы для текущего и предыдущего периода — иначе дельта считалась бы иначе, чем сама цифра. */
function computeKpis(data: Pick<AnalyticsRawData, 'payments' | 'deals' | 'leads' | 'leadsConverted'>) {
 const totalRevenue = data.payments
 .filter(p => p.payment_status === 'paid' && isAgencyRevenue(p.category_code, 'income'))
 .reduce((s, p) => s + Number(p.amount ?? 0), 0)
 const totalDealsAmount = data.deals
 .filter(d => isDealSucceeded(d.status, d.deal_type))
 .reduce((s, d) => s + Number(d.amount ?? 0), 0)
 const paidTotal = data.payments
 .filter(p => p.payment_status === 'paid')
 .reduce((s, p) => s + Number(p.amount ?? 0), 0)
 const conversionRate = data.leads.length > 0
 ? Math.round((data.leadsConverted.length / data.leads.length) * 100)
 : 0
 return { totalRevenue, totalDealsAmount, paidTotal, conversionRate }
}

/** «+12% к прошлому периоду» — null, когда сравнивать не с чем (прошлый период пуст). */
function delta(current: number, previous: number): string | null {
 if (previous === 0) return current === 0 ? null : 'нет данных за прошлый период'
 const pct = Math.round(((current - previous) / previous) * 100)
 return `${pct > 0 ? '+' : ''}${pct}% к прошлому периоду`
}

/** Конверсия — уже проценты, разницу показываем в процентных пунктах, а не в % от процента. */
function deltaPoints(current: number, previous: number): string | null {
 const diff = current - previous
 if (diff === 0) return null
 return `${diff > 0 ? '+' : ''}${diff} п.п. к прошлому периоду`
}

export default async function AnalyticsPage({
 searchParams,
}: {
 searchParams: Promise<{ from?: string; to?: string; employee?: string; property?: string; direction?: string }>
}) {
 const { from, to, employee, property, direction } = await searchParams
 const filters: Filters = {
 ...(employee && { employeeId: employee }),
 ...(property && { propertyId: property }),
 ...(direction && { direction: direction as DirectionCode }),
 }

 const last12 = getLast12Months()
 const resolvedFrom = from ?? `${last12[0]}-01`
 const resolvedTo = to ?? todayIso()

 // Предыдущий период той же длины, сразу перед текущим — для дельты в KPI.
 const prevToDate = new Date(resolvedFrom)
 prevToDate.setDate(prevToDate.getDate() - 1)
 const prevFromDate = new Date(prevToDate.getTime() - (new Date(resolvedTo).getTime() - new Date(resolvedFrom).getTime()))
 const prevFrom = prevFromDate.toISOString().slice(0, 10)
 const prevTo = prevToDate.toISOString().slice(0, 10)

 const supabase = await createClient()

 const [
 {
 deals,
 payments,
 leads,
 leadsConverted,
 properties,
 overdueTasks,
 contracts,
 },
 previousData,
 employeesRes,
 propertiesRes,
 ] = await Promise.all([
 getAnalyticsData(from, to, filters),
 getAnalyticsData(prevFrom, prevTo, filters),
 supabase.from('users').select('id, full_name').order('full_name'),
 supabase.from('properties').select('id, title, address').order('title').limit(300),
 ])

 // ── KPI ──────────────────────────────────────────────────────────────────────

 // Доход агентства — по проведённым операциям, а не по полю deals.commission:
 // поле заполняют не всегда, а деньги в бухгалтерии есть (проход 17.09.2026,
 // RA-11/TS-7). Платежи арендаторов и депозиты — не доход агентства; то же
 // определение (money-classification.ts) использует и Бухгалтерия, поэтому
 // цифры на двух страницах за один период не расходятся.
 const { totalRevenue, totalDealsAmount, paidTotal, conversionRate } = computeKpis({ payments, deals, leads, leadsConverted })
 const previousKpis = computeKpis(previousData)

 const activeDeals = deals.filter(d => !isDealClosed(d.status, d.deal_type)).length
 const completedDeals = deals.filter(d => isDealSucceeded(d.status, d.deal_type)).length

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

 // Общей воронки больше нет: у каждого направления своя. Когда направление не
 // выбрано фильтром явно, сводная диаграмма строится по самому массовому в
 // выборке — рисовать вперемешку стадии четырёх разных процессов бессмысленно.
 const dealsByDirection = new Map<string, typeof deals>()
 for (const d of deals) {
 const list = dealsByDirection.get(d.deal_type) ?? []
 list.push(d)
 dealsByDirection.set(d.deal_type, list)
 }
 const mainDirection = filters.direction ?? ([...dealsByDirection.entries()]
 .sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? 'rent_agent')
 const mainDirectionDeals = dealsByDirection.get(mainDirection) ?? []

 const funnelStages: FunnelData[] = stagesOf(mainDirection)
 .filter(stage => stage.value !== 'cancelled')
 .map((stage, i) => ({
 stage: stage.board,
 color: CHART_SERIES[i % CHART_SERIES.length],
 count: mainDirectionDeals.filter(d => d.status === stage.value).length,
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

 // Названия берутся из конфига направлений: своя копия словаря здесь осталась
 // на старых значениях (rent, commercial, subrent) и после перехода на
 // направления показывала бы в диаграмме сырые коды.
 const dealTypeMap: Record<string, { name: string; color: string }> = {
 rent_agent: { name: DIRECTION_SHORT_LABELS.rent_agent, color: 'var(--hp-accent)' },
 management: { name: DIRECTION_SHORT_LABELS.management, color: CHART.sub },
 sale: { name: DIRECTION_SHORT_LABELS.sale, color: CHART.info },
 tenant_search: { name: DIRECTION_SHORT_LABELS.tenant_search, color: 'var(--hp-warn)' },
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
 color: dealTypeMap[k]?.color ?? CHART.tertiary,
 }))
 .sort((a, b) => b.value - a.value)

 // Откуда приходят сделки: по этому срезу видно, какая площадка окупается.
 const sourceCounts: Record<string, number> = {}
 for (const d of deals) {
 const key = d.source || 'unknown'
 sourceCounts[key] = (sourceCounts[key] ?? 0) + 1
 }
 const sourcePie: DealTypeData[] = Object.entries(sourceCounts)
 .filter(([, v]) => v > 0)
 .map(([k, v], i) => ({
 name: DEAL_SOURCE_LABELS[k] ?? k,
 value: v,
 color: CHART_SERIES[i % CHART_SERIES.length],
 }))
 .sort((a, b) => b.value - a.value)

 const priorityBadge: Record<string, string> = {
 high: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]',
 medium: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]',
 low: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]',
 }
 const priorityLabel: Record<string, string> = {
 high: 'Высокий', medium: 'Средний', low: 'Низкий',
 }

 return (
 <div className="space-y-5">
 <PageHeader
 title="Аналитика"
 subtitle={from && to ? `${from} — ${to}` : 'Данные за последние 12 месяцев'}
 actions={
 <AnalyticsFilters
 from={from}
 to={to}
 direction={direction}
 employee={employee}
 property={property}
 employees={employeesRes.data ?? []}
 properties={propertiesRes.data ?? []}
 />
 }
 />

 <StatStrip
 items={[
 {
 label: 'Доход агентства', value: formatMoney(totalRevenue),
 hint: [plural(completedDeals, ['сделка закрыта', 'сделки закрыто', 'сделок закрыто']), delta(totalRevenue, previousKpis.totalRevenue)].filter(Boolean).join(' · '),
 },
 {
 label: 'Объём сделок', value: formatMoney(totalDealsAmount),
 hint: [`${activeDeals} в работе`, delta(totalDealsAmount, previousKpis.totalDealsAmount)].filter(Boolean).join(' · '),
 },
 {
 label: 'Платежи получены', value: formatMoney(paidTotal),
 hint: [overdueTotal > 0 ? `просрочено ${formatMoney(overdueTotal)}` : 'просроченных нет', delta(paidTotal, previousKpis.paidTotal)].filter(Boolean).join(' · '),
 alert: overdueTotal > 0,
 },
 {
 label: 'Конверсия лидов', value: `${conversionRate}%`,
 hint: [`${plural(leads.length, ['лид', 'лида', 'лидов'])}, ${leadsConverted.length} стали клиентами`, deltaPoints(conversionRate, previousKpis.conversionRate)].filter(Boolean).join(' · '),
 },
 ]}
 />

 <StatStrip
 items={[
 { label: 'Объектов свободно', value: availableProps },
 { label: 'Сдано в аренду', value: rentedProps },
 { label: 'Продано объектов', value: soldProps },
 { label: 'Действующих договоров', value: activeContracts },
 ]}
 />

 {/* Charts row 1 */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-5">
 <h2 className="text-sm font-semibold text-[var(--hp-ink)] mb-4">Сумма и комиссия по сделкам</h2>
 <DealsAreaChart data={monthlyDeals} />
 <div className="flex items-center gap-4 mt-3">
 <span className="flex items-center gap-1.5 text-xs text-[var(--hp-sub)]">
 <span className="w-3 h-0.5 bg-[var(--hp-accent)] inline-block" /> Сумма сделок
 </span>
 <span className="flex items-center gap-1.5 text-xs text-[var(--hp-sub)]">
 <span className="w-3 h-0.5 bg-[var(--hp-info)] inline-block" /> Комиссия
 </span>
 </div>
 </div>
 <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-5">
 <h2 className="text-sm font-semibold text-[var(--hp-ink)] mb-4">Воронка: {DEAL_TYPE_LABELS[mainDirection] ?? mainDirection}</h2>
 <DealFunnelChart data={funnelStages} />
 </div>
 </div>

 {/* Charts row 2 */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-5">
 <h2 className="text-sm font-semibold text-[var(--hp-ink)] mb-4">Платежи по месяцам</h2>
 <PaymentsMonthlyChart data={paymentsMonthly} />
 </div>
 <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-5">
 <h2 className="text-sm font-semibold text-[var(--hp-ink)] mb-4">Направления работы</h2>
 {dealTypePie.length > 0 ? (
 <DealTypePieChart data={dealTypePie} />
 ) : (
 <div className="h-[220px] flex items-center justify-center text-sm text-[var(--hp-tertiary)]">
 Нет данных о сделках
 </div>
 )}
 </div>
 <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-5">
 <h2 className="text-sm font-semibold text-[var(--hp-ink)] mb-4">Источники сделок</h2>
 {sourcePie.length > 0 ? (
 <DealTypePieChart data={sourcePie} />
 ) : (
 <div className="h-[220px] flex items-center justify-center text-sm text-[var(--hp-tertiary)]">
 Источник ни у одной сделки не указан
 </div>
 )}
 </div>
 </div>

 {/* Chart row 3 */}
 <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-5">
 <h2 className="text-sm font-semibold text-[var(--hp-ink)] mb-4">Лиды и конверсия по месяцам</h2>
 <LeadsConversionChart data={leadsConversionData} />
 </div>

 {/* Alerts row — просроченные платежи здесь не дублируются: тот же виджет уже
 есть на /dashboard, а полный список — в Бухгалтерии. */}
 <div className="grid grid-cols-1 gap-6">
 {/* Overdue tasks */}
 <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-5">
 <div className="flex items-center gap-2 mb-4">
 <div className="w-7 h-7 bg-[var(--hp-warn-tint)] flex items-center justify-center">
 <Clock style={{ width: 14, height: 14, color: 'var(--hp-warn)' }} />
 </div>
 <h2 className="text-sm font-semibold text-[var(--hp-ink)]">Просроченные задачи</h2>
 {overdueTasks.length > 0 && (
 <span className="ml-auto text-xs font-semibold bg-[var(--hp-warn-tint)] text-[var(--hp-warn)] px-2 py-0.5 rounded-[var(--hp-radius-badge)]">
 {overdueTasks.length}
 </span>
 )}
 </div>
 {overdueTasks.length === 0 ? (
 <div className="flex items-center gap-2 p-3 bg-[var(--hp-good-tint)] border border-[var(--hp-border)]">
 <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--hp-accent)' }} />
 <p className="text-sm text-[var(--hp-good)] font-medium">Просроченных задач нет</p>
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
 className="flex items-center justify-between p-3 border border-[var(--hp-border)] hover:border-[var(--hp-border)] hover:bg-[var(--hp-warn-tint)]/40 transition-all group">
 <div className="min-w-0">
 <p className="text-sm font-medium text-[var(--hp-ink)] group-hover:text-[var(--hp-warn)] transition-colors truncate">
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
