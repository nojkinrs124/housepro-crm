import { createClient } from '@/lib/supabase/server'
import { Users, Home, FileText, CheckSquare, TrendingUp, Clock } from 'lucide-react'

async function getStats() {
  const supabase = await createClient()

  const [clients, properties, contracts, tasks] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('properties').select('id', { count: 'exact', head: true }),
    supabase.from('contracts').select('id', { count: 'exact', head: true }),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'done'),
  ])

  return {
    clients: clients.count ?? 0,
    properties: properties.count ?? 0,
    contracts: contracts.count ?? 0,
    tasks: tasks.count ?? 0,
  }
}

async function getRecentClients() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('id, full_name, phone, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)
  return data ?? []
}

async function getRecentContracts() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contracts')
    .select('id, contract_number, contract_type, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)
  return data ?? []
}

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  vip: 'bg-purple-100 text-purple-700',
  draft: 'bg-gray-100 text-gray-600',
  generated: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  completed: 'bg-green-200 text-green-800',
  cancelled: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  active: 'Активный',
  closed: 'Закрыт',
  vip: 'VIP',
  draft: 'Черновик',
  generated: 'Создан',
  signed: 'Подписан',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

const contractTypeLabels: Record<string, string> = {
  rent_apartment: 'Аренда квартиры',
  rent_commercial: 'Коммерческая аренда',
  sale_apartment: 'Продажа квартиры',
  sale_house: 'Продажа дома',
  property_management: 'Управление',
  sublease: 'Субаренда',
  agency_contract: 'Агентский',
}

export default async function DashboardPage() {
  const [stats, recentClients, recentContracts] = await Promise.all([
    getStats(),
    getRecentClients(),
    getRecentContracts(),
  ])

  const statCards = [
    {
      title: 'Клиентов',
      value: stats.clients,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/clients',
    },
    {
      title: 'Объектов',
      value: stats.properties,
      icon: Home,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      href: '/properties',
    },
    {
      title: 'Договоров',
      value: stats.contracts,
      icon: FileText,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      href: '/contracts',
    },
    {
      title: 'Задач',
      value: stats.tasks,
      icon: CheckSquare,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      href: '/tasks',
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Дашборд</h1>
        <p className="text-muted-foreground mt-1">Обзор активности агентства</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <a
              key={card.title}
              href={card.href}
              className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-3xl font-bold text-foreground mt-1 group-hover:text-primary transition-colors">
                    {card.value}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                <TrendingUp className="w-3 h-3" />
                <span>Всего в системе</span>
              </div>
            </a>
          )
        })}
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Clients */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Последние клиенты</h2>
            <a href="/clients" className="text-sm text-primary hover:underline">
              Все клиенты →
            </a>
          </div>

          {recentClients.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-muted-foreground text-sm">Нет клиентов</p>
              <a
                href="/clients?new=true"
                className="text-primary text-sm hover:underline mt-1 inline-block"
              >
                Добавить первого клиента
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {recentClients.map((client) => (
                <a
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary text-xs font-semibold">
                        {client.full_name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{client.full_name}</p>
                      <p className="text-xs text-muted-foreground">{client.phone ?? 'Нет телефона'}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[client.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {statusLabels[client.status] ?? client.status}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Recent Contracts */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Последние договоры</h2>
            <a href="/contracts" className="text-sm text-primary hover:underline">
              Все договоры →
            </a>
          </div>

          {recentContracts.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-muted-foreground text-sm">Нет договоров</p>
              <a
                href="/contracts?new=true"
                className="text-primary text-sm hover:underline mt-1 inline-block"
              >
                Создать договор
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {recentContracts.map((contract) => (
                <a
                  key={contract.id}
                  href={`/contracts/${contract.id}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {contract.contract_number ?? `#${contract.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contractTypeLabels[contract.contract_type] ?? contract.contract_type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[contract.status] ?? 'bg-gray-100'}`}>
                      {statusLabels[contract.status] ?? contract.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Быстрые действия</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Создайте новую запись прямо сейчас</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Новый клиент', href: '/clients?new=true' },
              { label: 'Новый объект', href: '/properties?new=true' },
              { label: 'Новый договор', href: '/contracts?new=true' },
            ].map((action) => (
              <a
                key={action.href}
                href={action.href}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
              >
                + {action.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Today info */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>
          Сегодня: {new Date().toLocaleDateString('ru-RU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>
  )
}
