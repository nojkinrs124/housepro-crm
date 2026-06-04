import { createClient } from '@/lib/supabase/server'
import {
  Users, Home, FileText, CheckSquare, TrendingUp,
  Zap, Clock, DollarSign, AlertTriangle, ArrowUpRight,
  Calendar
} from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const now = new Date().toISOString()

  const [
    { count: contactsCount },
    { count: propertiesCount },
    { count: contractsCount },
    { count: activeTasksCount },
    { count: newLeadsCount },
    { count: activeDealsCount },
    { count: overdueTasksCount },
    { count: overduePaymentsCount },
    { data: dealsByStatus },
    { data: paymentStats },
    { data: recentContacts },
    { data: recentDeals },
    { data: myTasks },
    { data: overduePaymentsList },
    { data: upcomingDeadlines },
  ] = await Promise.all([
    // Счётчики
    supabase.from('contacts').select('id', { count: 'exact', head: true }),
    supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'available'),
    supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'signed'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).not('status', 'in', '(done,cancelled)'),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('deals').select('id', { count: 'exact', head: true }).not('status', 'in', '(completed,cancelled)'),
    // Просроченные
    supabase.from('tasks').select('id', { count: 'exact', head: true })
      .lt('deadline', now).not('status', 'in', '(done,cancelled)'),
    supabase.from('payments').select('id', { count: 'exact', head: true })
      .eq('payment_status', 'overdue'),
    // Аналитика сделок по статусам
    supabase.from('deals').select('status'),
    // Финансы — платежи текущего месяца
    supabase.from('payments')
      .select('amount, payment_status')
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    // Последние контакты
    supabase.from('contacts').select('id, full_name, phone, role, status, created_at')
      .order('created_at', { ascending: false }).limit(5),
    // Последние сделки
    supabase.from('deals').select('id, deal_type, status, amount, created_at, owner_contact:contacts!deals_owner_contact_id_fkey(full_name), client_contact:contacts!deals_client_contact_id_fkey(full_name)')
      .order('created_at', { ascending: false }).limit(5),
    // Мои задачи
    supabase.from('tasks').select('id, title, priority, deadline, status')
      .eq('assigned_to', user?.id ?? '')
      .not('status', 'in', '(done,cancelled)')
      .order('deadline', { ascending: true }).limit(6),
    // Просроченные платежи
    supabase.from('payments').select('id, amount, payment_type, due_date, contract:contracts(contract_number)')
      .eq('payment_status', 'overdue')
      .order('due_date', { ascending: true }).limit(4),
    // Дедлайны задач на ближайшие 7 дней
    supabase.from('tasks').select('id, title, priority, deadline')
      .gte('deadline', now)
      .lte('deadline', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .not('status', 'in', '(done,cancelled)')
      .order('deadline', { ascending: true }).limit(5),
  ])

  // Считаем финансы месяца
  const paidThisMonth = (paymentStats ?? [])
    .filter(p => p.payment_status === 'paid')
    .reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const pendingThisMonth = (paymentStats ?? [])
    .filter(p => ['pending', 'partial'].includes(p.payment_status))
    .reduce((s, p) => s + Number(p.amount ?? 0), 0)

  // Воронка сделок
  const funnelStages = [
    { key: 'new',         label: 'Новые',      color: 'bg-blue-400' },
    { key: 'showing',     label: 'Показы',     color: 'bg-yellow-400' },
    { key: 'negotiation', label: 'Переговоры', color: 'bg-orange-400' },
    { key: 'contract',    label: 'Договор',    color: 'bg-purple-400' },
    { key: 'payment',     label: 'Оплата',     color: 'bg-cyan-400' },
    { key: 'completed',   label: 'Завершено',  color: 'bg-green-400' },
  ]
  const dealCounts = Object.fromEntries(
    funnelStages.map(s => [s.key, (dealsByStatus ?? []).filter(d => d.status === s.key).length])
  )
  const maxDeals = Math.max(...Object.values(dealCounts), 1)

  // Метки
  const roleLabels: Record<string, string> = { client: 'Клиент', owner: 'Собственник', both: 'Кл.+Собств.' }
  const dealTypeLabels: Record<string, string> = {
    rent: 'Аренда', sale: 'Продажа', management: 'Управление', commercial: 'Коммерция', subrent: 'Субаренда',
  }
  const dealStatusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700', showing: 'bg-yellow-100 text-yellow-700',
    negotiation: 'bg-orange-100 text-orange-700', contract: 'bg-purple-100 text-purple-700',
    payment: 'bg-cyan-100 text-cyan-700', completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  const dealStatusLabels: Record<string, string> = {
    new: 'Новая', showing: 'Показ', negotiation: 'Переговоры',
    contract: 'Договор', payment: 'Оплата', completed: 'Завершена', cancelled: 'Отменена',
  }
  const priorityColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-red-100 text-red-700',
  }
  const priorityLabels: Record<string, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий' }
  const contactStatusColors: Record<string, string> = {
    new: 'bg-gray-100 text-gray-600', active: 'bg-blue-100 text-blue-700',
    vip: 'bg-yellow-100 text-yellow-700', inactive: 'bg-red-100 text-red-500',
  }
  const contactStatusLabels: Record<string, string> = {
    new: 'Новый', active: 'Активный', vip: 'VIP', inactive: 'Неактивный',
  }

  const today = new Date()
  const todayStr = today.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Дашборд</h1>
          <p className="text-muted-foreground mt-0.5 capitalize text-sm">{todayStr}</p>
        </div>
        <div className="flex items-center gap-2">
          {(overdueTasksCount ?? 0) > 0 && (
            <Link href="/tasks" className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium hover:bg-red-100 transition">
              <AlertTriangle className="w-3.5 h-3.5" />
              {overdueTasksCount} просроченных задач
            </Link>
          )}
          {(overduePaymentsCount ?? 0) > 0 && (
            <Link href="/payments" className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl text-sm font-medium hover:bg-orange-100 transition">
              <DollarSign className="w-3.5 h-3.5" />
              {overduePaymentsCount} просроченных платежей
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { title: 'Новые лиды',      value: newLeadsCount ?? 0,      icon: Zap,         color: 'text-blue-600',    bg: 'bg-blue-50',    href: '/leads' },
          { title: 'Активных сделок', value: activeDealsCount ?? 0,    icon: TrendingUp,  color: 'text-green-600',   bg: 'bg-green-50',   href: '/deals' },
          { title: 'Контактов',       value: contactsCount ?? 0,       icon: Users,       color: 'text-violet-600',  bg: 'bg-violet-50',  href: '/contacts' },
          { title: 'Свободных объект.',value: propertiesCount ?? 0,    icon: Home,        color: 'text-emerald-600', bg: 'bg-emerald-50', href: '/properties' },
          { title: 'Активных догов.', value: contractsCount ?? 0,      icon: FileText,    color: 'text-orange-600',  bg: 'bg-orange-50',  href: '/contracts' },
          { title: 'Задач в работе',  value: activeTasksCount ?? 0,    icon: CheckSquare, color: 'text-red-600',     bg: 'bg-red-50',     href: '/tasks' },
        ].map(card => {
          const Icon = card.icon
          return (
            <Link key={card.title} href={card.href}
              className="bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-all group">
              <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{card.title}</p>
            </Link>
          )
        })}
      </div>

      {/* Finance + Funnel row */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Finance this month */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-500" />
            Финансы — текущий месяц
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-xl">
              <p className="text-xs text-green-600 font-medium">Получено</p>
              <p className="text-2xl font-bold text-green-700 mt-1">
                {paidThisMonth.toLocaleString('ru-RU')} ₽
              </p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-xl">
              <p className="text-xs text-yellow-600 font-medium">Ожидается</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">
                {pendingThisMonth.toLocaleString('ru-RU')} ₽
              </p>
            </div>
          </div>

          {/* Overdue payments list */}
          {(overduePaymentsList?.length ?? 0) > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-destructive mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Просроченные платежи
              </p>
              <div className="space-y-1.5">
                {overduePaymentsList!.map(p => (
                  <Link key={p.id} href={`/payments/${p.id}/edit`}
                    className="flex items-center justify-between px-3 py-2 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition">
                    <div>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <p className="text-xs font-medium text-foreground">{(p.contract as any)?.contract_number ?? 'Без договора'}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.due_date ? new Date(p.due_date).toLocaleDateString('ru-RU') : '—'}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-red-700">{Number(p.amount).toLocaleString('ru-RU')} ₽</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Deals funnel */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Воронка сделок
          </h2>
          <div className="space-y-2.5">
            {funnelStages.map(stage => {
              const count = dealCounts[stage.key] ?? 0
              const pct = Math.round((count / maxDeals) * 100)
              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">{stage.label}</span>
                  <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${stage.color} rounded-lg transition-all duration-500 flex items-center justify-end pr-2`}
                      style={{ width: count > 0 ? `${Math.max(pct, 8)}%` : '0%' }}
                    >
                      {count > 0 && <span className="text-white text-xs font-bold">{count}</span>}
                    </div>
                  </div>
                  {count === 0 && <span className="text-xs text-muted-foreground">0</span>}
                </div>
              )
            })}
          </div>
          <Link href="/deals"
            className="mt-4 flex items-center gap-1 text-xs text-primary hover:underline">
            Перейти к сделкам <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* 3-column content */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Recent contacts */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Последние контакты</h2>
            <Link href="/contacts" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Все <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {!recentContacts?.length ? (
            <div className="text-center py-6">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">Нет контактов</p>
              <Link href="/contacts/new" className="text-xs text-primary hover:underline mt-1 block">+ Добавить</Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentContacts.map(c => (
                <Link key={c.id} href={`/contacts/${c.id}`}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-accent transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary text-xs font-semibold">{c.full_name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground">{roleLabels[c.role] ?? c.role}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${contactStatusColors[c.status] ?? 'bg-gray-100'}`}>
                    {contactStatusLabels[c.status] ?? c.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent deals */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Последние сделки</h2>
            <Link href="/deals" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Все <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {!recentDeals?.length ? (
            <div className="text-center py-6">
              <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">Нет сделок</p>
              <Link href="/deals/new" className="text-xs text-primary hover:underline mt-1 block">+ Создать</Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentDeals.map(d => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const clientName = (d.client_contact as any)?.full_name ?? (d.owner_contact as any)?.full_name
                return (
                  <Link key={d.id} href={`/deals/${d.id}`}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-accent transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{dealTypeLabels[d.deal_type] ?? d.deal_type}</p>
                      <p className="text-xs text-muted-foreground truncate">{clientName ?? new Date(d.created_at).toLocaleDateString('ru-RU')}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium block ${dealStatusColors[d.status] ?? 'bg-gray-100'}`}>
                        {dealStatusLabels[d.status] ?? d.status}
                      </span>
                      {d.amount && <p className="text-xs text-muted-foreground mt-0.5">{Number(d.amount).toLocaleString('ru-RU')} ₽</p>}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* My tasks + upcoming deadlines */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Мои задачи</h2>
            <Link href="/tasks" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Все <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {!myTasks?.length ? (
            <div className="text-center py-6">
              <CheckSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">Нет активных задач</p>
              <Link href="/tasks/new" className="text-xs text-primary hover:underline mt-1 block">+ Создать задачу</Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {myTasks.map(task => {
                const isOverdue = task.deadline && new Date(task.deadline) < new Date()
                return (
                  <div key={task.id} className={`p-2.5 rounded-xl ${isOverdue ? 'bg-red-50 border border-red-100' : 'bg-muted/30'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${priorityColors[task.priority] ?? 'bg-gray-100'}`}>
                        {priorityLabels[task.priority] ?? task.priority}
                      </span>
                    </div>
                    {task.deadline && (
                      <div className={`flex items-center gap-1 mt-1 text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        <Clock className="w-3 h-3" />
                        {isOverdue ? '⚠ ' : ''}{new Date(task.deadline).toLocaleDateString('ru-RU')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Upcoming 7 days */}
          {(upcomingDeadlines?.length ?? 0) > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Дедлайны на 7 дней
              </p>
              <div className="space-y-1">
                {upcomingDeadlines!.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground truncate max-w-32">{t.title}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {t.deadline ? new Date(t.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''}
                    </span>
                  </div>
                ))}
              </div>
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
              { label: '+ Контакт',  href: '/contacts/new',   color: 'bg-violet-600' },
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
