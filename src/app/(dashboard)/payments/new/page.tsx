import { createClient } from '@/lib/supabase/server'
import { createPaymentAction } from '@/features/payments/actions/payments.actions'
import { ArrowLeft, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ contract_id?: string }>
}) {
  const { contract_id } = await searchParams
  const supabase = await createClient()

  const { data: rawContracts } = await supabase
    .from('contracts')
    .select('id, contract_number, contract_type, client_contact:contacts!contracts_client_contact_id_fkey(full_name)')
    .in('status', ['draft', 'generated', 'signed'])
    .order('created_at', { ascending: false })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contracts = rawContracts as any[] | null

  async function handleSubmit(formData: FormData) {
    'use server'
    const result = await createPaymentAction(formData)
    if (!result.error) redirect('/payments')
  }

  const typeLabels = [
    { value: 'rent',       label: 'Аренда' },
    { value: 'deposit',    label: 'Депозит' },
    { value: 'commission', label: 'Комиссия' },
    { value: 'penalty',    label: 'Штраф' },
    { value: 'other',      label: 'Прочее' },
  ]

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/payments" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Платежи
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Новый платёж</h1>
          <p className="text-sm text-muted-foreground">Аренда, депозит, комиссия</p>
        </div>
      </div>

      <form action={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-5">

        {/* Contract */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Договор
          </label>
          <select
            name="contract_id"
            defaultValue={contract_id ?? ''}
            className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          >
            <option value="">Без договора</option>
            {(contracts ?? []).map((c: any) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const client = (c as any).client_contact
              return (
                <option key={c.id} value={c.id}>
                  {c.contract_number} {client?.full_name ? `— ${client.full_name}` : ''}
                </option>
              )
            })}
          </select>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Сумма *
          </label>
          <div className="relative">
            <input
              name="amount"
              type="number"
              min="1"
              step="0.01"
              required
              placeholder="25 000"
              className="w-full h-10 px-3 pr-8 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₽</span>
          </div>
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Тип платежа
          </label>
          <select
            name="payment_type"
            defaultValue="rent"
            className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          >
            {typeLabels.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Due date */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Срок оплаты
          </label>
          <input
            name="due_date"
            type="date"
            className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Примечание
          </label>
          <textarea
            name="notes"
            rows={2}
            placeholder="Дополнительная информация..."
            className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Link
            href="/payments"
            className="flex-1 h-10 flex items-center justify-center border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-all"
          >
            Отмена
          </Link>
          <button
            type="submit"
            className="flex-1 h-10 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
          >
            Создать платёж
          </button>
        </div>
      </form>
    </div>
  )
}
