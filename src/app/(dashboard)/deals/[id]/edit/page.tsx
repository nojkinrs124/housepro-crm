import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, TrendingUp, Building2, User } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateDealAction } from '@/features/deals/actions/deals.actions'
import { formAction } from '@/lib/form-action'
import { PartyContactSelect } from '@/features/contacts/components/PartyContactSelect'

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: rawDeal }, { data: rawContacts }, { data: rawProperties }, { data: rawReps }] = await Promise.all([
    supabase.from('deals').select('*').eq('id', id).single(),
    supabase.from('contacts').select('id, full_name, phone, role, client_type').order('full_name'),
    supabase.from('properties').select('id, title, address').order('title'),
    supabase.from('contact_representatives').select('id, contact_id, full_name, position, is_primary').order('is_primary', { ascending: false }),
  ])

  if (!rawDeal) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deal = rawDeal as any
  const contacts = rawContacts ?? []
  const properties = rawProperties ?? []

  const owners  = contacts.filter(c => c.role === 'owner' || c.role === 'both')
  const clients = contacts.filter(c => c.role === 'client' || c.role === 'both')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const representativesByContact: Record<string, any[]> = {}
  for (const r of rawReps ?? []) {
    (representativesByContact[r.contact_id] ??= []).push(r)
  }

  const boundAction = updateDealAction.bind(null, id)

  const inp = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all'
  const sel = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer'
  const lbl = 'block text-sm font-medium text-foreground mb-1.5'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/deals/${id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к сделке
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">Редактировать сделку</h1>
          <p className="text-muted-foreground text-sm">
            Создана {new Date(deal.created_at).toLocaleDateString('ru-RU')}
          </p>
        </div>
      </div>

      <form action={formAction(boundAction)} className="space-y-4">

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
                <input type="radio" name="deal_type" value={t.value}
                  defaultChecked={deal.deal_type === t.value}
                  className="w-4 h-4 shrink-0 accent-primary" />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        {/* Статус */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Статус</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { value: 'new',         label: '🔵 Новая' },
              { value: 'showing',     label: '👁 Показ' },
              { value: 'negotiation', label: '🤝 Переговоры' },
              { value: 'contract',    label: '📄 Договор' },
              { value: 'payment',     label: '💳 Оплата' },
              { value: 'completed',   label: '✅ Завершена' },
              { value: 'cancelled',   label: '❌ Отменена' },
            ].map(s => (
              <label key={s.value}
                className="flex items-center gap-2 p-2.5 border border-border rounded-xl cursor-pointer hover:bg-accent transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 text-sm">
                <input type="radio" name="status" value={s.value}
                  defaultChecked={deal.status === s.value}
                  className="w-4 h-4 shrink-0 accent-primary" />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        {/* Стороны */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Стороны сделки</h2>

          <PartyContactSelect
            label="Собственник (Сторона 1)"
            icon={<Building2 className="w-4 h-4 text-orange-500" />}
            contactFieldName="owner_contact_id"
            representativeFieldName="owner_representative_id"
            contacts={owners}
            representativesByContact={representativesByContact}
            defaultContactId={deal.owner_contact_id ?? ''}
            defaultRepresentativeId={deal.owner_representative_id ?? ''}
            placeholder="— не выбрано —"
          />

          <PartyContactSelect
            label="Клиент (Сторона 2)"
            icon={<User className="w-4 h-4 text-blue-500" />}
            contactFieldName="client_contact_id"
            representativeFieldName="client_representative_id"
            contacts={clients}
            representativesByContact={representativesByContact}
            defaultContactId={deal.client_contact_id ?? ''}
            defaultRepresentativeId={deal.client_representative_id ?? ''}
            placeholder="— не выбрано —"
          />

          <div className="space-y-1.5">
            <label className={lbl}>Объект</label>
            <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
              <select name="property_id" defaultValue={deal.property_id ?? ''} className={`${sel} w-full sm:flex-1 sm:min-w-0`}>
                <option value="">— не выбрано —</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title}{p.address ? ` — ${p.address}` : ''}
                  </option>
                ))}
              </select>
              <Link href="/properties/new" target="_blank"
                className="h-10 px-4 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition flex items-center justify-center gap-2 whitespace-nowrap shrink-0">
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
            <div>
              <label className={lbl}>Сумма сделки (₽)</label>
              <input name="amount" type="number" defaultValue={deal.amount ?? ''}
                placeholder="150 000" className={inp} />
            </div>
            <div>
              <label className={lbl}>Комиссия агентства (₽)</label>
              <input name="commission" type="number" defaultValue={deal.commission ?? ''}
                placeholder="15 000" className={inp} />
            </div>
          </div>
        </div>

        {/* Примечания */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Примечания</h2>
          <textarea name="notes" rows={3} defaultValue={deal.notes ?? ''}
            placeholder="Детали сделки, условия..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit"
            className="flex items-center gap-2 px-6 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all" style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
            <TrendingUp className="w-4 h-4" />
            Сохранить изменения
          </button>
          <Link href={`/deals/${id}`}
            className="px-6 py-2.5 border border-border text-foreground rounded-[14px] text-sm font-medium hover:bg-accent transition-all">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
