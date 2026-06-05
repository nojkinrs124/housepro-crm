import { createClient } from '@/lib/supabase/server'
import { getPaymentStats } from '@/features/payments/actions/payments.actions'
import { MarkPaidButton } from '@/features/payments/components/MarkPaidButton'
import { DeletePaymentButton } from '@/features/payments/components/DeletePaymentButton'
import { PaymentStatusEditor } from '@/features/payments/components/PaymentStatusEditor'
import { Plus, AlertTriangle, CheckCircle, Pencil, Banknote, Wallet } from 'lucide-react'
import Link from 'next/link'

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Ожидает',   cls: 'bg-amber-50 text-amber-700' },
  paid:      { label: 'Оплачен',   cls: 'bg-green-50 text-green-700' },
  partial:   { label: 'Частично',  cls: 'bg-blue-50 text-blue-700' },
  overdue:   { label: 'Просрочен', cls: 'bg-red-50 text-red-600' },
  cancelled: { label: 'Отменён',   cls: 'bg-slate-50 text-slate-500' },
}
const typeLabels: Record<string, string> = {
  rent: 'Аренда', deposit: 'Депозит', commission: 'Комиссия',
  penalty: 'Штраф', other: 'Прочее',
}

function fmt(n: number) { return n.toLocaleString('ru-RU') + ' ₽' }
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
    { label: 'Получено за месяц', value: fmt(stats.paidThisMonth),  Icon: Banknote,      iconCls: 'bg-green-50',  iconColor: 'text-green-600', valueCls: 'text-green-700' },
    { label: 'Всего получено',    value: fmt(stats.totalPaid),       Icon: CheckCircle,   iconCls: 'bg-blue-50',   iconColor: 'text-blue-600',  valueCls: 'text-blue-700' },
    { label: 'Ожидает оплаты',    value: fmt(stats.pending),         Icon: Wallet,        iconCls: 'bg-amber-50',  iconColor: 'text-amber-500', valueCls: 'text-amber-700' },
    { label: 'Просрочено',        value: fmt(stats.overdue),         Icon: AlertTriangle, iconCls: stats.overdueCount > 0 ? 'bg-red-50' : 'bg-slate-50', iconColor: stats.overdueCount > 0 ? 'text-red-500' : 'text-slate-400', valueCls: stats.overdueCount > 0 ? 'text-red-600' : 'text-slate-500', extra: stats.overdueCount > 0 ? `${stats.overdueCount} платежей` : undefined },
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
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
          <Plus style={{ width: 16, height: 16 }} />
          Добавить платёж
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => {
          const Icon = card.Icon
          return (
            <div key={card.label} className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-[#64748B]">{card.label}</p>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.iconCls}`}>
                  <Icon className={card.iconColor} style={{ width: 17, height: 17 }} />
                </div>
              </div>
              <p className={`text-xl font-bold ${card.valueCls}`}>{card.value}</p>
              {card.extra && <p className="text-xs text-[#64748B] mt-0.5 font-medium">{card.extra}</p>}
            </div>
          )
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit bg-slate-100">
        {filters.map(f => {
          const isActive = (f.value === 'all' && !filterStatus) || filterStatus === f.value
          return (
            <Link key={f.value}
              href={f.value === 'all' ? '/payments' : `/payments?status=${f.value}`}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive ? 'bg-white text-[#111827] shadow-sm' : 'text-slate-500 hover:text-[#111827]'}`}>
              {f.label}
            </Link>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm overflow-hidden">
        {!payments || payments.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Banknote style={{ width: 20, height: 20 }} className="text-slate-400" />
            </div>
            <p className="text-[#374151] font-semibold">Платежей нет</p>
            <Link href="/payments/new" className="mt-2 inline-block text-sm text-green-600 hover:underline font-medium">
              Создать первый платёж →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Договор / Клиент', 'Тип', 'Сумма', 'Срок', 'Статус', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748B] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {payments.map((p: any) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const contract = p.contract as any
                  const client = contract?.client
                  const isOverdueDisplay =
                    p.payment_status === 'overdue' ||
                    (p.payment_status === 'pending' && p.due_date && new Date(p.due_date) < new Date())
                  const statusKey = isOverdueDisplay && p.payment_status === 'pending' ? 'overdue' : (p.payment_status ?? 'pending')
                  const sc = statusConfig[statusKey] ?? statusConfig.pending

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-[#111827]">{contract?.contract_number ?? '—'}</p>
                        <p className="text-xs text-[#64748B] mt-0.5">{client?.full_name ?? '—'}</p>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-[#374151] font-medium">
                        {typeLabels[p.payment_type ?? ''] ?? p.payment_type ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-bold text-[#111827]">
                        {fmt(Number(p.amount))}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-sm font-medium ${isOverdueDisplay && p.payment_status !== 'paid' ? 'text-red-600' : 'text-[#64748B]'}`}>
                          {fmtDate(p.due_date)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <PaymentStatusEditor paymentId={p.id} currentStatus={(p.payment_status ?? 'pending') as any} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 justify-end">
                          <Link href={`/payments/${p.id}/edit`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            title="Редактировать">
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
