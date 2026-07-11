import { createDealAction } from '@/features/deals/actions/deals.actions'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, TrendingUp, User, Building2 } from 'lucide-react'
import Link from 'next/link'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { PartyContactSelect } from '@/features/contacts/components/PartyContactSelect'
import { PropertySelectField } from '@/features/properties/components/PropertySelectField'

export default async function NewDealPage({
  searchParams,
}: {
  // contact_id — универсальный параметр (роль определяется автоматически по contacts.role).
  // client_id оставлен для обратной совместимости со старыми ссылками.
  searchParams: Promise<{ contact_id?: string; client_id?: string; property_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Загружаем контакты — единая база (owners + clients)
  const [{ data: rawContacts }, { data: rawProperties }, { data: rawReps }] = await Promise.all([
    supabase.from('contacts').select('id, full_name, phone, role, client_type').order('full_name'),
    supabase.from('properties').select('id, title, address').order('title'),
    supabase.from('contact_representatives').select('id, contact_id, full_name, position, is_primary').order('is_primary', { ascending: false }),
  ])

  const contacts = rawContacts ?? []
  const properties = rawProperties ?? []

  // Фильтруем по ролям
  const owners = contacts.filter(c => c.role === 'owner' || c.role === 'both')
  const clients = contacts.filter(c => c.role === 'client' || c.role === 'both')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const representativesByContact: Record<string, any[]> = {}
  for (const r of rawReps ?? []) {
    (representativesByContact[r.contact_id] ??= []).push(r)
  }

  // Авто-подстановка стороны по роли контакта, из которого создаётся сделка.
  const sourceContactId = params.contact_id ?? params.client_id
  const sourceContact = sourceContactId ? contacts.find(c => c.id === sourceContactId) : undefined

  // При role === 'both' однозначно определить сторону нельзя — по умолчанию считаем клиентом
  // (это самый частый случай перехода "создать сделку" с карточки контакта).
  const ownerDefaultId = sourceContact?.role === 'owner' ? sourceContact.id : ''
  const clientDefaultId = sourceContact?.role === 'client' || sourceContact?.role === 'both'
    ? sourceContact.id
    : (!sourceContact && params.client_id ? params.client_id : '')

  const primaryRepFor = (contactId: string) =>
    (representativesByContact[contactId] ?? []).find(r => r.is_primary)?.id ?? ''

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
          <h1 className="text-[28px] font-bold text-foreground tracking-tight leading-tight">Новая сделка</h1>
          <p className="text-muted-foreground text-sm">Укажите обе стороны и объект</p>
        </div>
      </div>

      <ServerActionForm action={createDealAction} className="space-y-4">

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
                <input type="radio" name="deal_type" value={t.value} defaultChecked={t.value === 'rent'} className="w-4 h-4 shrink-0 accent-primary" />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        {/* Стороны */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Стороны сделки</h2>

          {/* Собственник — Сторона 1 */}
          <PartyContactSelect
            label="Собственник (Сторона 1)"
            icon={<Building2 className="w-4 h-4 text-orange-500" />}
            contactFieldName="owner_contact_id"
            representativeFieldName="owner_representative_id"
            contacts={owners}
            representativesByContact={representativesByContact}
            defaultContactId={ownerDefaultId}
            defaultRepresentativeId={ownerDefaultId ? primaryRepFor(ownerDefaultId) : ''}
            placeholder="Выберите собственника"
            quickCreateRole="owner"
          />

          {/* Клиент — Сторона 2 */}
          <PartyContactSelect
            label="Клиент (Сторона 2)"
            icon={<User className="w-4 h-4 text-blue-500" />}
            contactFieldName="client_contact_id"
            representativeFieldName="client_representative_id"
            contacts={clients}
            representativesByContact={representativesByContact}
            defaultContactId={clientDefaultId}
            defaultRepresentativeId={clientDefaultId ? primaryRepFor(clientDefaultId) : ''}
            placeholder="Выберите клиента"
            quickCreateRole="client"
          />

          {/* Объект */}
          <PropertySelectField properties={properties} defaultPropertyId={params.property_id ?? ''} />
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
            className="flex items-center gap-2 px-6 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all" style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
            <TrendingUp className="w-4 h-4" />
            Создать сделку
          </button>
          <Link href="/deals"
            className="px-6 py-2.5 border border-border text-foreground rounded-[14px] text-sm font-medium hover:bg-accent transition-all">
            Отмена
          </Link>
        </div>
      </ServerActionForm>
    </div>
  )
}
