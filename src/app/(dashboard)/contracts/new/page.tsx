import { createContractAction } from '@/features/contracts/actions/contracts.actions'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, FileText, Building2, User, Home } from 'lucide-react'
import Link from 'next/link'
import { formAction } from '@/lib/form-action'

const contractTypes = [
  { value: 'rent_apartment',      label: '🏠 Аренда квартиры' },
  { value: 'rent_commercial',     label: '🏢 Коммерческая аренда' },
  { value: 'sale_apartment',      label: '💰 Продажа квартиры' },
  { value: 'sale_house',          label: '🏡 Продажа дома' },
  { value: 'property_management', label: '⚙️ Управление' },
  { value: 'sublease',            label: '🔄 Субаренда' },
  { value: 'agency_contract',     label: '📋 Агентский' },
]

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; owner_id?: string; property_id?: string; deal_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const [{ data: rawContacts }, { data: rawProperties }] = await Promise.all([
    supabase.from('contacts').select('id, full_name, phone, role').order('full_name'),
    supabase.from('properties').select('id, title, address').order('title'),
  ])

  const contacts = rawContacts ?? []
  const properties = rawProperties ?? []

  const owners  = contacts.filter(c => c.role === 'owner' || c.role === 'both')
  const clients = contacts.filter(c => c.role === 'client' || c.role === 'both')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/contracts" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к договорам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Новый договор</h1>
          <p className="text-muted-foreground text-sm">Укажите обе стороны из единой базы контактов</p>
        </div>
      </div>

      <form action={formAction(createContractAction)} className="space-y-4">

        {/* Тип договора */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Тип договора</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {contractTypes.map(t => (
              <label key={t.value}
                className="flex items-center gap-3 p-3 border border-border rounded-xl cursor-pointer hover:bg-accent transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 text-sm">
                <input type="radio" name="contract_type" value={t.value}
                  defaultChecked={t.value === 'rent_apartment'} className="accent-primary shrink-0" />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        {/* Стороны */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Стороны договора</h2>

          {/* Собственник */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Building2 className="w-4 h-4 text-orange-500" />
              Собственник — Сторона 1
            </label>
            <select name="owner_contact_id" defaultValue={params.owner_id ?? ''}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
              <option value="">Выберите собственника</option>
              {owners.map(o => (
                <option key={o.id} value={o.id}>{o.full_name}{o.phone ? ` · ${o.phone}` : ''}</option>
              ))}
            </select>
            {owners.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Нет контактов с ролью «Собственник».{' '}
                <Link href="/contacts/new" className="text-primary hover:underline">Добавить →</Link>
              </p>
            )}
          </div>

          {/* Клиент */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <User className="w-4 h-4 text-blue-500" />
              Клиент — Сторона 2
            </label>
            <select name="client_contact_id" defaultValue={params.client_id ?? ''}
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
              <option value="">Выберите клиента</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}{c.phone ? ` · ${c.phone}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Объект */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Home className="w-4 h-4 text-emerald-500" />
              Объект
            </label>
            <div className="flex items-center gap-2">
              <select name="property_id" defaultValue={params.property_id ?? ''}
                className="flex-1 h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="">Выберите объект</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.title}{p.address ? ` — ${p.address}` : ''}</option>
                ))}
              </select>
              <Link href="/properties/new" target="_blank"
                className="h-10 px-3 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition flex items-center gap-1 whitespace-nowrap">
                <Home className="w-4 h-4" />
                Создать
              </Link>
            </div>
          </div>
        </div>

        {/* Финансы и сроки */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Финансы и сроки</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'amount',  label: 'Сумма (₽)',  placeholder: '50 000' },
              { name: 'deposit', label: 'Залог (₽)',   placeholder: '50 000' },
            ].map(f => (
              <div key={f.name} className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{f.label}</label>
                <input name={f.name} type="number" placeholder={f.placeholder}
                  className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              </div>
            ))}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Дата начала</label>
              <input name="start_date" type="date"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Дата окончания</label>
              <input name="end_date" type="date"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
          </div>
        </div>

        {/* Примечания */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Примечания</h2>
          <textarea name="notes" rows={3} placeholder="Дополнительные условия..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
            <FileText className="w-4 h-4" />
            Создать договор
          </button>
          <Link href="/contracts"
            className="px-6 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-all">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
