import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateContactAction } from '@/features/contacts/actions/contacts.actions'
import { formAction } from '@/lib/form-action'

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: c } = await supabase.from('contacts').select('*').eq('id', id).single()
  if (!c) notFound()

  const boundAction = updateContactAction.bind(null, id)

  const inputCls = "w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-sm"
  const labelCls = "block text-sm font-medium text-foreground mb-1.5"

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/contacts/${id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к контакту
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Редактировать контакт</h1>
        <p className="text-muted-foreground mt-1">{c.full_name}</p>
      </div>

      <form action={formAction(boundAction)} className="space-y-4">

        {/* Основное */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Основные данные</h2>
          <div>
            <label className={labelCls}>Полное имя *</label>
            <input type="text" name="full_name" required defaultValue={c.full_name} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Роль *</label>
              <select name="role" required defaultValue={c.role}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary text-sm">
                <option value="client">👥 Клиент</option>
                <option value="owner">🏠 Собственник</option>
                <option value="both">🔄 Клиент + Собственник</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Статус</label>
              <select name="status" defaultValue={c.status}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary text-sm">
                <option value="new">Новый</option>
                <option value="active">Активный</option>
                <option value="vip">VIP</option>
                <option value="inactive">Неактивный</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Дата рождения</label>
            <input type="date" name="birth_date" defaultValue={c.birth_date?.split('T')[0] ?? ''} className={inputCls} />
          </div>
        </div>

        {/* Контакты */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Контактные данные</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Телефон', name: 'phone', type: 'tel', val: c.phone },
              { label: 'Email', name: 'email', type: 'email', val: c.email },
              { label: 'Telegram', name: 'telegram', type: 'text', val: c.telegram },
              { label: 'WhatsApp', name: 'whatsapp', type: 'text', val: c.whatsapp },
            ].map(f => (
              <div key={f.name}>
                <label className={labelCls}>{f.label}</label>
                <input type={f.type} name={f.name} defaultValue={f.val ?? ''} className={inputCls} />
              </div>
            ))}
          </div>
        </div>

        {/* Паспорт */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Паспортные данные</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Серия</label>
              <input type="text" name="passport_series" defaultValue={c.passport_series ?? ''} placeholder="1234" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Номер</label>
              <input type="text" name="passport_number" defaultValue={c.passport_number ?? ''} placeholder="567890" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Дата выдачи</label>
              <input type="date" name="passport_issued_date" defaultValue={c.passport_issued_date?.split('T')[0] ?? ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Код подразделения</label>
              <input type="text" name="passport_department_code" defaultValue={c.passport_department_code ?? ''} placeholder="770-001" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Кем выдан</label>
            <input type="text" name="passport_issued_by" defaultValue={c.passport_issued_by ?? ''} placeholder="ОВД Пресненского района" className={inputCls} />
          </div>
        </div>

        {/* Адрес */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Адрес регистрации</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Страна', name: 'country', placeholder: 'Россия', val: c.country },
              { label: 'Регион', name: 'region', placeholder: 'Московская область', val: c.region },
              { label: 'Город', name: 'city', placeholder: 'Москва', val: c.city },
              { label: 'Улица', name: 'street', placeholder: 'ул. Ленина', val: c.street },
              { label: 'Дом', name: 'house_number', placeholder: '15', val: c.house_number },
              { label: 'Корпус', name: 'building', placeholder: '1', val: c.building },
              { label: 'Квартира', name: 'apartment', placeholder: '42', val: c.apartment },
            ].map(f => (
              <div key={f.name}>
                <label className={labelCls}>{f.label}</label>
                <input type="text" name={f.name} defaultValue={f.val ?? ''} placeholder={f.placeholder} className={inputCls} />
              </div>
            ))}
          </div>
        </div>

        {/* Дополнительно */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Дополнительно</h2>
          <div>
            <label className={labelCls}>Источник</label>
            <select name="source" defaultValue={c.source ?? ''}
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary text-sm">
              <option value="">— не выбрано —</option>
              <option value="avito">Avito</option>
              <option value="cian">ЦИАН</option>
              <option value="domclick">Домклик</option>
              <option value="instagram">Instagram</option>
              <option value="vk">VK</option>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Звонок</option>
              <option value="referral">Рекомендация</option>
              <option value="other">Другое</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Комментарий</label>
            <textarea name="comment" rows={3} defaultValue={c.comment ?? ''}
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-sm" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit"
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition text-sm">
            Сохранить изменения
          </button>
          <Link href={`/contacts/${id}`}
            className="px-6 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent transition">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
