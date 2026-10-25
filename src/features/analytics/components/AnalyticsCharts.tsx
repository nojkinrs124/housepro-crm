'use client'

import { formatMoney } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { CHART, CHART_AXIS_TICK, CHART_GRID_STROKE, CHART_TOOLTIP_STYLE, isChartEmpty } from '@/lib/design/chartColors'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlyDealsData {
  month: string
  count: number
  amount: number
  commission: number
}

export interface FunnelData {
  stage: string
  count: number
  color: string
}

export interface LeadsConversionData {
  month: string
  leads: number
  converted: number
}

export interface PaymentMonthlyData {
  month: string
  paid: number
  pending: number
  overdue: number
}

export interface DealTypeData {
  name: string
  value: number
  color: string
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatMoneyCompact(v: number | string | undefined) {
  const n = Number(v ?? 0)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}М ₽`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}К ₽`
  return `${n} ₽`
}

function moneyTooltip(v: number | string | undefined) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(v ?? 0))
}

// ─── Monthly Deals Area Chart ─────────────────────────────────────────────────

export function DealsAreaChart({ data }: { data: MonthlyDealsData[] }) {
  if (isChartEmpty(data, ['amount', 'commission'])) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
        <XAxis dataKey="month" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatMoneyCompact} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={60} />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(v, name) => [moneyTooltip(v as number), name === 'amount' ? 'Сумма сделок' : 'Комиссия']}
        />
        <Area type="monotone" dataKey="amount" stroke="var(--hp-accent)" strokeWidth={2} fill="var(--hp-accent)" fillOpacity={0.12} name="amount" />
        <Area type="monotone" dataKey="commission" stroke={CHART.info} strokeWidth={2} fill={CHART.info} fillOpacity={0.08} name="commission" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Заглушка пустого графика той же высоты — сетка из нулей ничего не говорит. */
export function ChartEmpty({ text = 'За период данных нет' }: { text?: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center border border-dashed border-[var(--hp-border)] text-[13px] text-[var(--hp-tertiary)]">
      {text}
    </div>
  )
}

// ─── Deal Funnel Bar Chart ────────────────────────────────────────────────────

export function DealFunnelChart({ data }: { data: FunnelData[] }) {
  if (isChartEmpty(data, ['count'])) return <ChartEmpty text="Сейчас нет сделок в работе" />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
        <XAxis dataKey="stage" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(v) => [v, 'Сделок']}
        />
        <Bar dataKey="count">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Leads Conversion Chart ───────────────────────────────────────────────────

export function LeadsConversionChart({ data }: { data: LeadsConversionData[] }) {
  if (isChartEmpty(data, ['leads', 'converted'])) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
        <XAxis dataKey="month" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12.5, paddingTop: 8 }} />
        <Bar dataKey="leads" name="Лиды" fill={CHART.tertiary} />
        <Bar dataKey="converted" name="Конвертировано" fill="var(--hp-accent)" />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Payments Monthly Chart ───────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = { paid: 'Оплачено', pending: 'Ожидает', overdue: 'Просрочено' }

export function PaymentsMonthlyChart({ data }: { data: PaymentMonthlyData[] }) {
  if (isChartEmpty(data, ['paid', 'pending', 'overdue'])) return <ChartEmpty />
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
        <XAxis dataKey="month" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatMoneyCompact} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={60} />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(v, name) => [moneyTooltip(v as number), PAYMENT_LABELS[name as string] ?? name]}
        />
        <Legend wrapperStyle={{ fontSize: 12.5, paddingTop: 8 }}
          formatter={(v) => PAYMENT_LABELS[v] ?? v} />
        <Bar dataKey="paid" fill="var(--hp-accent)" stackId="a" />
        <Bar dataKey="pending" fill={CHART.tertiary} stackId="a" />
        <Bar dataKey="overdue" fill={CHART.danger} stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Deal Type Pie Chart ──────────────────────────────────────────────────────

const RADIAN = Math.PI / 180

interface LabelProps {
  cx?: number
  cy?: number
  midAngle?: number
  innerRadius?: number
  outerRadius?: number
  percent?: number
}

function renderLabel({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }: LabelProps) {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function DealTypePieChart({ data }: { data: DealTypeData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={90}
          dataKey="value"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(v, _name, props) => [v, (props.payload as DealTypeData).name]}
        />
        <Legend wrapperStyle={{ fontSize: 12.5 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
