import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { PaymentForm } from '@/features/payments/components/PaymentForm'

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
  const contracts = (rawContracts ?? []) as any[]

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/payments"
          className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#111827] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Платежи
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.12), rgba(34,197,94,0.12))' }}
        >
          <CreditCard className="w-5 h-5 text-[#16A34A]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Новый платёж</h1>
          <p className="text-sm text-[#64748B]">Аренда, депозит, комиссия</p>
        </div>
      </div>

      <PaymentForm contracts={contracts} defaultContractId={contract_id} />
    </div>
  )
}
