import { createClient } from '@/lib/supabase/server'
import { getPaymentStats } from '@/features/payments/actions/payments.actions'
import { MarkPaidButton } from '@/features/payments/components/MarkPaidButton'
import { DeletePaymentButton } from '@/features/payments/components/DeletePaymentButton'
import { PaymentStatusEditor } from '@/features/payments/components/PaymentStatusEditor'
import { Plus, TrendingUp, Clock, AlertTriangle, CheckCircle, Pencil, Banknote, Wallet } from 'lucide-react'
import Link from 'next/link'

const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: 'Ожидает',   bg: '#FFFBEB', color: '#D97706' },
  paid:      { label: 'Оплачен',   bg: '#F0FDF4', color: '#16A34A' },
  partial:   { label: 'Частично',  bg: '#EFF6FF', color: '#2563EB' },
  overdue:   { label: 'Просрочен', bg: '#FEF2F2', color: '#DC2626' },
  cancelled: { label: 'Отменён',   bg: '#F8FAFC', color: '#64748B' },
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

const cardStyle = {
  background: '#ffffff',
  borderRadius: '20px',
  border: '1px solid rgba(214,219,235,0.6)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)',
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
      Icon: Banknote,
      iconBg: '#F0FDF4',
      iconColor: '#16A34A',
      valueColor: '#16A34A',
    },
    {
      label: 'Всего получено',
      value: fmt(stats.totalPaid),
      Icon: CheckCircle,
      iconBg: '#EFF6FF',
      iconColor: '#2563EB',
      valueColor: '#2563EB',
    },
    {
      label: 'Ожидает оплаты',
      value: fmt(stats.pending),
      Icon: Wallet,
      iconBg: '#FFFBEB',
      iconColor: '#D97706',
      valueColor: '#D97706',
    },
    {
      label: 'Просрочено',
      value: fmt(stats.overdue),
      extra: stats.overdueCount > 0 ? `${stats.overdueCount} платежей` : undefined,
      Icon: AlertTriangle,
      iconBg: stats.overdueCount > 0 ? '#FEF2F2' : '#F8FAFC',
      iconColor: stats.overdueCount > 0 ? '#DC2626' : '#94A3B8',
      valueColor: stats.overdueCount > 0 ? '#DC2626' : '#64748B',
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Платежи</h1>
          <p className="text-[#64748B] mt-1 text-sm">{payments?.length ?? 0} записей</p>
        </div>
        <Link href="/payments/new"
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-[12px] text-sm font-semibold"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #22C55E)',
            boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
          }}>
          <Plus style={{ width: 16, height: 16 }} />
          Добавить платёж
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => {
          const Icon = card.Icon
          return (
            <div key={card.label} style={cardStyle} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium text-[#64748B]">{card.label}</p>
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                  style={{ background: card.iconBg }}>
                  <Icon style={{ width: 17, height: 17, color: card.iconColor }} />
                </div>
              </div>
              <p className="text-xl font-bold" style={{ color: card.valueColor }}>{card.value}</p>
              {card.extra && (
                <p className="text-xs text-[#64748B] mt-0.5 font-medium">{card.extra}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-[12px] w-fit"
        style={{ background: '#F1F5F9' }}>
        {filters.map((f) => (
          <Link
            key={f.value}
            href={f.value === 'all' ? '/payments' : `/payments?status=${f.value}`}
            className="px-4 py-2 rounded-[10px] text-sm font-semibold transition-all duration-200"
            style={{
              background: (f.value === 'all' && !filterStatus) || filterStatus === f.value
                ? '#ffffff'
                : 'transparent',
              color: (f.value === 'all' && !filterStatus) || filterStatus === f.value
                ? '#111827'
                : '#64748B',
              boxShadow: (f.value === 'all' && !filterStatus) || filterStatus === f.value
                ? '0 1px 4px rgba(0,0,0,0.08)'
                : 'none',
            }}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div style={cardStyle} className="overflow-hidden">
        {!payments || payments.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
              <Banknote style={{ width: 20, height: 20, color: '#94A3B8' }} />
            </div>
            <p className="text-[#374151] font-semibold">Платежей нет</p>
            <Link href="/payments/new" className="mt-2 inline-block text-sm text-[#16A34A] hover:underline font-medium">
              Создать первый платёж →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(214,219,235,0.6)', background: '#F8FAFC' }}>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Договор / Клиент</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Тип</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Сумма</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Срок</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Статус</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
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
                    <tr
                      key={p.id}
                      style={{ borderBottom: '1px solid rgba(214,219,235,0.4)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8FAFC'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-[#111827]">
                          {contract?.contract_number ?? '—'}
                        </p>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          {client?.full_name ?? '—'}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-[#374151] font-medium">
                          {typeLabels[p.payment_type ?? ''] ?? p.payment_type ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-bold text-[#111827]">
                          {fmt(Number(p.amount))}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-sm font-medium ${isOverdueDisplay && p.payment_status !== 'paid' ? 'text-[#DC2626]' : 'text-[#64748B]'}`}>
                          {fmtDate(p.due_date)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <PaymentStatusEditor paymentId={p.id} currentStatus={(p.payment_status ?? 'pending') as any} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 justify-end">
                          <Link
                            href={`/payments/${p.id}/edit`}
                            className="p-1.5 rounded-[8px] transition-all text-[#94A3B8] hover:text-[#16A34A] hover:bg-[#F0FDF4]"
                            title="Редактировать"
                          >
                            <Pencil style={{ width: 14, height: 14 }} />
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
