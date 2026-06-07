import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateContractAction } from '@/features/contracts/actions/contracts.actions'
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

const statusOptions = [
  { value: 'draft',     label: 'Черновик' },
  { value: 'generated', label: 'Создан' },
  { value: 'signed',    label: 'Подписан' },
  { value: 'completed', label: 'Завершён' },
  { value: 'cancelled', label: 'Отменён' },
]

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: rawContract }, { data: rawContacts }, { data: rawProperties }] = await Promise.all([
    supabase.from('contracts').select('*').eq('id', id).single(),
    supabase.from('contacts').select('id, full_name, phone, role').order('full_name'),
    supabase.from('properties').select('id, title, address').order('title'),
  ])

  if (!rawContract) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = rawContract as any
  const contacts = rawContacts ?? []
  const properties = rawProperties ?? []

  const owners  = contacts.filter((x: { role: string }) => x.role === 'owner' || x.role === 'both')
  const clients = contacts.filter((x: { role: string }) => x.role === 'client' || x.role === 'both')

  const boundAction = updateContractAction.bind(null, id)

  const inp = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all'
  const sel = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer'
  const lbl = 'block text-sm font-medium text-foreground mb-1.5'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/contracts/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к договору
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Редактировать договор</h1>
          <p className="text-muted-foreground text-sm">{c.contract_number ?? `#${id.slice(0, 8)}`}</p>
        </div>
      </div>

      <form action={formAction(boundAction)} className="space-y-4">

        {/* Тип и статус */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Основное</h2>

          <div>
            <label className={lbl}>Тип договора</label>
            <div className="grid grid-cols-2 gap-2">
              {contractTypes.map(t => (
                <label key={t.value}
                  className="flex items-center gap-3 p-2.5 border border-border rounded-xl cursor-pointer hover:bg-accent transition has-[:checked]:border-primary has-[:checked]:bg-primary/5 text-sm">
                  <input type="radio" name="contract_type" value={t.value}
                    defaultChecked={c.contract_type === t.value} className="accent-primary shrink-0" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={lbl}>Статус</label>
            <select name="status" defaultValue={c.status ?? 'draft'} className={sel}>
              {statusOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Стороны */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Стороны</h2>

          <div>
            <label className={lbl}>Собственник</label>
            <select name="owner_contact_id" defaultValue={c.owner_contact_id ?? ''} className={sel}>
              <option value="">— не выбрано —</option>
              {owners.map((o: { id: string; full_name: string; phone?: string }) => (
                <option key={o.id} value={o.id}>{o.full_name}{o.phone ? ` · ${o.phone}` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={lbl}>Клиент</label>
            <select name="client_contact_id" defaultValue={c.client_contact_id ?? c.client_id ?? ''} className={sel}>
              <option value="">— не выбрано —</option>
              {clients.map((cl: { id: string; full_name: string; phone?: string }) => (
                <option key={cl.id} value={cl.id}>{cl.full_name}{cl.phone ? ` · ${cl.phone}` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={lbl}>Объект</label>
            <select name="property_id" defaultValue={c.property_id ?? ''} className={sel}>
              <option value="">— не выбрано —</option>
              {properties.map((p: { id: string; title: string; address?: string }) => (
                <option key={p.id} value={p.id}>{p.title}{p.address ? ` — ${p.address}` : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Финансы и сроки */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Финансы и сроки</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Сумма (₽)</label>
              <input name="amount" type="number" defaultValue={c.amount ?? ''} className={inp} />
            </div>
            <div>
              <label className={lbl}>Залог (₽)</label>
              <input name="deposit" type="number" defaultValue={c.deposit ?? ''} className={inp} />
            </div>
            <div>
              <label className={lbl}>Дата начала</label>
              <input name="start_date" type="date" defaultValue={c.start_date ? c.start_date.slice(0,10) : ''} className={inp} />
            </div>
            <div>
              <label className={lbl}>Дата окончания</label>
              <input name="end_date" type="date" defaultValue={c.end_date ? c.end_date.slice(0,10) : ''} className={inp} />
            </div>
          </div>
        </div>

        {/* Примечания */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Примечания</h2>
          <textarea name="notes" rows={3} defaultValue={c.notes ?? ''}
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>

        <div className="flex gap-3">
          <button type="submit"
            className="flex-1 h-10 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition">
            Сохранить изменения
          </button>
          <Link href={`/contracts/${id}`}
            className="flex-1 h-10 flex items-center justify-center border border-border rounded-xl text-sm font-medium hover:bg-accent transition">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
