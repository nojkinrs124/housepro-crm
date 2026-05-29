import { createClient } from '@/lib/supabase/server'
import { MarkPaidButton } from './MarkPaidButton'
import { DeletePaymentButton } from './DeletePaymentButton'
import { Plus, CreditCard } from 'lucide-react'
import Link from 'next/link'

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Ожидает',   className: 'bg-yellow-100 text-yellow-700' },
  paid:      { label: 'Оплачен',   className: 'bg-green-100 text-green-700' },
  overdue:   { label: 'Просрочен', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Отменён',   className: 'bg-gray-100 text-gray-500' },
}

const typeLabels: Record<string, string> = {
  rent: 'Аренда', deposit: 'Депозит',
  commission: 'Комиссия', penalty: 'Штраф', other: 'Прочее',
}

function fmt(n: number) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function PaymentsSection({ contractId }: { contractId: string }) {
  const supabase = await createClient()

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('contract_id', contractId)
    .order('due_date', { ascending: true, nullsFirst: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPaid   = (payments ?? []).filter((p: any) => p.payment_status === 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalOwed   = (payments ?? []).filter((p: any) => p.payment_status !== 'paid' && p.payment_status !== 'cancelled').reduce((s: number, p: any) => s + Number(p.amount), 0)

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Платежи</h2>
          {payments && payments.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {payments.length}
            </span>
          )}
        </div>
        <Link
          href={`/payments/new?contract_id=${contractId}`}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Добавить
        </Link>
      </div>

      {/* Totals */}
      {payments && payments.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs text-green-600 mb-0.5">Получено</p>
            <p className="text-sm font-bold text-green-700">{fmt(totalPaid)}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-3">
            <p className="text-xs text-yellow-600 mb-0.5">Ожидается</p>
            <p className="text-sm font-bold text-yellow-700">{fmt(totalOwed)}</p>
          </div>
        </div>
      )}

      {/* List */}
      {!payments || payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Платежей нет</p>
      ) : (
        <div className="space-y-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {payments.map((p: any) => {
            const isOverdueDisplay =
              p.payment_status === 'overdue' ||
              (p.payment_status === 'pending' && p.due_date && new Date(p.due_date) < new Date())
            const statusKey = isOverdueDisplay && p.payment_status === 'pending' ? 'overdue' : (p.payment_status ?? 'pending')
            const sc = statusConfig[statusKey] ?? statusConfig.pending

            return (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/40 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{fmt(Number(p.amount))}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.className}`}>
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {typeLabels[p.payment_type] ?? p.payment_type}
                    {p.due_date ? ` · срок ${fmtDate(p.due_date)}` : ''}
                    {p.payment_date ? ` · оплачен ${fmtDate(p.payment_date)}` : ''}
                  </p>
                  {p.notes && <p className="text-xs text-muted-foreground truncate">{p.notes}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MarkPaidButton paymentId={p.id} status={p.payment_status ?? 'pending'} />
                  <DeletePaymentButton paymentId={p.id} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
