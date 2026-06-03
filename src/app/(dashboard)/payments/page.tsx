import { createClient } from '@/lib/supabase/server'
import { getPaymentStats } from '@/features/payments/actions/payments.actions'
import { MarkPaidButton } from '@/features/payments/components/MarkPaidButton'
import { DeletePaymentButton } from '@/features/payments/components/DeletePaymentButton'
import { PaymentStatusEditor } from '@/features/payments/components/PaymentStatusEditor'
import { Plus, TrendingUp, Clock, AlertTriangle, CheckCircle, Pencil } from 'lucide-react'
import Link from 'next/link'

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Ожидает',   className: 'bg-yellow-100 text-yellow-700' },
  paid:      { label: 'Оплачен',   className: 'bg-green-100 text-green-700' },
  partial:   { label: 'Частично',  className: 'bg-blue-100 text-blue-700' },
  overdue:   { label: 'Просрочен', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Отменён',   className: 'bg-gray-100 text-gray-500' },
}

const typeLabels: Record<string, string> = {
  rent:       'Аренда',
  deposit:    'Депозит',
  commission: 'Комиссия',
  penalty:    'Штраф',
  other:      'Прочее',
}

function fmt(n: number) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: filterStatus } = await searchParams
  const supabase = await createClient()
  const stats = await getPaymentStats()

  let query = supabase
    .from('payments')
    .select(`
      id, amount, payment_type, payment_status,
      due_date, payment_date, notes, created_at,
      contract:contracts(id, contract_number, contract_type,
        client:clients(full_name)
      )
    `)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (filterStatus && filterStatus !== 'all') {
    query = query.eq('payment_status', filterStatus)
  }

  const { data: rawPayments } = await query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payments = rawPayments as any[] | null

  const statCards = [
    {
      label: 'Получено за месяц',
      value: fmt(stats.paidThisMonth),
      Icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Всего получено',
      value: fmt(stats.totalPaid),
      Icon: CheckCircle,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Ожидает оплаты',
      value: fmt(stats.pending),
      Icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      label: 'Просрочено',
      value: fmt(stats.overdue),
      extra: stats.overdueCount > 0 ? `${stats.overdueCount} платежей` : undefined,
      Icon: AlertTriangle,
      color: stats.overdueCount > 0 ? 'text-red-600' : 'text-gray-400',
      bg: stats.overdueCount > 0 ? 'bg-red-50' : 'bg-gray-50',
    },
  ]

  const filters = [
    { value: 'all',       label: 'Все' },
    { value: 'pending',   label: 'Ожидают' },
    { value: 'overdue',   label: 'Просрочены' },
    { value: 'paid',      label: 'Оплачены' },
    { value: 'cancelled', label: 'Отменены' },
  ]

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Платежи</h1>
          <p className="text-muted-foreground mt-1">Аренда, депозиты, комиссии</p>
        </div>
        <Link
          href="/payments/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" />
          Новый платёж
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.Icon
          return (
            <div key={card.label} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.bg}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              {card.extra && (
                <p className="text-xs text-muted-foreground mt-0.5">{card.extra}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        {filters.map((f) => (
          <Link
            key={f.value}
            href={f.value === 'all' ? '/payments' : `/payments?status=${f.value}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              (f.value === 'all' && !filterStatus) || filterStatus === f.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {!payments || payments.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground text-sm">Платежей нет</p>
            <Link href="/payments/new" className="mt-3 inline-block text-sm text-primary hover:underline">
              Создать первый платёж →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Договор / Клиент</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Тип</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Сумма</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Срок</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p: any) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const contract = p.contract as any
                  const client = contract?.client
                  const isOverdueDisplay =
                    p.payment_status === 'overdue' ||
                    (p.payment_status === 'pending' && p.due_date && new Date(p.due_date) < new Date())

                  const statusKey = isOverdueDisplay && p.payment_status === 'pending'
                    ? 'overdue'
                    : (p.payment_status ?? 'pending')
                  const sc = statusConfig[statusKey] ?? statusConfig.pending

                  return (
                    <tr key={p.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">
                          {contract?.contract_number ?? '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {client?.full_name ?? '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {typeLabels[p.payment_type ?? ''] ?? p.payment_type ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-foreground">
                          {fmt(Number(p.amount))}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${isOverdueDisplay && p.payment_status !== 'paid' ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                          {fmtDate(p.due_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusEditor paymentId={p.id} currentStatus={(p.payment_status ?? 'pending') as any} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Link
                            href={`/payments/${p.id}/edit`}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition"
                            title="Редактировать"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <MarkPaidButton paymentId={p.id} status={p.payment_status ?? 'pending'} />
                          <DeletePaymentButton paymentId={p.id} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
