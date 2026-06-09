import { createClient } from '@/lib/supabase/server'
import { FileText, Plus, Search } from 'lucide-react'
import Link from 'next/link'

const contractTypeLabels: Record<string, string> = {
  rent_apartment: 'Аренда квартиры', rent_commercial: 'Коммерческая аренда',
  sale_apartment: 'Продажа квартиры', sale_house: 'Продажа дома',
  property_management: 'Управление', sublease: 'Субаренда',
  agency_contract: 'Агентский договор',
}
const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
  draft:     { label: 'Черновик',  cls: 'bg-slate-50 text-slate-600',   dot: 'bg-slate-400' },
  generated: { label: 'Создан',    cls: 'bg-blue-50 text-blue-700',     dot: 'bg-blue-400' },
  signed:    { label: 'Подписан',  cls: 'bg-green-50 text-green-700',   dot: 'bg-green-400' },
  completed: { label: 'Завершён',  cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400' },
  cancelled: { label: 'Отменён',   cls: 'bg-red-50 text-red-600',       dot: 'bg-red-400' },
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
  if (params.status)  query = query.eq('status', params.status)

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

  const statusKeys = Object.keys(statusConfig)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Договоры</h1>
          <p className="text-[#64748B] mt-1 text-sm">{contracts?.length ?? 0} договоров</p>
        </div>
        <Link href="/contracts/new"
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
          <Plus style={{ width: 16, height: 16 }} />
          Новый договор
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-4 flex flex-wrap gap-3">
        <form method="get" className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
              style={{ width: 15, height: 15 }} />
            <input name="search" defaultValue={params.search}
              placeholder="Поиск по номеру договора..."
              className="w-full h-10 pl-10 pr-4 text-sm text-[#111827] placeholder:text-slate-400 outline-none bg-slate-50 border border-slate-200 rounded-xl focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all" />
          </div>
        </form>
        <div className="flex gap-2 flex-wrap">
          <Link href="/contracts"
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${!params.status ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            style={!params.status ? { background: 'linear-gradient(135deg, #16A34A, #22C55E)' } : {}}>
            Все
          </Link>
          {statusKeys.map(value => (
            <Link key={value} href={`/contracts?status=${value}`}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${params.status === value ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              style={params.status === value ? { background: 'linear-gradient(135deg, #16A34A, #22C55E)' } : {}}>
              {statusConfig[value].label}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm overflow-hidden">
        {!contracts || contracts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <FileText style={{ width: 20, height: 20 }} className="text-slate-400" />
            </div>
            <p className="text-[#374151] font-semibold">
              {error ? `Ошибка: ${error.message}` : 'Нет договоров'}
            </p>
            <Link href="/contracts/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
              <Plus style={{ width: 14, height: 14 }} />
              Создать договор
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Номер', 'Тип', 'Клиент', 'Объект', 'Сумма', 'Статус', 'Дата', ''].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide px-4 py-3.5 first:px-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contracts.map(contract => {
                    const clientId = contract.client_contact_id || contract.client_id
                    const client   = clientId ? clientMap[clientId] : null
                    const property = contract.property_id ? propertyMap[contract.property_id] : null
                    const sc       = statusConfig[contract.status] ?? statusConfig.draft

                    return (
                      <tr key={contract.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-violet-50 shrink-0">
                              <FileText style={{ width: 14, height: 14 }} className="text-violet-600" />
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
                        <td className="px-4 py-4 text-sm text-[#64748B] max-w-[200px] truncate">
                          {property?.title ?? property?.address ?? '—'}
                        </td>
                        <td className="px-4 py-4 text-sm font-bold text-[#111827]">
                          {contract.amount ? `${Number(contract.amount).toLocaleString('ru-RU')} ₽` : '—'}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`flex items-center gap-1.5 w-fit text-[11px] font-semibold px-2.5 py-1 rounded-full ${sc.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-[#64748B]">
                          {new Date(contract.created_at).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <Link href={`/contracts/${contract.id}`}
                              className="text-sm text-green-600 font-semibold hover:underline">
                              Открыть
                            </Link>
                            <span className="text-slate-300">·</span>
                            <Link href={`/contracts/${contract.id}/generate`}
                              className="text-sm text-violet-600 font-semibold hover:underline">
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

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {contracts.map(contract => {
                const clientId = contract.client_contact_id || contract.client_id
                const client   = clientId ? clientMap[clientId] : null
                const property = contract.property_id ? propertyMap[contract.property_id] : null
                const sc       = statusConfig[contract.status] ?? statusConfig.draft

                return (
                  <Link key={contract.id} href={`/contracts/${contract.id}`} className="block p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-violet-50 shrink-0">
                          <FileText style={{ width: 13, height: 13 }} className="text-violet-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#111827]">
                            {contract.contract_number ?? `#${contract.id.slice(0, 8)}`}
                          </p>
                          <p className="text-xs text-[#64748B]">{contractTypeLabels[contract.contract_type] ?? contract.contract_type}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${sc.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-xs text-[#64748B] mt-1">
                      {client?.full_name && <span>👤 {client.full_name}</span>}
                      {(property?.title || property?.address) && (
                        <span className="truncate max-w-[160px]">🏠 {property.title ?? property.address}</span>
                      )}
                      {contract.amount && (
                        <span className="font-bold text-[#111827]">{Number(contract.amount).toLocaleString('ru-RU')} ₽</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
