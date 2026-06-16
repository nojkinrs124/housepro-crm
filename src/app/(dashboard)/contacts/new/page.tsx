import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createContactAction } from '@/features/contacts/actions/contacts.actions'
import { formAction } from '@/lib/form-action'

export default function NewContactPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/contacts" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к контактам
      </Link>

      <div>
        <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">Добавить контакт</h1>
        <p className="text-muted-foreground mt-1">Клиент, собственник или оба</p>
      </div>

      <form action={formAction(createContactAction)} className="space-y-4">
        {/* Основное */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Основные данные</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Полное имя *</label>
            <input type="text" name="full_name" required
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              placeholder="Иван Иванович Иванов" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Роль *</label>
            <select name="role" required defaultValue="client"
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary">
              <option value="client">👥 Клиент</option>
              <option value="owner">🏠 Собственник</option>
              <option value="both">🔄 Клиент + Собственник</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Дата рождения</label>
            <input type="date" name="birth_date"
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
          </div>
        </div>

        {/* Контакты */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Контактные данные</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Телефон</label>
              <input type="tel" name="phone" placeholder="+7 (999) 123-45-67"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input type="email" name="email" placeholder="user@example.com"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Telegram</label>
              <input type="text" name="telegram" placeholder="@username"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">WhatsApp</label>
              <input type="text" name="whatsapp" placeholder="+7 (999) 123-45-67"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        {/* Паспорт */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Паспортные данные</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Серия</label>
              <input type="text" name="passport_series" placeholder="1234"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Номер</label>
              <input type="text" name="passport_number" placeholder="567890"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Дата выдачи</label>
              <input type="date" name="passport_issued_date"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Код подразделения</label>
              <input type="text" name="passport_department_code" placeholder="770-001"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Кем выдан</label>
            <input type="text" name="passport_issued_by" placeholder="ОВД Пресненского района г. Москвы"
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
          </div>
        </div>

        {/* Адрес */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Адрес регистрации</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Страна</label>
              <input type="text" name="country" placeholder="Россия" defaultValue="Россия"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Регион</label>
              <input type="text" name="region" placeholder="Московская область"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Город</label>
              <input type="text" name="city" placeholder="Москва"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Улица</label>
              <input type="text" name="street" placeholder="ул. Ленина"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Дом</label>
              <input type="text" name="house_number" placeholder="15"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Корпус</label>
              <input type="text" name="building" placeholder="1"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Квартира</label>
              <input type="text" name="apartment" placeholder="42"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        {/* Дополнительно */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Дополнительно</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Источник</label>
            <select name="source"
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary">
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

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Комментарий</label>
            <textarea name="comment" rows={3}
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              placeholder="Дополнительная информация о контакте..." />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit"
            className="px-6 py-2.5 rounded-[14px] text-white font-medium hover:-translate-y-0.5 transition text-sm" style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
            Добавить контакт
          </button>
          <Link href="/contacts"
            className="px-6 py-2.5 border border-border text-foreground rounded-[14px] text-sm font-medium hover:bg-accent transition">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
