import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updatePaymentAction } from '@/features/payments/actions/payments.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'

const typeOptions = [
  { value: 'rent',       label: 'Аренда' },
  { value: 'deposit',    label: 'Депозит' },
  { value: 'commission', label: 'Комиссия' },
  { value: 'penalty',    label: 'Штраф' },
  { value: 'other',      label: 'Прочее' },
]

const statusOptions = [
  { value: 'pending',   label: '⏳ Ожидает оплату' },
  { value: 'paid',      label: '✅ Оплачен' },
  { value: 'partial',   label: '🔶 Частично оплачен' },
  { value: 'overdue',   label: '🔴 Просрочен' },
  { value: 'cancelled', label: '⛔ Отменён' },
]

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: rawPayment, error: rawPaymentError } = await supabase
    .from('payments')
    .select('*, contract:contracts(id, contract_number, client_contact:contacts!contracts_client_contact_id_fkey(full_name))')
    .eq('id', id)
    .single()

  if (rawPaymentError && rawPaymentError.code !== 'PGRST116') {
    throw new Error(`Не удалось загрузить платёж: ${rawPaymentError.message}`)
  }
  if (!rawPayment) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = rawPayment as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contract = p.contract as any

  const boundAction = updatePaymentAction.bind(null, id)

  const inp = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all'
  const lbl = 'block text-sm font-medium text-foreground mb-1.5'

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Link href="/payments" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к платежам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-foreground tracking-tight leading-tight">Редактировать платёж</h1>
          {contract && (
            <p className="text-muted-foreground text-sm mt-0.5">
              {contract.contract_number ?? `Договор #${id.slice(0, 8)}`}
              {contract.client_contact?.full_name && ` · ${contract.client_contact.full_name}`}
            </p>
          )}
        </div>
      </div>

      <ServerActionForm action={boundAction} className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-5">

        {/* Сумма */}
        <div>
          <label className={lbl}>Сумма (₽) <span className="text-destructive">*</span></label>
          <input
            name="amount"
            type="number"
            step="0.01"
            required
            defaultValue={p.amount ?? ''}
            placeholder="50 000"
            className={inp}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Тип */}
          <div>
            <label className={lbl}>Тип платежа</label>
            <select name="payment_type" defaultValue={p.payment_type ?? 'rent'}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
              {typeOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Статус */}
          <div>
            <label className={lbl}>Статус</label>
            <select name="payment_status" defaultValue={p.payment_status ?? 'pending'}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
              {statusOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Срок оплаты */}
        <div>
          <label className={lbl}>Срок оплаты</label>
          <input
            name="due_date"
            type="date"
            defaultValue={p.due_date ? p.due_date.slice(0, 10) : ''}
            className={inp}
          />
        </div>

        {/* Примечания */}
        <div>
          <label className={lbl}>Примечания</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={p.notes ?? ''}
            placeholder="Дополнительная информация..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        {/* Текущий статус */}
        <div className="p-3 bg-muted/40 rounded-xl text-sm text-muted-foreground">
          Создан: {new Date(p.created_at).toLocaleDateString('ru-RU')}
          {p.payment_date && (
            <> · Оплачен: {new Date(p.payment_date).toLocaleDateString('ru-RU')}</>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit"
            className="flex-1 h-10 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition" style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
            Сохранить изменения
          </button>
          <Link href="/payments"
            className="flex-1 h-10 flex items-center justify-center border border-border rounded-xl text-sm font-medium hover:bg-accent transition">
            Отмена
          </Link>
        </div>
      </ServerActionForm>
    </div>
  )
}
