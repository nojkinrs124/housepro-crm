import { stagesOf, DIRECTION_SHORT_LABELS, DIRECTION_VALUES, type DirectionCode } from '@/features/directions/config/directions'
import { isDealSucceeded, isDealClosed, DEAL_TYPE_LABELS } from '@/features/deals/config/deal-stages'
import { DEAL_SOURCE_LABELS } from '@/features/deals/config/deal-sources'
import { CheckCircle2, Clock, Info } from 'lucide-react'
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
import { PnLChart } from '@/features/accounting/components/PnLChart'
import { CategoryPieChart } from '@/features/accounting/components/CategoryPieChart'
import { getMonthlyPnL, getCategoryBreakdown } from '@/features/accounting/actions/accounting.actions'
import { CHART, CHART_SERIES } from '@/lib/design/chartColors'
import { isAgencyRevenue, isAgencyExpense, PASS_THROUGH_INCOME_CODES, OWNER_PAYOUT_CODE } from '@/features/accounting/utils/money-classification'
import {
  getAnalyticsData,
  getLast12Months,
  monthLabel,
  type AnalyticsRawData,
  type AnalyticsFilters as Filters,
} from '@/features/analytics/data'
import { formatMoney, plural, formatMoneyShort } from '@/lib/utils'
import { AnalyticsFilters } from '@/features/analytics/components/AnalyticsFilters'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatStrip } from '@/components/layout/StatStrip'
import { createClient } from '@/lib/supabase/server'
import { todayIso } from '@/lib/timezone'

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
 transactions,
 leads,
 leadsConverted,
 properties,
 overdueTasks,
 contracts,
 },
 previousData,
 employeesRes,
 propertiesRes,
 pnlChartData,
 incomePie,
 expensePie,
 ] = await Promise.all([
 getAnalyticsData(from, to, filters),
 getAnalyticsData(prevFrom, prevTo, filters),
 supabase.from('users').select('id, full_name').order('full_name'),
 supabase.from('properties').select('id, title, address').order('title').limit(300),
 // P&L и структура по категориям — перенесены сюда со старой /accounting
 // (решение владельца 27.10.2026: бухгалтерия — журнал, аналитика — графики).
 getMonthlyPnL(12, filters),
 getCategoryBreakdown('income', 'month', filters),
 getCategoryBreakdown('expense', 'month', filters),
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

 // ── Доход/расход по направлениям (решение владельца 27.10.2026) ────────────────
 //
 // «Аренда/Продажа/Управление/Поиск жилья/Прочее» — те же 4 направления, что
 // ведёт CRM в сделках и договорах (features/directions/config/directions.ts),
 // плюс «Прочее» для операций без направления (партнёрские комиссии и т.п.,
 // не привязанные ни к сделке, ни к договору, ни к управлению). Доход/расход
 // внутри направления — тем же предикатом isAgencyRevenue/isAgencyExpense,
 // что и Бухгалтерия: транзит клиентов (аренда жильцов, депозиты) и выплаты
 // собственникам НЕ считаются ни доходом, ни расходом агентства.
 //
 // directionGuessed: когда у операции нет прямой связи со сделкой/обслуживанием/
 // договором, direction подбирается по категории/тексту назначения
 // (guessTransactionDirectionFromText в analytics/data) — находка 27.10.2026:
 // без этого 85% реального дохода оседало в «Прочее», хотя из текста операции
 // направление легко угадывалось («Управление, ул. Молокова»). guessedIncome
 // ниже — сколько из дохода направления определено ТАК, а не точной связью,
 // чтобы честно показать владельцу долю предположений, а не выдавать их за факт.
 type DirectionBreakdownRow = { code: DirectionCode | 'other'; label: string; income: number; expense: number; profit: number; guessedIncome: number }
 const directionTotals = new Map<string, { income: number; expense: number; guessedIncome: number }>()
 for (const t of transactions) {
 const key = t.direction ?? 'other'
 const entry = directionTotals.get(key) ?? { income: 0, expense: 0, guessedIncome: 0 }
 if (t.type === 'income' && isAgencyRevenue(t.categoryCode, 'income')) {
 entry.income += Number(t.amount ?? 0)
 if (t.directionGuessed) entry.guessedIncome += Number(t.amount ?? 0)
 }
 if (t.type === 'expense' && isAgencyExpense(t.categoryCode, 'expense', null)) entry.expense += Number(t.amount ?? 0)
 directionTotals.set(key, entry)
 }
 const directionBreakdown: DirectionBreakdownRow[] = [...DIRECTION_VALUES, 'other' as const]
 .map(code => {
 const t = directionTotals.get(code) ?? { income: 0, expense: 0, guessedIncome: 0 }
 return {
 code,
 label: code === 'other' ? 'Прочее' : DIRECTION_SHORT_LABELS[code],
 income: t.income,
 expense: t.expense,
 profit: t.income - t.expense,
 guessedIncome: t.guessedIncome,
 }
 })
 .filter(row => row.income > 0 || row.expense > 0)
 const directionTotalIncome = directionBreakdown.reduce((s, r) => s + r.income, 0)
 const transitTotal = transactions
 .filter(t => t.type === 'income' && PASS_THROUGH_INCOME_CODES.has(t.categoryCode ?? ''))
 .reduce((s, t) => s + Number(t.amount ?? 0), 0)
 const ownerPayoutTotal = transactions
 .filter(t => t.type === 'expense' && t.categoryCode === OWNER_PAYOUT_CODE)
 .reduce((s, t) => s + Number(t.amount ?? 0), 0)

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
 label: 'Доход', value: formatMoneyShort(totalRevenue),
 hint: [plural(completedDeals, ['сделка закрыта', 'сделки закрыто', 'сделок закрыто']), delta(totalRevenue, previousKpis.totalRevenue)].filter(Boolean).join(' · '),
 },
 {
 label: 'Объём сделок', value: formatMoneyShort(totalDealsAmount),
 hint: [`${activeDeals} в работе`, delta(totalDealsAmount, previousKpis.totalDealsAmount)].filter(Boolean).join(' · '),
 },
 {
 label: 'Платежи получены', value: formatMoneyShort(paidTotal),
 hint: [overdueTotal > 0 ? `просрочено ${formatMoneyShort(overdueTotal)}` : 'просроченных нет', delta(paidTotal, previousKpis.paidTotal)].filter(Boolean).join(' · '),
 alert: overdueTotal > 0,
 },
 {
 label: 'Конверсия лидов', value: `${conversionRate}%`,
 hint: [`${plural(leads.length, ['лид', 'лида', 'лидов'])}, ${leadsConverted.length} стали клиентами`, deltaPoints(conversionRate, previousKpis.conversionRate)].filter(Boolean).join(' · '),
 },
 ]}
 />

 {/* Доход/расход по направлениям — главная находка владельца 27.10.2026:
     одна цифра «Доход» не показывает, откуда он взялся. Таблица ниже
     раскладывает ровно то же определение дохода/расхода агентства на
     направления и явно отделяет транзит клиентов/выплаты собственникам,
     которые вообще не доход и не расход — просто проходящие через кассу
     деньги (аренда жильцов, депозиты, выплаты за управление). */}
 <div className="hp-card p-5">
 <h2 className="hp-h2 mb-1">Доход и расход по направлениям</h2>
 <p className="text-[12px] text-[var(--hp-sub)] mb-4">Только реальный доход/расход агентства — без транзита клиентов и выплат собственникам</p>
 {directionBreakdown.length === 0 ? (
 <div className="h-[80px] flex items-center justify-center text-sm text-[var(--hp-tertiary)]">
 Нет проведённых операций за период
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="text-left text-[12px] text-[var(--hp-sub)] border-b border-[var(--hp-border-soft)]">
 <th className="py-2 pr-4 font-medium">Направление</th>
 <th className="py-2 pr-4 font-medium text-right">Доход</th>
 <th className="py-2 pr-4 font-medium text-right">Расход</th>
 <th className="py-2 pr-4 font-medium text-right">Прибыль</th>
 <th className="py-2 font-medium text-right">Доля дохода</th>
 </tr>
 </thead>
 <tbody>
 {directionBreakdown.map(row => (
 <tr key={row.code} className="border-b border-[var(--hp-border-soft)] last:border-0">
 <td className="py-2 pr-4 font-medium text-[var(--hp-ink)]">{row.label}</td>
 <td className="py-2 pr-4 text-right text-[var(--hp-good)]">
 <span className="inline-flex items-center gap-1 justify-end">
 {row.income > 0 ? `+${formatMoney(row.income)}` : '—'}
 {row.guessedIncome > 0 && (
 <span title={`≈${formatMoney(row.guessedIncome)} из этой суммы определено по тексту операции, не по точной связи со сделкой/договором`}>
 <Info className="w-3.5 h-3.5 text-[var(--hp-tertiary)] shrink-0" strokeWidth={1.6} />
 </span>
 )}
 </span>
 </td>
 <td className="py-2 pr-4 text-right text-[var(--hp-danger)]">{row.expense > 0 ? `−${formatMoney(row.expense)}` : '—'}</td>
 <td className={`py-2 pr-4 text-right font-semibold ${row.profit < 0 ? 'text-[var(--hp-danger)]' : 'text-[var(--hp-ink)]'}`}>{formatMoney(row.profit)}</td>
 <td className="py-2 text-right text-[var(--hp-sub)]">{directionTotalIncome > 0 ? `${Math.round((row.income / directionTotalIncome) * 100)}%` : '—'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 {(transitTotal > 0 || ownerPayoutTotal > 0) && (
 <p className="text-[12px] text-[var(--hp-tertiary)] mt-3 pt-3 border-t border-[var(--hp-border-soft)]">
 Не входит в таблицу выше (не доход/расход агентства): транзит клиентов (аренда жильцов, депозиты) {formatMoneyShort(transitTotal)}
 {ownerPayoutTotal > 0 && <> · выплаты собственникам {formatMoneyShort(ownerPayoutTotal)}</>}
 </p>
 )}
 </div>

 {/* P&L и структура месяца — перенесены со старой /accounting (там теперь
     только журнал операций), раскладка по категориям дополняет таблицу
     направлений выше: там — куда, здесь — на чём конкретно (аренда,
     депозит, управление, комиссия...). */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 <div className="lg:col-span-2 hp-card p-5">
 <h2 className="hp-h2 mb-4">P&L — последние 12 месяцев</h2>
 <PnLChart data={pnlChartData} />
 </div>
 <div className="hp-card p-5">
 <h2 className="hp-h2 mb-4">Структура месяца</h2>
 <div className="space-y-5">
 <CategoryPieChart data={incomePie} title="Доходы" />
 <div className="border-t border-[var(--hp-border-soft)] pt-5">
 <CategoryPieChart data={expensePie} title="Расходы" />
 </div>
 </div>
 </div>
 </div>

 {/* Вверху одна полоса из 4 цифр; база объектов — справочно, блоком */}
      <div className="hp-block">
        <div className="hp-block-header">База объектов и договоров</div>
        <div className="hp-block-grid">
          <div className="hp-block-row"><span className="label">Объектов свободно</span><span className="value">{availableProps}</span></div>
          <div className="hp-block-row"><span className="label">Сдано в аренду</span><span className="value">{rentedProps}</span></div>
          <div className="hp-block-row"><span className="label">Продано объектов</span><span className="value">{soldProps}</span></div>
          <div className="hp-block-row"><span className="label">Действующих договоров</span><span className="value">{activeContracts}</span></div>
        </div>
      </div>

 {/* Charts row 1 */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-5">
 <h2 className="text-[15px] font-semibold text-[var(--hp-ink)] mb-4">Сумма и комиссия по сделкам</h2>
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
 <h2 className="text-[15px] font-semibold text-[var(--hp-ink)]">Воронка: {DEAL_TYPE_LABELS[mainDirection] ?? mainDirection}</h2>
 <p className="text-[12px] text-[var(--hp-sub)] mt-0.5 mb-4">Сколько сделок сейчас на каждом этапе, отменённые не показаны</p>
 <DealFunnelChart data={funnelStages} />
 </div>
 </div>

 {/* Charts row 2 */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-5">
 <h2 className="text-[15px] font-semibold text-[var(--hp-ink)] mb-4">Платежи по месяцам</h2>
 <PaymentsMonthlyChart data={paymentsMonthly} />
 </div>
 <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-5">
 <h2 className="text-[15px] font-semibold text-[var(--hp-ink)] mb-4">Направления работы</h2>
 {dealTypePie.length > 0 ? (
 <DealTypePieChart data={dealTypePie} />
 ) : (
 <div className="h-[220px] flex items-center justify-center text-sm text-[var(--hp-tertiary)]">
 Нет данных о сделках
 </div>
 )}
 </div>
 <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-5">
 <h2 className="text-[15px] font-semibold text-[var(--hp-ink)] mb-4">Источники сделок</h2>
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
 <h2 className="text-[15px] font-semibold text-[var(--hp-ink)] mb-4">Лиды и конверсия по месяцам</h2>
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
