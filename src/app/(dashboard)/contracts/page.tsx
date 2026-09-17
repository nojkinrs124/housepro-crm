import { createClient } from '@/lib/supabase/server'
import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/layout/EmptyState'
import { isId, plural } from '@/lib/utils'
import { ContractsView, type ContractRow } from '@/features/contracts/components/ContractsView'
import { getContractTypeConfig } from '@/features/contracts/config/contract-types'

export default async function ContractsPage() {
  const supabase = await createClient()

  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, contract_number, contract_type, status, amount, client_contact_id, owner_contact_id, property_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const contactIds = [...new Set([
    ...(contracts?.map(c => c.client_contact_id).filter(isId) ?? []),
    ...(contracts?.map(c => c.owner_contact_id).filter(isId) ?? []),
  ])]
  const propertyIds = [...new Set(contracts?.map(c => c.property_id).filter(isId) ?? [])]

  const [{ data: contactsData }, { data: propertiesData }] = await Promise.all([
    contactIds.length > 0
      ? supabase.from('contacts').select('id, full_name, company_name').in('id', contactIds)
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
    // Вторую сторону называет справочник типов: у аренды и продажи это клиент,
    // у управления и агентского договора с собственником — собственник (первой
    // стороной там стоит агентство). Раньше читался только client_contact_id, и
    // у всех договоров управления колонка была пуста.
    // Тип неизвестен (остался от удалённого) — берём то, что заполнено.
    const party2 = getContractTypeConfig(c.contract_type)?.party2Role
      ?? (c.client_contact_id ? 'client' : 'owner')
    const role = party2 === 'owner' ? 'owner' as const : 'client' as const
    const counterpartyId = role === 'owner' ? c.owner_contact_id : c.client_contact_id
    const counterparty = counterpartyId ? clientMap[counterpartyId] : null
    const property = c.property_id ? propertyMap[c.property_id] : null
    return {
      id: c.id,
      number: c.contract_number ?? `#${c.id.slice(0, 8)}`,
      contractType: c.contract_type,
      status: c.status,
      amount: c.amount === null ? null : Number(c.amount),
      counterpartyName: counterparty?.company_name || counterparty?.full_name || null,
      counterpartyRole: role,
      propertyLabel: property?.title ?? property?.address ?? null,
      createdAt: c.created_at,
    }
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Договоры"
        subtitle={plural(rows.length, ['договор', 'договора', 'договоров'])}
        actions={
          <Link href="/contracts/new" className={buttonVariants({ size: 'sm' })}>
            <Plus style={{ width: 16, height: 16 }} />
            Новый договор
          </Link>
        }
      />

      {rows.length === 0 ? (
        error ? (
          <EmptyState
            icon={<FileText className="w-5 h-5 text-[var(--hp-sub)]" />}
            title="Не получилось загрузить договоры"
            description="Обновите страницу. Если ошибка повторится — напишите в поддержку."
          />
        ) : (
          <EmptyState
            icon={<FileText className="w-5 h-5 text-[var(--hp-sub)]" />}
            title="Договоров пока нет"
            description="Договор создаётся из сделки или отдельно: выберите тип, стороны и объект — документ сформируется по шаблону агентства."
            actionHref="/contracts/new"
            actionLabel="Новый договор"
          />
        )
      ) : (
        <ContractsView contracts={rows} />
      )}
    </div>
  )
}
