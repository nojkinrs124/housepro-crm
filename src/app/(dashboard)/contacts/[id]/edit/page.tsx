import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateContactAction } from '@/features/contacts/actions/contacts.actions'
import type { Contact } from '@/types/database'

export default async function EditContactPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!contact) notFound()

  const c = contact as Contact
  const boundAction = updateContactAction.bind(null, params.id)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/contacts/${params.id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к контакту
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Редактировать контакт</h1>
        <p className="text-muted-foreground mt-1">{c.full_name}</p>
      </div>

      <form action={boundAction} className="bg-card border border-border rounded-2xl p-6 space-y-8">
        {/* Basic Info */}
        <div className="space-y-5">
          <h3 className="font-semibold text-foreground">Основная информация</h3>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Полное имя *
            </label>
            <input
              type="text"
              name="full_name"
              required
              defaultValue={c.full_name}
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Роль *
              </label>
              <select
                name="role"
                required
                defaultValue={c.role}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              >
                <option value="client">👥 Клиент</option>
                <option value="owner">🏠 Собственник</option>
                <option value="both">🔄 Клиент + Собственник</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Статус
              </label>
              <select
                name="status"
                defaultValue={c.status}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              >
                <option value="new">Новый</option>
                <option value="active">Активный</option>
                <option value="vip">VIP</option>
                <option value="inactive">Неактивный</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-5 border-t border-border pt-6">
          <h3 className="font-semibold text-foreground">Контактная информация</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Телефон
              </label>
              <input
                type="tel"
                name="phone"
                defaultValue={c.phone || ''}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                defaultValue={c.email || ''}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Telegram
              </label>
              <input
                type="text"
                name="telegram"
                defaultValue={c.telegram || ''}
                placeholder="@username"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                WhatsApp
              </label>
              <input
                type="text"
                name="whatsapp"
                defaultValue={c.whatsapp || ''}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Дата рождения
              </label>
              <input
                type="date"
                name="birth_date"
                defaultValue={c.birth_date ? c.birth_date.split('T')[0] : ''}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Источник
              </label>
              <select
                name="source"
                defaultValue={c.source || ''}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Выберите источник</option>
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
          </div>
        </div>

        {/* Passport */}
        <div className="space-y-5 border-t border-border pt-6">
          <h3 className="font-semibold text-foreground">Паспортные данные</h3>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Паспорт (серия и номер)
            </label>
            <input
              type="text"
              name="passport"
              defaultValue={c.passport || ''}
              placeholder="7700 123456"
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-5 border-t border-border pt-6">
          <h3 className="font-semibold text-foreground">Адрес регистрации</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Страна
              </label>
              <input
                type="text"
                name="country"
                defaultValue={c.country || ''}
                placeholder="Россия"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Регион
              </label>
              <input
                type="text"
                name="region"
                defaultValue={c.region || ''}
                placeholder="Московская область"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Город
              </label>
              <input
                type="text"
                name="city"
                defaultValue={c.city || ''}
                placeholder="Москва"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Улица
              </label>
              <input
                type="text"
                name="street"
                defaultValue={c.street || ''}
                placeholder="ул. Тверская"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Дом
              </label>
              <input
                type="text"
                name="house_number"
                defaultValue={c.house_number || ''}
                placeholder="10"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Корпус
              </label>
              <input
                type="text"
                name="building"
                defaultValue={c.building || ''}
                placeholder="1"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">
                Квартира
              </label>
              <input
                type="text"
                name="apartment"
                defaultValue={c.apartment || ''}
                placeholder="101"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-5 border-t border-border pt-6">
          <h3 className="font-semibold text-foreground">Дополнительно</h3>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Комментарий
            </label>
            <textarea
              name="comment"
              rows={4}
              defaultValue={c.comment || ''}
              placeholder="Дополнительная информация о контакте..."
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
        >
          Сохранить изменения
        </button>
      </form>
    </div>
  )
}
