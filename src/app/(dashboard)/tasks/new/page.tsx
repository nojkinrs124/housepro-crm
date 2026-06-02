import { createTaskAction } from '@/features/tasks/actions/tasks.actions'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, CheckSquare } from 'lucide-react'
import Link from 'next/link'

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{
    lead_id?: string; client_id?: string; deal_id?: string;
    property_id?: string; contract_id?: string; payment_id?: string;
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Загружаем все сущности для привязки
  const [{ data: users }, { data: clients }, { data: deals }, { data: properties }, { data: contracts }] = await Promise.all([
    supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('contacts').select('id, full_name').order('full_name'),
    supabase.from('deals').select('id, deal_type, created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('properties').select('id, title, address').order('title').limit(50),
    supabase.from('contracts').select('id, contract_number').order('created_at', { ascending: false }).limit(50),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/tasks" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к задачам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
          <CheckSquare className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Новая задача</h1>
          <p className="text-muted-foreground text-sm">Создайте задачу для команды</p>
        </div>
      </div>

      <form action={createTaskAction} className="space-y-4">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Название <span className="text-destructive">*</span>
            </label>
            <input name="title" required placeholder="Позвонить клиенту по договору"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Описание</label>
            <textarea name="description" rows={3} placeholder="Подробности задачи..."
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Приоритет</label>
              <select name="priority" defaultValue="medium"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Дедлайн</label>
              <input name="deadline" type="datetime-local"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Назначить</label>
            <select name="assigned_to"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
              <option value="">Назначить себе</option>
              {(users ?? []).map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Связи */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Привязать к</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Контакт</label>
              <select name="client_id" defaultValue={params.client_id ?? ''}
                className="w-full h-9 px-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="">— не выбрано —</option>
                {(clients ?? []).map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Сделка</label>
              <select name="deal_id" defaultValue={params.deal_id ?? ''}
                className="w-full h-9 px-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="">— не выбрано —</option>
                {(deals ?? []).map(d => (
                  <option key={d.id} value={d.id}>Сделка {new Date(d.created_at).toLocaleDateString('ru-RU')}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Объект</label>
              <select name="property_id" defaultValue={params.property_id ?? ''}
                className="w-full h-9 px-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="">— не выбрано —</option>
                {(properties ?? []).map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Договор</label>
              <select name="contract_id" defaultValue={params.contract_id ?? ''}
                className="w-full h-9 px-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="">— не выбрано —</option>
                {(contracts ?? []).map(c => (
                  <option key={c.id} value={c.id}>{c.contract_number ?? `#${c.id.slice(0,8)}`}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
            <CheckSquare className="w-4 h-4" />
            Создать задачу
          </button>
          <Link href="/tasks"
            className="px-6 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-all">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
