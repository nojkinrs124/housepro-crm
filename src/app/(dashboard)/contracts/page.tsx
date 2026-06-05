import { createClient } from '@/lib/supabase/server'
import { FileText, Plus, Search } from 'lucide-react'
import Link from 'next/link'

const contractTypeLabels: Record<string, string> = {
  rent_apartment: 'Аренда квартиры', rent_commercial: 'Коммерческая аренда',
  sale_apartment: 'Продажа квартиры', sale_house: 'Продажа дома',
  property_management: 'Управление', sublease: 'Субаренда',
  agency_contract: 'Агентский договор',
}
const statusConfig: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  draft:     { label: 'Черновик',  bg: '#F8FAFC', color: '#64748B', dot: '#94A3B8' },
  generated: { label: 'Создан',    bg: '#EFF6FF', color: '#2563EB', dot: '#60A5FA' },
  signed:    { label: 'Подписан',  bg: '#F0FDF4', color: '#16A34A', dot: '#22C55E' },
  completed: { label: 'Завершён',  bg: '#ECFDF5', color: '#059669', dot: '#34D399' },
  cancelled: { label: 'Отменён',   bg: '#FEF2F2', color: '#DC2626', dot: '#F87171' },
}

const cardStyle = {
  background: '#ffffff',
  borderRadius: '20px',
  border: '1px solid rgba(214,219,235,0.6)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)',
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('contracts')
    .select('id, contract_number, contract_type, status, amount, client_id, client_contact_id, property_id, created_at')
    .order('created_at', { ascending: false })

  if (params.search) query = query.ilike('contract_number', `%${params.search}%`)
  if (params.status) query = query.eq('status', params.status)

  const { data: contracts, error } = await query.limit(50)

  const contactIds = [...new Set([
    ...(contracts?.map(c => c.client_contact_id).filter(Boolean) ?? []),
    ...(contracts?.map(c => c.client_id).filter(Boolean) ?? []),
  ])]
  const propertyIds = [...new Set(contracts?.map(c => c.property_id).filter(Boolean) ?? [])]

  const [{ data: contactsData }, { data: propertiesData }] = await Promise.all([
    contactIds.length > 0
      ? supabase.from('contacts').select('id, full_name').in('id', contactIds)
      : Promise.resolve({ data: [] }),
    propertyIds.length > 0
      ? supabase.from('properties').select('id, address, title').in('id', propertyIds)
      : Promise.resolve({ data: [] }),
  ])

  const legacyClientIds = (contracts ?? [])
    .filter(c => !c.client_contact_id && c.client_id)
    .map(c => c.client_id)
    .filter((id): id is string => !!id && !contactIds.includes(id))

  const { data: legacyClientsData } = legacyClientIds.length > 0
    ? await supabase.from('clients').select('id, full_name').in('id', legacyClientIds)
    : { data: [] }

  const clientMap = Object.fromEntries([
    ...(contactsData ?? []).map(c => [c.id, c]),
    ...(legacyClientsData ?? []).map(c => [c.id, c]),
  ])
  const propertyMap = Object.fromEntries((propertiesData ?? []).map(p => [p.id, p]))

  if (error) console.error('Contracts error:', error.message)

  const statusKeys = Object.keys(statusConfig)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Договоры</h1>
          <p className="text-[#64748B] mt-1 text-sm">{contracts?.length ?? 0} договоров</p>
        </div>
        <Link href="/contracts/new"
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-[12px] text-sm font-semibold"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #22C55E)',
            boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
          }}>
          <Plus style={{ width: 16, height: 16 }} />
          Новый договор
        </Link>
      </div>

      {/* Filters */}
      <div style={cardStyle} className="p-4 flex flex-wrap gap-3">
        <form method="get" className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ width: 15, height: 15, color: '#94A3B8' }} />
            <input name="search" defaultValue={params.search}
              placeholder="Поиск по номеру договора..."
              className="w-full h-10 pl-10 pr-4 text-sm text-[#111827] placeholder:text-[#94A3B8] outline-none"
              style={{
                background: '#F8FAFC',
                border: '1.5px solid rgba(214,219,235,0.8)',
                borderRadius: '10px',
              }} />
          </div>
        </form>
        <div className="flex gap-2 flex-wrap">
          <Link href="/contracts"
            className="px-4 py-2 rounded-[10px] text-sm font-semibold transition-all"
            style={{
              background: !params.status ? 'linear-gradient(135deg, #16A34A, #22C55E)' : '#F1F5F9',
              color: !params.status ? '#ffffff' : '#64748B',
            }}>
            Все
          </Link>
          {statusKeys.map(value => {
            const sc = statusConfig[value]
            return (
              <Link key={value} href={`/contracts?status=${value}`}
                className="px-4 py-2 rounded-[10px] text-sm font-semibold transition-all"
                style={{
                  background: params.status === value ? 'linear-gradient(135deg, #16A34A, #22C55E)' : '#F1F5F9',
                  color: params.status === value ? '#ffffff' : '#64748B',
                }}>
                {sc.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div style={cardStyle} className="overflow-hidden">
        {!contracts || contracts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
              <FileText style={{ width: 20, height: 20, color: '#94A3B8' }} />
            </div>
            <p className="text-[#374151] font-semibold">
              {error ? `Ошибка: ${error.message}` : 'Нет договоров'}
            </p>
            <Link href="/contracts/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-[12px] text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
              <Plus style={{ width: 14, height: 14 }} />
              Создать договор
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(214,219,235,0.6)', background: '#F8FAFC' }}>
                  {['Номер', 'Тип', 'Клиент', 'Объект', 'Сумма', 'Статус', 'Дата', ''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide px-4 py-3.5 first:px-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map(contract => {
                  const clientId = contract.client_contact_id || contract.client_id
                  const client = clientId ? clientMap[clientId] : null
                  const property = contract.property_id ? propertyMap[contract.property_id] : null
                  const sc = statusConfig[contract.status] ?? statusConfig.draft
                  return (
                    <tr
                      key={contract.id}
                      style={{ borderBottom: '1px solid rgba(214,219,235,0.4)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8FAFC'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                            style={{ background: '#F5F3FF' }}>
                            <FileText style={{ width: 14, height: 14, color: '#7C3AED' }} />
                          </div>
                          <span className="text-sm font-semibold text-[#111827]">
                            {contract.contract_number ?? `#${contract.id.slice(0, 8)}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-[#64748B]">
                        {contractTypeLabels[contract.contract_type] ?? contract.contract_type}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-[#374151]">
                        {client?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-[#64748B] max-w-xs truncate">
                        {property?.title ?? property?.address ?? '—'}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-[#111827]">
                        {contract.amount ? `${Number(contract.amount).toLocaleString('ru-RU')} ₽` : '—'}
                      </td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-1.5 w-fit text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: sc.bg, color: sc.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-[#64748B]">
                        {new Date(contract.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Link href={`/contracts/${contract.id}`}
                            className="text-sm text-[#16A34A] font-semibold hover:underline">
                            Открыть
                          </Link>
                          <span className="text-[#CBD5E1]">·</span>
                          <Link href={`/contracts/${contract.id}/generate`}
                            className="text-sm text-[#7C3AED] font-semibold hover:underline">
                            DOCX
                          </Link>
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
