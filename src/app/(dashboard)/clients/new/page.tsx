import { createClientAction } from '@/features/clients/actions/clients.actions'
import { ArrowLeft, UserPlus } from 'lucide-react'
import Link from 'next/link'

const statusOptions = [
  { value: 'new', label: 'Новый' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'active', label: 'Активный' },
  { value: 'closed', label: 'Закрыт' },
  { value: 'vip', label: 'VIP' },
]

const sourceOptions = [
  { value: 'avito', label: 'Авито' },
  { value: 'referral', label: 'Рекомендация' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'website', label: 'Сайт' },
  { value: 'other', label: 'Другое' },
]

export default function NewClientPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/clients"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к клиентам
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Новый клиент</h1>
          <p className="text-muted-foreground text-sm">Заполните данные клиента</p>
        </div>
      </div>

      {/* Form */}
      <form action={createClientAction} className="space-y-4">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Основные данные</h2>

          {/* ФИО */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="full_name">
              ФИО <span className="text-destructive">*</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              placeholder="Иванов Иван Иванович"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
            />
          </div>

          {/* Телефон + Telegram */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="phone">Телефон</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+7 (999) 999-99-99"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="telegram">Telegram</label>
              <input
                id="telegram"
                name="telegram"
                type="text"
                placeholder="@username"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="whatsapp">WhatsApp</label>
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              placeholder="+7 (999) 999-99-99"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
            />
          </div>

          {/* Паспорт */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="passport">Паспорт</label>
            <input
              id="passport"
              name="passport"
              type="text"
              placeholder="Серия и номер"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
            />
          </div>
        </div>

        {/* Статус и источник */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Статус и источник</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="status">Статус</label>
              <select
                id="status"
                name="status"
                defaultValue="new"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer text-sm"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="source">Источник</label>
              <select
                id="source"
                name="source"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer text-sm"
              >
                <option value="">Не указан</option>
                {sourceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Комментарий */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Комментарий</h2>
          <textarea
            id="comment"
            name="comment"
            rows={4}
            placeholder="Заметки о клиенте..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Создать клиента
          </button>
          <Link
            href="/clients"
            className="px-6 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-all"
          >
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
