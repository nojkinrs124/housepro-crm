import { createDealAction } from '@/features/deals/actions/deals.actions'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; property_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const [{ data: clients }, { data: properties }] = await Promise.all([
    supabase.from('clients').select('id, full_name').order('full_name'),
    supabase.from('properties').select('id, title, address').order('title'),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/deals" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к сделкам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Новая сделка</h1>
          <p className="text-muted-foreground text-sm">Создайте сделку по объекту</p>
        </div>
      </div>

      <form action={createDealAction} className="space-y-4">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Тип и стороны</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Тип сделки</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'rent', label: '🏠 Аренда' },
                { value: 'sale', label: '💰 Продажа' },
                { value: 'management', label: '⚙️ Управление' },
                { value: 'commercial', label: '🏢 Коммерция' },
                { value: 'subrent', label: '🔄 Субаренда' },
              ].map(t => (
                <label key={t.value}
                  className="flex items-center gap-2 p-2.5 border border-border rounded-xl cursor-pointer hover:bg-accent transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 text-sm">
                  <input type="radio" name="deal_type" value={t.value} defaultChecked={t.value === 'rent'} className="accent-primary" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Клиент</label>
            <select name="client_id" defaultValue={params.client_id ?? ''}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
              <option value="">Выберите клиента</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Объект</label>
            <select name="property_id" defaultValue={params.property_id ?? ''}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
              <option value="">Выберите объект</option>
              {properties?.map(p => (
                <option key={p.id} value={p.id}>{p.title} — {p.address}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Финансы</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Сумма сделки (₽)</label>
              <input name="amount" type="number" placeholder="150000"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Комиссия агентства (₽)</label>
              <input name="commission" type="number" placeholder="15000"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Примечания</h2>
          <textarea name="notes" rows={3} placeholder="Детали сделки, условия..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
            <TrendingUp className="w-4 h-4" />
            Создать сделку
          </button>
          <Link href="/deals"
            className="px-6 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-all">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
