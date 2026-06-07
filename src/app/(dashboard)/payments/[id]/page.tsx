import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Banknote, Calendar, FileText, User,
  CheckCircle2, Clock, AlertTriangle, XCircle, Receipt,
} from 'lucide-react'
import { PaymentMarkPaidButton } from '@/features/payments/components/PaymentMarkPaidButton'
import { PaymentStatusBadge } from '@/features/payments/components/PaymentStatusBadge'
import { PaymentDeleteButton } from '@/features/payments/components/PaymentDeleteButton'

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  rent:         'Аренда',
  deposit:      'Депозит',
  commission:   'Комиссия',
  utility:      'Коммунальные услуги',
  maintenance:  'Обслуживание',
  other:        'Прочее',
}

function formatMoney(amount: number | null | undefined) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(dt: string | null | undefined) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: payment } = await supabase
    .from('payments')
    .select(`
      *,
      contract:contracts(
        id, contract_number, contract_type, status,
        client_contact:contacts!contracts_client_contact_id_fkey(id, full_name, phone),
        owner_contact:contacts!contracts_owner_contact_id_fkey(id, full_name, phone),
        property:properties(id, title, address)
      ),
      creator:users!payments_created_by_fkey(id, full_name, email)
    `)
    .eq('id', id)
    .single()

  if (!payment) notFound()

  const { data: currentUserData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user!.id)
    .single()

  const canDelete = ['admin', 'manager'].includes(currentUserData?.role ?? '')

  const contract = payment.contract as {
    id: string
    contract_number?: string
    contract_type?: string
    status?: string
    client_contact?: { id: string; full_name: string; phone?: string } | null
    owner_contact?: { id: string; full_name: string; phone?: string } | null
    property?: { id: string; title: string; address?: string } | null
  } | null

  const creator = payment.creator as { id: string; full_name: string; email?: string } | null

  const isOverdue = payment.payment_status === 'overdue' ||
    (payment.payment_status === 'pending' && payment.due_date && new Date(payment.due_date) < new Date())

  type PaymentStatus = 'paid' | 'pending' | 'overdue' | 'partial' | 'cancelled'
  const safeStatus: PaymentStatus = (['paid','pending','overdue','partial','cancelled'].includes(payment.payment_status ?? '')
    ? payment.payment_status
    : 'pending') as PaymentStatus

  const statusIcon: Record<PaymentStatus, React.ReactNode> = {
    paid:      <CheckCircle2 style={{ width: 18, height: 18 }} />,
    pending:   <Clock style={{ width: 18, height: 18 }} />,
    overdue:   <AlertTriangle style={{ width: 18, height: 18 }} />,
    partial:   <Receipt style={{ width: 18, height: 18 }} />,
    cancelled: <XCircle style={{ width: 18, height: 18 }} />,
  }

  const statusGradient: Record<PaymentStatus, string> = {
    paid:      'from-green-500 to-emerald-600',
    pending:   'from-blue-500 to-blue-600',
    overdue:   'from-red-500 to-red-600',
    partial:   'from-yellow-500 to-yellow-600',
    cancelled: 'from-gray-400 to-gray-500',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/payments" className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#111827] transition-colors">
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Назад к платежам
      </Link>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        <div className={`bg-gradient-to-r ${statusGradient[safeStatus]} p-6 text-white`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                {statusIcon[safeStatus]}
              </div>
              <div>
                <p className="text-white/70 text-sm font-medium">
                  {PAYMENT_TYPE_LABELS[payment.payment_type ?? ''] ?? payment.payment_type ?? 'Платёж'}
                </p>
                <p className="text-3xl font-bold tracking-tight">{formatMoney(payment.amount)}</p>
              </div>
            </div>
            <PaymentStatusBadge status={payment.payment_status ?? 'pending'} />
          </div>
        </div>

        {/* Details under hero */}
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-[#64748B] mb-1">Дата платежа</p>
            <p className="text-sm font-semibold text-[#111827]">
              {payment.payment_date ? formatDate(payment.payment_date) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] mb-1">Срок оплаты</p>
            <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-[#111827]'}`}>
              {formatDate(payment.due_date)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] mb-1">Создан</p>
            <p className="text-sm font-semibold text-[#111827]">{formatDate(payment.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-[#64748B] mb-1">Кем создан</p>
            <p className="text-sm font-semibold text-[#111827]">{creator?.full_name ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Contract + contacts */}
        <div className="md:col-span-2 space-y-6">
          {/* Contract block */}
          {contract && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[#111827] mb-4">Договор</h2>
              <Link href={`/contracts/${contract.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] hover:border-green-300 hover:bg-green-50/40 transition-all group mb-4">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                  <FileText style={{ width: 17, height: 17, color: '#16A34A' }} />
                </div>
                <div>
                  <p className="text-xs text-[#64748B]">Договор</p>
                  <p className="text-sm font-semibold text-[#111827] group-hover:text-green-600 transition-colors">
                    № {contract.contract_number ?? '—'}
                  </p>
                </div>
              </Link>

              {/* Property */}
              {contract.property && (
                <Link href={`/properties/${contract.property.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] hover:border-purple-300 hover:bg-purple-50/40 transition-all group mb-2">
                  <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Banknote style={{ width: 17, height: 17, color: '#7C3AED' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#64748B]">Объект</p>
                    <p className="text-sm font-semibold text-[#111827] group-hover:text-purple-600 transition-colors truncate">
                      {contract.property.title}
                    </p>
                    {contract.property.address && (
                      <p className="text-xs text-[#64748B] truncate">{contract.property.address}</p>
                    )}
                  </div>
                </Link>
              )}

              {/* Contacts */}
              <div className="mt-3 space-y-2">
                {contract.client_contact && (
                  <Link href={`/contacts/${contract.client_contact.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] hover:border-blue-300 hover:bg-blue-50/40 transition-all group">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold">
                      {contract.client_contact.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B]">Клиент</p>
                      <p className="text-sm font-semibold text-[#111827] group-hover:text-blue-600 transition-colors">
                        {contract.client_contact.full_name}
                      </p>
                      {contract.client_contact.phone && (
                        <p className="text-xs text-[#64748B]">{contract.client_contact.phone}</p>
                      )}
                    </div>
                  </Link>
                )}
                {contract.owner_contact && (
                  <Link href={`/contacts/${contract.owner_contact.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] hover:border-orange-300 hover:bg-orange-50/40 transition-all group">
                    <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 text-sm font-bold">
                      {contract.owner_contact.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B]">Собственник</p>
                      <p className="text-sm font-semibold text-[#111827] group-hover:text-orange-600 transition-colors">
                        {contract.owner_contact.full_name}
                      </p>
                      {contract.owner_contact.phone && (
                        <p className="text-xs text-[#64748B]">{contract.owner_contact.phone}</p>
                      )}
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {payment.notes && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[#111827] mb-3">Комментарий</h2>
              <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-wrap">{payment.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-2">
            <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">Действия</h2>

            {payment.payment_status !== 'paid' && payment.payment_status !== 'cancelled' && (
              <PaymentMarkPaidButton paymentId={payment.id} />
            )}

            <Link href={`/payments/${payment.id}/edit`}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-[#2563EB] bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all">
              <Calendar style={{ width: 15, height: 15 }} />
              Редактировать
            </Link>

            {canDelete && <PaymentDeleteButton paymentId={payment.id} contractId={contract?.id} />}
          </div>

          {/* Status info */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">Информация</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-[#64748B]">Тип платежа</dt>
                <dd className="text-sm font-semibold text-[#111827] mt-0.5">
                  {PAYMENT_TYPE_LABELS[payment.payment_type ?? ''] ?? payment.payment_type ?? '—'}
                </dd>
              </div>
              {isOverdue && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle style={{ width: 14, height: 14, color: '#DC2626', flexShrink: 0 }} />
                  <p className="text-xs font-medium text-red-700">Просрочен</p>
                </div>
              )}
            </dl>
          </div>

          {/* Link to contract all payments */}
          {contract && (
            <Link href={`/contracts/${contract.id}`}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-[#374151] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl hover:bg-[#F1F5F9] transition-all">
              <FileText style={{ width: 15, height: 15 }} />
              Все платежи по договору
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
