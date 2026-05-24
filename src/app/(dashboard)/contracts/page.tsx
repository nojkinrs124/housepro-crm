import { createClient } from '@/lib/supabase/server'
import { FileText, Plus, Search } from 'lucide-react'
import Link from 'next/link'

const contractTypeLabels: Record<string, string> = {
  rent_apartment: 'Аренда квартиры',
  rent_commercial: 'Коммерческая аренда',
  sale_apartment: 'Продажа квартиры',
  sale_house: 'Продажа дома',
  property_management: 'Управление',
  sublease: 'Субаренда',
  agency_contract: 'Агентский договор',
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  generated: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  generated: 'Создан',
  signed: 'Подписан',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; type?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('contracts')
    .select(`
      *,
      client:clients(full_name, phone),
      property:properties(title, address),
      manager:users(full_name)
    `)
    .order('created_at', { ascending: false })

  if (params.search) {
    query = query.ilike('contract_number', `%${params.search}%`)
  }
  if (params.status) query = query.eq('status', params.status)
  if (params.type) query = query.eq('contract_type', params.type)

  const { data: contracts } = await query.limit(50)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Договоры</h1>
          <p className="text-muted-foreground mt-1">{contracts?.length ?? 0} договоров</p>
        </div>
        <Link
          href="/contracts/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" />
          Новый договор
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex flex-wrap gap-3">
          <form method="get" className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                name="search"
                defaultValue={params.search}
                placeholder="Поиск по номеру договора..."
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </form>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(statusLabels).map(([value, label]) => (
              <Link
                key={value}
                href={`/contracts?status=${value}`}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  params.status === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {!contracts || contracts.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground font-medium">Нет договоров</p>
            <Link
              href="/contracts/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" />
              Создать договор
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-6 py-3">Номер</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Тип</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Клиент</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Объект</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Сумма</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Статус</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Дата</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contracts.map((contract) => (
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
                      {(contract.client as { full_name?: string } | null)?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {(contract.property as { address?: string } | null)?.address ?? '—'}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-foreground">
                      {contract.amount ? `${contract.amount.toLocaleString('ru-RU')} ₽` : '—'}
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
                      <Link href={`/contracts/${contract.id}`} className="text-sm text-primary hover:underline">
                        Открыть →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
