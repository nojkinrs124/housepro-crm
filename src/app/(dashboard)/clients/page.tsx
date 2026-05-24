import { createClient } from '@/lib/supabase/server'
import { Users, Plus, Search, Phone, MessageCircle } from 'lucide-react'
import Link from 'next/link'

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  vip: 'bg-purple-100 text-purple-700',
  blacklist: 'bg-red-100 text-red-700',
}
const statusLabels: Record<string, string> = {
  new: 'Новый', in_progress: 'В работе', active: 'Активный',
  closed: 'Закрыт', vip: 'VIP', blacklist: 'Чёрный список',
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('clients')
    .select('id, full_name, phone, telegram, comment, status, created_at')
    .order('created_at', { ascending: false })

  if (params.search) {
    query = query.or(`full_name.ilike.%${params.search}%,phone.ilike.%${params.search}%`)
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }

  const { data: clients } = await query.limit(50)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Клиенты</h1>
          <p className="text-muted-foreground mt-1">{clients?.length ?? 0} клиентов в базе</p>
        </div>
        <Link href="/clients/new" className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" />Новый клиент
        </Link>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex flex-wrap gap-3">
          <form method="get" className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input name="search" defaultValue={params.search} placeholder="Поиск по ФИО или телефону..."
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
          </form>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {!clients || clients.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground font-medium">
              {params.search ? 'Ничего не найдено' : 'Нет клиентов'}
            </p>
            {!params.search && (
              <Link href="/clients/new" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
                <Plus className="w-4 h-4" />Добавить клиента
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-6 py-3">Клиент</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Контакты</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Статус</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">Дата</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(clients as Array<{id: string; full_name: string; phone?: string; telegram?: string; comment?: string; status: string; created_at: string}>).map((client) => (
                  <tr key={client.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-primary text-sm font-semibold">{client.full_name?.charAt(0)?.toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{client.full_name}</p>
                          {client.comment && <p className="text-xs text-muted-foreground truncate max-w-xs">{client.comment}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-0.5">
                        {client.phone && (
                          <div className="flex items-center gap-1.5 text-sm text-foreground">
                            <Phone className="w-3 h-3 text-muted-foreground" />{client.phone}
                          </div>
                        )}
                        {client.telegram && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MessageCircle className="w-3 h-3" />{client.telegram}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[client.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[client.status] ?? client.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {new Date(client.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/clients/${client.id}`} className="text-sm text-primary hover:underline">Открыть →</Link>
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
