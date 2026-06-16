import { createDealAction } from '@/features/deals/actions/deals.actions'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, TrendingUp, User, Building2 } from 'lucide-react'
import Link from 'next/link'
import { formAction } from '@/lib/form-action'

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; property_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Загружаем контакты — единая база (owners + clients)
  const [{ data: rawContacts }, { data: rawProperties }] = await Promise.all([
    supabase.from('contacts').select('id, full_name, phone, role').order('full_name'),
    supabase.from('properties').select('id, title, address').order('title'),
  ])

  const contacts = rawContacts ?? []
  const properties = rawProperties ?? []

  // Фильтруем по ролям
  const owners = contacts.filter(c => c.role === 'owner' || c.role === 'both')
  const clients = contacts.filter(c => c.role === 'client' || c.role === 'both')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/deals" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к сделкам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">Новая сделка</h1>
          <p className="text-muted-foreground text-sm">Укажите обе стороны и объект</p>
        </div>
      </div>

      <form action={formAction(createDealAction)} className="space-y-4">

        {/* Тип сделки */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Тип сделки</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { value: 'rent',       label: '🏠 Аренда' },
              { value: 'sale',       label: '💰 Продажа' },
              { value: 'management', label: '⚙️ Управление' },
              { value: 'commercial', label: '🏢 Коммерция' },
              { value: 'subrent',    label: '🔄 Субаренда' },
            ].map(t => (
              <label key={t.value}
                className="flex items-center gap-2 p-2.5 border border-border rounded-xl cursor-pointer hover:bg-accent transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 text-sm">
                <input type="radio" name="deal_type" value={t.value} defaultChecked={t.value === 'rent'} className="accent-primary" />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        {/* Стороны */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Стороны сделки</h2>

          {/* Собственник — Сторона 1 */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Building2 className="w-4 h-4 text-orange-500" />
              Собственник (Сторона 1)
            </label>
            <select
              name="owner_contact_id"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value="">Выберите собственника</option>
              {owners.map(o => (
                <option key={o.id} value={o.id}>
                  {o.full_name}{o.phone ? ` · ${o.phone}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Нет нужного?{' '}
              <Link href="/contacts/new" className="text-primary hover:underline">Добавить контакт →</Link>
            </p>
          </div>

          {/* Клиент — Сторона 2 */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <User className="w-4 h-4 text-blue-500" />
              Клиент (Сторона 2)
            </label>
            <select
              name="client_contact_id"
              defaultValue={params.client_id ?? ''}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value="">Выберите клиента</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name}{c.phone ? ` · ${c.phone}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Нет нужного?{' '}
              <Link href="/contacts/new" className="text-primary hover:underline">Добавить контакт →</Link>
            </p>
          </div>

          {/* Объект */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Объект</label>
            <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
              <select
                name="property_id"
                defaultValue={params.property_id ?? ''}
                className="w-full sm:flex-1 sm:min-w-0 h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              >
                <option value="">Выберите объект</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.title}{p.address ? ` — ${p.address}` : ''}</option>
                ))}
              </select>
              <Link
                href="/properties/new"
                target="_blank"
                className="h-10 px-4 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <Building2 className="w-4 h-4" />
                Создать
              </Link>
            </div>
          </div>
        </div>

        {/* Финансы */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Финансы</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Сумма сделки (₽)</label>
              <input name="amount" type="number" placeholder="150 000"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Комиссия агентства (₽)</label>
              <input name="commission" type="number" placeholder="15 000"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
          </div>
        </div>

        {/* Примечания */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Примечания</h2>
          <textarea name="notes" rows={3} placeholder="Детали сделки, условия..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit"
            className="flex items-center gap-2 px-6 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all" style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
            <TrendingUp className="w-4 h-4" />
            Создать сделку
          </button>
          <Link href="/deals"
            className="px-6 py-2.5 border border-border text-foreground rounded-[14px] text-sm font-medium hover:bg-accent transition-all">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
