import { createClient } from '@/lib/supabase/server'
import { Users, Shield, UserCheck, User, Plus } from 'lucide-react'
import Link from 'next/link'

const roleLabels: Record<string, string> = {
  admin: 'Администратор', manager: 'Менеджер',
  agent: 'Риелтор', accountant: 'Бухгалтер',
}
const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-700', manager: 'bg-blue-100 text-blue-700',
  agent: 'bg-green-100 text-green-700', accountant: 'bg-purple-100 text-purple-700',
}
const roleIcons: Record<string, typeof Shield> = {
  admin: Shield, manager: UserCheck, agent: User, accountant: User,
}

export default async function EmployeesPage() {
  const supabase = await createClient()

  const { data: employees } = await supabase
    .from('users')
    .select('id, full_name, email, role, phone, is_active, created_at')
    .order('created_at', { ascending: false })

  // Считаем статистику для каждого
  const empIds = employees?.map(e => e.id) ?? []
  const [{ data: clientStats }, { data: contractStats }, { data: dealStats }] = await Promise.all([
    supabase.from('clients').select('manager_id').in('manager_id', empIds),
    supabase.from('contracts').select('manager_id').in('manager_id', empIds),
    supabase.from('deals').select('manager_id').in('manager_id', empIds),
  ])

  const countBy = (arr: { manager_id: string }[] | null, id: string) =>
    (arr ?? []).filter(x => x.manager_id === id).length

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Сотрудники</h1>
          <p className="text-muted-foreground mt-1">{employees?.length ?? 0} сотрудников</p>
        </div>
        <Link
          href="/employees/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {['admin', 'manager', 'agent', 'accountant'].map(role => {
          const count = employees?.filter(e => e.role === role).length ?? 0
          const Icon = roleIcons[role]
          return (
            <div key={role} className="bg-card border border-border rounded-2xl p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${roleColors[role].replace('text-', 'text-').replace('bg-', 'bg-')}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground">{roleLabels[role]}</p>
            </div>
          )
        })}
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {!employees?.length ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">Нет сотрудников</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {employees.map(emp => {
              const Icon = roleIcons[emp.role] ?? User
              const clients = countBy(clientStats as { manager_id: string }[], emp.id)
              const contracts = countBy(contractStats as { manager_id: string }[], emp.id)
              const deals = countBy(dealStats as { manager_id: string }[], emp.id)

              return (
                <Link key={emp.id} href={`/employees/${emp.id}`} className="p-5 flex items-center gap-4 hover:bg-accent/30 transition-colors">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary text-lg font-bold">
                      {emp.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{emp.full_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[emp.role] ?? 'bg-gray-100'}`}>
                        {roleLabels[emp.role] ?? emp.role}
                      </span>
                      {!emp.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">
                          Неактивен
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{emp.email}</p>
                    {emp.phone && <p className="text-sm text-muted-foreground">{emp.phone}</p>}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{clients}</p>
                      <p className="text-xs text-muted-foreground">Клиентов</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{deals}</p>
                      <p className="text-xs text-muted-foreground">Сделок</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{contracts}</p>
                      <p className="text-xs text-muted-foreground">Договоров</p>
                    </div>
                    <div className="text-center text-xs text-muted-foreground">
                      <p>с {new Date(emp.created_at).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
