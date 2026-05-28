import { createClient } from '@/lib/supabase/server'
import { Users, Home, FileText, CheckSquare, TrendingUp, Zap, Clock, DollarSign } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { count: clientsCount },
    { count: propertiesCount },
    { count: contractsCount },
    { count: tasksCount },
    { count: leadsCount },
    { count: dealsCount },
    { data: recentClients },
    { data: recentContracts },
    { data: myTasks },
  ] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('properties').select('id', { count: 'exact', head: true }),
    supabase.from('contracts').select('id', { count: 'exact', head: true }),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'done'),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('deals').select('id', { count: 'exact', head: true }).not('status', 'in', '("completed","cancelled")'),
    supabase.from('clients').select('id, full_name, phone, status, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('contracts').select('id, contract_number, contract_type, status, amount, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('tasks').select('id, title, priority, deadline, status').eq('assigned_to', user?.id ?? '').neq('status', 'done').order('created_at', { ascending: false }).limit(5),
  ])

  const statCards = [
    { title: 'Новые лиды',     value: leadsCount ?? 0,      icon: Zap,         color: 'text-blue-600',   bg: 'bg-blue-50',   href: '/leads' },
    { title: 'Активных сделок',value: dealsCount ?? 0,      icon: TrendingUp,  color: 'text-green-600',  bg: 'bg-green-50',  href: '/deals' },
    { title: 'Клиентов',       value: clientsCount ?? 0,    icon: Users,       color: 'text-violet-600', bg: 'bg-violet-50', href: '/clients' },
    { title: 'Объектов',       value: propertiesCount ?? 0, icon: Home,        color: 'text-emerald-600',bg: 'bg-emerald-50',href: '/properties' },
    { title: 'Договоров',      value: contractsCount ?? 0,  icon: FileText,    color: 'text-orange-600', bg: 'bg-orange-50', href: '/contracts' },
    { title: 'Задач активных', value: tasksCount ?? 0,      icon: CheckSquare, color: 'text-red-600',    bg: 'bg-red-50',    href: '/tasks' },
  ]

  const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700', in_progress: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-600',
    vip: 'bg-purple-100 text-purple-700',
    draft: 'bg-gray-100 text-gray-600', generated: 'bg-blue-100 text-blue-700',
    signed: 'bg-green-100 text-green-700', completed: 'bg-emerald-100 text-emerald-700',
  }
  const statusLabels: Record<string, string> = {
    new: 'Новый', in_progress: 'В работе', active: 'Активный', closed: 'Закрыт', vip: 'VIP',
    draft: 'Черновик', generated: 'Создан', signed: 'Подписан', completed: 'Завершён',
  }
  const contractTypeLabels: Record<string, string> = {
    rent_apartment: 'Аренда кв.', rent_commercial: 'Ком. аренда',
    sale_apartment: 'Продажа кв.', sale_house: 'Продажа дома',
    property_management: 'Управление', sublease: 'Субаренда', agency_contract: 'Агентский',
  }
  const priorityColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Дашборд</h1>
        <p className="text-muted-foreground mt-1">
          {new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map(card => {
          const Icon = card.icon
          return (
            <Link key={card.title} href={card.href}
              className="bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-all group">
              <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                {card.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.title}</p>
            </Link>
          )
        })}
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent clients */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Последние клиенты</h2>
            <Link href="/clients" className="text-xs text-primary hover:underline">Все →</Link>
          </div>
          {!recentClients?.length ? (
            <div className="text-center py-6">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">Нет клиентов</p>
              <Link href="/clients/new" className="text-xs text-primary hover:underline mt-1 block">+ Добавить</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentClients.map(client => (
                <Link key={client.id} href={`/clients/${client.id}`}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-accent transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary text-xs font-semibold">
                        {client.full_name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{client.full_name}</p>
                      <p className="text-xs text-muted-foreground">{client.phone ?? 'Нет телефона'}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColors[client.status] ?? 'bg-gray-100'}`}>
                    {statusLabels[client.status] ?? client.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent contracts */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Последние договоры</h2>
            <Link href="/contracts" className="text-xs text-primary hover:underline">Все →</Link>
          </div>
          {!recentContracts?.length ? (
            <div className="text-center py-6">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">Нет договоров</p>
              <Link href="/contracts/new" className="text-xs text-primary hover:underline mt-1 block">+ Создать</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentContracts.map(contract => (
                <Link key={contract.id} href={`/contracts/${contract.id}`}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-accent transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {contract.contract_number ?? `#${contract.id.slice(0,8)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contractTypeLabels[contract.contract_type] ?? contract.contract_type}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium block ${statusColors[contract.status] ?? 'bg-gray-100'}`}>
                      {statusLabels[contract.status] ?? contract.status}
                    </span>
                    {contract.amount && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {Number(contract.amount).toLocaleString('ru-RU')} ₽
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My tasks */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Мои задачи</h2>
            <Link href="/tasks" className="text-xs text-primary hover:underline">Все →</Link>
          </div>
          {!myTasks?.length ? (
            <div className="text-center py-6">
              <CheckSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">Нет задач</p>
              <Link href="/tasks/new" className="text-xs text-primary hover:underline mt-1 block">+ Создать задачу</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {myTasks.map(task => (
                <div key={task.id} className="p-2.5 rounded-xl bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${priorityColors[task.priority] ?? 'bg-gray-100'}`}>
                      {task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий'}
                    </span>
                  </div>
                  {task.deadline && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(task.deadline).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                </div>
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
              { label: '+ Лид',      href: '/leads/new',      color: 'bg-blue-600' },
              { label: '+ Клиент',   href: '/clients/new',    color: 'bg-violet-600' },
              { label: '+ Объект',   href: '/properties/new', color: 'bg-emerald-600' },
              { label: '+ Договор',  href: '/contracts/new',  color: 'bg-orange-600' },
              { label: '+ Сделка',   href: '/deals/new',      color: 'bg-green-600' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className={`px-4 py-2 ${a.color} text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all`}>
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
