'use client'

import { formatMoney } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

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
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="dealsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--hp-accent)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--hp-accent)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="commissionGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatMoneyCompact} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={60} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
          formatter={(v, name) => [moneyTooltip(v as number), name === 'amount' ? 'Сумма сделок' : 'Комиссия']}
        />
        <Area type="monotone" dataKey="amount" stroke="var(--hp-accent)" strokeWidth={2} fill="url(#dealsGrad)" name="amount" />
        <Area type="monotone" dataKey="commission" stroke="#2563EB" strokeWidth={2} fill="url(#commissionGrad)" name="commission" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Deal Funnel Bar Chart ────────────────────────────────────────────────────

export function DealFunnelChart({ data }: { data: FunnelData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
          formatter={(v) => [v, 'Сделок']}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
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
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="leads" name="Лиды" fill="#93C5FD" radius={[4, 4, 0, 0]} />
        <Bar dataKey="converted" name="Конвертировано" fill="var(--hp-accent)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Payments Monthly Chart ───────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = { paid: 'Оплачено', pending: 'Ожидает', overdue: 'Просрочено' }

export function PaymentsMonthlyChart({ data }: { data: PaymentMonthlyData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatMoneyCompact} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={60} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
          formatter={(v, name) => [moneyTooltip(v as number), PAYMENT_LABELS[name as string] ?? name]}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(v) => PAYMENT_LABELS[v] ?? v} />
        <Bar dataKey="paid" fill="var(--hp-accent)" radius={[4, 4, 0, 0]} stackId="a" />
        <Bar dataKey="pending" fill="#93C5FD" radius={[0, 0, 0, 0]} stackId="a" />
        <Bar dataKey="overdue" fill="#FCA5A5" radius={[4, 4, 0, 0]} stackId="a" />
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
          contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
          formatter={(v, _name, props) => [v, (props.payload as DealTypeData).name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
