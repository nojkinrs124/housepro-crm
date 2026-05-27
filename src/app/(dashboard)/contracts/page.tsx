import { createClient } from '@/lib/supabase/server'
import { FileText, Plus, Search } from 'lucide-react'
import Link from 'next/link'

const contractTypeLabels: Record<string, string> = {
  rent_apartment: 'Аренда квартиры', rent_commercial: 'Коммерческая аренда',
  sale_apartment: 'Продажа квартиры', sale_house: 'Продажа дома',
  property_management: 'Управление', sublease: 'Субаренда',
  agency_contract: 'Агентский договор',
}
const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', generated: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700', completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
}
const statusLabels: Record<string, string> = {
  draft: 'Черновик', generated: 'Создан', signed: 'Подписан',
  completed: 'Завершён', cancelled: 'Отменён',
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Простой запрос без сложных JOIN
  let query = supabase
    .from('contracts')
    .select('id, contract_number, contract_type, status, amount, client_id, property_id, created_at')
    .order('created_at', { ascending: false })

  if (params.search) query = query.ilike('contract_number', `%${params.search}%`)
  if (params.status) query = query.eq('status', params.status)

  const { data: contracts, error } = await query.limit(50)

  // Загружаем клиентов и объекты отдельно
  const clientIds = [...new Set(contracts?.map(c => c.client_id).filter(Boolean) ?? [])]
  const propertyIds = [...new Set(contracts?.map(c => c.property_id).filter(Boolean) ?? [])]

  const [{ data: clientsData }, { data: propertiesData }] = await Promise.all([
    clientIds.length > 0
      ? supabase.from('clients').select('id, full_name').in('id', clientIds)
      : Promise.resolve({ data: [] }),
    propertyIds.length > 0
      ? supabase.from('properties').select('id, address, title').in('id', propertyIds)
      : Promise.resolve({ data: [] }),
  ])

  const clientMap = Object.fromEntries((clientsData ?? []).map(c => [c.id, c]))
  const propertyMap = Object.fromEntries((propertiesData ?? []).map(p => [p.id, p]))

  if (error) console.error('Contracts error:', error.message)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Договоры</h1>
          <p className="text-muted-foreground mt-1">{contracts?.length ?? 0} договоров</p>
        </div>
        <Link href="/contracts/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" />Новый договор
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3">
        <form method="get" className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input name="search" defaultValue={params.search}
              placeholder="Поиск по номеру договора..."
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          </div>
        </form>
        <div className="flex gap-2 flex-wrap">
          <Link href="/contracts"
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${!params.status ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            Все
          </Link>
          {Object.entries(statusLabels).map(([value, label]) => (
            <Link key={value} href={`/contracts?status=${value}`}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${params.status === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {!contracts || contracts.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground font-medium">
              {error ? `Ошибка загрузки: ${error.message}` : 'Нет договоров'}
            </p>
            <Link href="/contracts/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
              <Plus className="w-4 h-4" />Создать договор
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Номер', 'Тип', 'Клиент', 'Объект', 'Сумма', 'Статус', 'Дата', ''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3 first:px-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contracts.map(contract => {
                  const client = contract.client_id ? clientMap[contract.client_id] : null
                  const property = contract.property_id ? propertyMap[contract.property_id] : null
                  return (
                    <tr key={contract.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-violet-600" />
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {contract.contract_number ?? `#${contract.id.slice(0, 8)}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {contractTypeLabels[contract.contract_type] ?? contract.contract_type}
                      </td>
                      <td className="px-4 py-4 text-sm text-foreground">
                        {client?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground max-w-xs truncate">
                        {property?.title ?? property?.address ?? '—'}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-foreground">
                        {contract.amount ? `${Number(contract.amount).toLocaleString('ru-RU')} ₽` : '—'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[contract.status] ?? 'bg-gray-100'}`}>
                          {statusLabels[contract.status] ?? contract.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {new Date(contract.created_at).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/contracts/${contract.id}`} className="text-sm text-primary hover:underline">
                            Открыть
                          </Link>
                          <span className="text-muted-foreground">·</span>
                          <Link href={`/contracts/${contract.id}/generate`} className="text-sm text-violet-600 hover:underline">
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
