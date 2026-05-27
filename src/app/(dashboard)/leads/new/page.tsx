import { createLeadAction } from '@/features/leads/actions/leads.actions'
import { ArrowLeft, Zap } from 'lucide-react'
import Link from 'next/link'

const sourceOptions = [
  { value: 'avito', label: 'Авито' },
  { value: 'cian', label: 'ЦИАН' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'call', label: 'Входящий звонок' },
  { value: 'website', label: 'Сайт' },
  { value: 'referral', label: 'Рекомендация' },
  { value: 'other', label: 'Другое' },
]

export default function NewLeadPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/leads" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к лидам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <Zap className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Новый лид</h1>
          <p className="text-muted-foreground text-sm">Добавьте потенциального клиента</p>
        </div>
      </div>

      <form action={createLeadAction} className="space-y-4">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Контакт</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Имя</label>
            <input name="full_name" placeholder="Иван Иванов"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Телефон</label>
              <input name="phone" type="tel" placeholder="+7 (999) 999-99-99"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Telegram</label>
              <input name="telegram" placeholder="@username"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Источник <span className="text-destructive">*</span></label>
            <select name="source" defaultValue=""
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
              <option value="" disabled>Откуда пришёл лид?</option>
              {sourceOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Комментарий</h2>
          <textarea name="comment" rows={3} placeholder="Что ищет клиент, бюджет, пожелания..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
            <Zap className="w-4 h-4" />
            Добавить лид
          </button>
          <Link href="/leads"
            className="px-6 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-all">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
