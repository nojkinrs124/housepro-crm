import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateLeadAction } from '@/features/leads/actions/leads.actions'
import { formAction } from '@/lib/form-action'

const sourceOptions = [
  { value: 'avito', label: '🟡 Авито' }, { value: 'cian', label: '🟢 ЦИАН' },
  { value: 'domclick', label: '🔵 Домклик' }, { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'telegram', label: '✈️ Telegram' }, { value: 'call', label: '📞 Звонок' },
  { value: 'website', label: '🌐 Сайт' }, { value: 'referral', label: '🤝 Рекомендация' },
  { value: 'instagram', label: '📸 Instagram' }, { value: 'vk', label: '💙 VK' },
  { value: 'other', label: '📌 Другое' },
]
const dealTypes = [
  { value: 'rent', label: 'Аренда' }, { value: 'sale', label: 'Покупка' }, { value: 'subrent', label: 'Субаренда' },
]
const propertyTypes = [
  { value: 'apartment', label: 'Квартира' }, { value: 'house', label: 'Дом' },
  { value: 'commercial', label: 'Коммерция' }, { value: 'office', label: 'Офис' }, { value: 'land', label: 'Участок' },
]

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: rawLead }, { data: users }] = await Promise.all([
    supabase.from('leads').select('*').eq('id', id).single(),
    supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
  ])

  if (!rawLead) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const l = rawLead as any
  const boundAction = updateLeadAction.bind(null, id)

  const inp = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all'
  const lbl = 'block text-sm font-medium text-foreground mb-1.5'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/leads/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к лиду
      </Link>

      <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">Редактировать лид</h1>

      <form action={formAction(boundAction)} className="space-y-4">

        {/* Контакт */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Контакт</h2>
          <div>
            <label className={lbl}>Имя</label>
            <input name="full_name" defaultValue={l.full_name ?? ''} className={inp} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { name: 'phone',    label: 'Телефон',  type: 'tel' },
              { name: 'email',    label: 'Email',    type: 'email' },
              { name: 'telegram', label: 'Telegram', type: 'text' },
              { name: 'whatsapp', label: 'WhatsApp', type: 'text' },
            ].map(f => (
              <div key={f.name}>
                <label className={lbl}>{f.label}</label>
                <input name={f.name} type={f.type} defaultValue={l[f.name] ?? ''} className={inp} />
              </div>
            ))}
          </div>
        </div>

        {/* Источник */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Источник и ответственный</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Источник</label>
              <select name="source" defaultValue={l.source ?? ''}
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="">— не выбрано —</option>
                {sourceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Ответственный</label>
              <select name="assigned_to" defaultValue={l.assigned_to ?? ''}
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="">— не назначен —</option>
                {(users ?? []).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Следующий контакт</label>
            <input name="next_contact_at" type="datetime-local"
              defaultValue={l.next_contact_at ? l.next_contact_at.slice(0, 16) : ''}
              className={inp} />
          </div>
        </div>

        {/* Критерии */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Критерии подбора</h2>
          <div>
            <label className={lbl}>Тип сделки</label>
            <div className="flex gap-2 flex-wrap">
              {dealTypes.map(t => (
                <label key={t.value}
                  className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl cursor-pointer hover:bg-accent transition text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" name="deal_type" value={t.value} defaultChecked={l.deal_type === t.value} className="accent-primary" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl}>Тип объекта</label>
            <div className="flex gap-2 flex-wrap">
              {propertyTypes.map(t => (
                <label key={t.value}
                  className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl cursor-pointer hover:bg-accent transition text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" name="property_type" value={t.value} defaultChecked={l.property_type === t.value} className="accent-primary" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Бюджет от (₽)</label>
              <input name="budget_min" type="number" defaultValue={l.budget_min ?? ''} className={inp} />
            </div>
            <div>
              <label className={lbl}>Бюджет до (₽)</label>
              <input name="budget_max" type="number" defaultValue={l.budget_max ?? ''} className={inp} />
            </div>
            <div>
              <label className={lbl}>Комнат</label>
              <select name="rooms" defaultValue={l.rooms ?? ''}
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="">Любое</option>
                {['1','2','3','4'].map(r => <option key={r} value={r}>{r}{r === '4' ? '+' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Район</label>
              <input name="district" defaultValue={l.district ?? ''} placeholder="Центр, Кировский р-н..." className={inp} />
            </div>
            <div>
              <label className={lbl}>Площадь от (м²)</label>
              <input name="area_min" type="number" defaultValue={l.area_min ?? ''} className={inp} />
            </div>
            <div>
              <label className={lbl}>Площадь до (м²)</label>
              <input name="area_max" type="number" defaultValue={l.area_max ?? ''} className={inp} />
            </div>
          </div>
        </div>

        {/* Комментарий */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Комментарий</h2>
          <textarea name="comment" rows={3} defaultValue={l.comment ?? ''}
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>

        <div className="flex gap-3">
          <button type="submit"
            className="flex-1 h-10 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition" style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
            Сохранить изменения
          </button>
          <Link href={`/leads/${id}`}
            className="flex-1 h-10 flex items-center justify-center border border-border rounded-xl text-sm font-medium hover:bg-accent transition">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
