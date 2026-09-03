import { createClient } from '@/lib/supabase/server'
import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { isId } from '@/lib/utils'
import { ContractsView, type ContractRow } from '@/features/contracts/components/ContractsView'

export default async function ContractsPage() {
  const supabase = await createClient()

  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, contract_number, contract_type, status, amount, client_contact_id, property_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const contactIds = [...new Set([
    ...(contracts?.map(c => c.client_contact_id).filter(isId) ?? []),
  ])]
  const propertyIds = [...new Set(contracts?.map(c => c.property_id).filter(isId) ?? [])]

  const [{ data: contactsData }, { data: propertiesData }] = await Promise.all([
    contactIds.length > 0
      ? supabase.from('contacts').select('id, full_name').in('id', contactIds)
      : Promise.resolve({ data: [] }),
    propertyIds.length > 0
      ? supabase.from('properties').select('id, address, title').in('id', propertyIds)
      : Promise.resolve({ data: [] }),
  ])

  // Имена сторон берутся только из contacts. Запасной путь через client_id убран
  // 04.09.2026: колонка пуста во всех 13 договорах и больше не читается нигде —
  // комментарий об этом стоял с 02.09.2026, а сам путь оставался в коде.
  const clientMap = Object.fromEntries((contactsData ?? []).map(c => [c.id, c]))
  const propertyMap = Object.fromEntries((propertiesData ?? []).map(p => [p.id, p]))

  const rows: ContractRow[] = (contracts ?? []).map(c => {
    const clientId = c.client_contact_id
    const property = c.property_id ? propertyMap[c.property_id] : null
    return {
      id: c.id,
      number: c.contract_number ?? `#${c.id.slice(0, 8)}`,
      contractType: c.contract_type,
      status: c.status,
      amount: c.amount === null ? null : Number(c.amount),
      clientName: (clientId ? clientMap[clientId]?.full_name : null) ?? null,
      propertyLabel: property?.title ?? property?.address ?? null,
      createdAt: c.created_at,
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Договоры"
        subtitle={`${rows.length} договоров`}
        actions={
          <Link href="/contracts/new" className={buttonVariants({ size: 'sm' })}>
            <Plus style={{ width: 16, height: 16 }} />
            Новый договор
          </Link>
        }
      />

      {rows.length === 0 ? (
        <div className="hp-card hp-empty">
          <div className="w-12 h-12 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] flex items-center justify-center mx-auto mb-3">
            <FileText style={{ width: 20, height: 20 }} className="text-[var(--hp-tertiary)]" />
          </div>
          <p className="text-[var(--hp-ink)] font-semibold">
            {error ? `Ошибка: ${error.message}` : 'Нет договоров'}
          </p>
          <Link href="/contracts/new" className="hp-btn-primary mt-5">
            <Plus style={{ width: 16, height: 16 }} />
            Создать договор
          </Link>
        </div>
      ) : (
        <ContractsView contracts={rows} />
      )}
    </div>
  )
}
