import { createLeadAction } from '@/features/leads/actions/leads.actions'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Zap } from 'lucide-react'
import Link from 'next/link'
import { ServerActionForm } from '@/components/forms/ServerActionForm'

const sourceOptions = [
  { value: 'avito',    label: '🟡 Авито' },
  { value: 'cian',     label: '🟢 ЦИАН' },
  { value: 'domclick', label: '🔵 Домклик' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'telegram', label: '✈️ Telegram' },
  { value: 'call',     label: '📞 Входящий звонок' },
  { value: 'website',  label: '🌐 Сайт' },
  { value: 'referral', label: '🤝 Рекомендация' },
  { value: 'instagram',label: '📸 Instagram' },
  { value: 'vk',       label: '💙 VK' },
  { value: 'other',    label: '📌 Другое' },
]

const dealTypes = [
  { value: 'rent',    label: 'Аренда' },
  { value: 'sale',    label: 'Покупка' },
  { value: 'subrent', label: 'Субаренда' },
]

const propertyTypes = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house',     label: 'Дом' },
  { value: 'commercial',label: 'Коммерция' },
  { value: 'office',    label: 'Офис' },
  { value: 'land',      label: 'Участок' },
]

export default async function NewLeadPage() {
  const supabase = await createClient()
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name')

  const inp = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all'
  const lbl = 'block text-sm font-medium text-foreground mb-1.5'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/leads" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к лидам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <Zap className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-foreground tracking-tight leading-tight">Новый лид</h1>
          <p className="text-muted-foreground text-sm">Входящее обращение от потенциального клиента</p>
        </div>
      </div>

      <ServerActionForm action={createLeadAction} className="space-y-4">

        {/* Контакт */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Контакт</h2>
          <div>
            <label className={lbl}>Имя</label>
            <input name="full_name" placeholder="Иван Иванов" className={inp} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Телефон</label>
              <input name="phone" type="tel" placeholder="+7 (999) 999-99-99" className={inp} />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input name="email" type="email" placeholder="ivan@mail.ru" className={inp} />
            </div>
            <div>
              <label className={lbl}>Telegram</label>
              <input name="telegram" placeholder="@username" className={inp} />
            </div>
            <div>
              <label className={lbl}>WhatsApp</label>
              <input name="whatsapp" placeholder="+7 (999) 999-99-99" className={inp} />
            </div>
          </div>
        </div>

        {/* Источник и менеджер */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Источник</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Откуда пришёл <span className="text-destructive">*</span></label>
              <select name="source" required
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="">Выберите источник</option>
                {sourceOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Ответственный</label>
              <select name="assigned_to"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="">Назначить себе</option>
                {(users ?? []).map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Следующий контакт</label>
            <input name="next_contact_at" type="datetime-local" className={inp} />
          </div>
        </div>

        {/* Критерии подбора */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Что ищет клиент</h2>

          <div>
            <label className={lbl}>Тип сделки</label>
            <div className="flex flex-wrap gap-2">
              {dealTypes.map(t => (
                <label key={t.value}
                  className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl cursor-pointer hover:bg-accent transition text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" name="deal_type" value={t.value} className="w-4 h-4 shrink-0 accent-primary" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={lbl}>Тип объекта</label>
            <div className="flex flex-wrap gap-2">
              {propertyTypes.map(t => (
                <label key={t.value}
                  className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl cursor-pointer hover:bg-accent transition text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" name="property_type" value={t.value} className="w-4 h-4 shrink-0 accent-primary" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Бюджет от (₽)</label>
              <input name="budget_min" type="number" placeholder="30 000" className={inp} />
            </div>
            <div>
              <label className={lbl}>Бюджет до (₽)</label>
              <input name="budget_max" type="number" placeholder="80 000" className={inp} />
            </div>
            <div>
              <label className={lbl}>Комнат</label>
              <select name="rooms"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="">Любое</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4+</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Район / локация</label>
              <input name="district" placeholder="Центр, Кировский р-н..." className={inp} />
            </div>
            <div>
              <label className={lbl}>Площадь от (м²)</label>
              <input name="area_min" type="number" placeholder="40" className={inp} />
            </div>
            <div>
              <label className={lbl}>Площадь до (м²)</label>
              <input name="area_max" type="number" placeholder="80" className={inp} />
            </div>
          </div>
        </div>

        {/* Комментарий */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Комментарий</h2>
          <textarea name="comment" rows={3}
            placeholder="Что ищет клиент, особые пожелания, срочность..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit"
            className="flex items-center gap-2 px-6 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all" style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
            <Zap className="w-4 h-4" />
            Добавить лид
          </button>
          <Link href="/leads"
            className="px-6 py-2.5 border border-border text-foreground rounded-[14px] text-sm font-medium hover:bg-accent transition-all">
            Отмена
          </Link>
        </div>
      </ServerActionForm>
    </div>
  )
}
