import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createContactAction } from '@/features/contacts/actions/contacts.actions'

export default function NewContactPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/contacts" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к контактам
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Добавить контакт</h1>
        <p className="text-muted-foreground mt-1">Клиент, собственник или оба</p>
      </div>

      <form action={createContactAction} className="bg-card border border-border rounded-2xl p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Полное имя *
          </label>
          <input
            type="text"
            name="full_name"
            required
            className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            placeholder="Иван Иванов"
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Роль *
          </label>
          <select
            name="role"
            required
            defaultValue="client"
            className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
          >
            <option value="client">👥 Клиент</option>
            <option value="owner">🏠 Собственник</option>
            <option value="both">🔄 Клиент + Собственник</option>
          </select>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Телефон
            </label>
            <input
              type="tel"
              name="phone"
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              placeholder="user@example.com"
            />
          </div>
        </div>

        {/* Source */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Источник
          </label>
          <select
            name="source"
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

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Комментарий
          </label>
          <textarea
            name="comment"
            rows={4}
            className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            placeholder="Дополнительная информация о контакте..."
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
        >
          Добавить контакт
        </button>
      </form>
    </div>
  )
}
