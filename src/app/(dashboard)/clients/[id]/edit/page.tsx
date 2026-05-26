import { createClient } from '@/lib/supabase/server'
import { updateClientAction } from '@/features/clients/actions/clients.actions'
import { ArrowLeft, Edit } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const statusOptions = [
  { value: 'new', label: 'Новый' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'active', label: 'Активный' },
  { value: 'closed', label: 'Закрыт' },
  { value: 'vip', label: 'VIP' },
  { value: 'blacklist', label: 'Чёрный список' },
]

const sourceOptions = [
  { value: 'avito', label: 'Авито' },
  { value: 'referral', label: 'Рекомендация' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'website', label: 'Сайт' },
  { value: 'other', label: 'Другое' },
]

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients').select('*').eq('id', id).single()

  if (!client) notFound()

  const updateAction = updateClientAction.bind(null, id)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/clients/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к клиенту
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <Edit className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Редактировать клиента</h1>
          <p className="text-muted-foreground text-sm">{client.full_name}</p>
        </div>
      </div>

      <form action={updateAction} className="space-y-4">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Основные данные</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">ФИО <span className="text-destructive">*</span></label>
            <input name="full_name" defaultValue={client.full_name} required
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Телефон</label>
              <input name="phone" defaultValue={client.phone ?? ''} type="tel"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Telegram</label>
              <input name="telegram" defaultValue={client.telegram ?? ''}
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">WhatsApp</label>
              <input name="whatsapp" defaultValue={client.whatsapp ?? ''} type="tel"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Паспорт</label>
              <input name="passport" defaultValue={client.passport ?? ''}
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Статус и источник</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Статус</label>
              <select name="status" defaultValue={client.status}
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Источник</label>
              <select name="source" defaultValue={client.source ?? ''}
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="">Не указан</option>
                {sourceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Комментарий</h2>
          <textarea name="comment" defaultValue={client.comment ?? ''} rows={4}
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit"
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
            Сохранить изменения
          </button>
          <Link href={`/clients/${id}`}
            className="px-6 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-all">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
