import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Phone, Mail, MapPin, Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Contact } from '@/types/database'

const roleLabels = {
  client: '👥 Клиент',
  owner: '🏠 Собственник',
  both: '🔄 Клиент + Собственник',
}

const statusLabels = {
  new: { label: 'Новый', color: 'bg-gray-100 text-gray-700' },
  active: { label: 'Активный', color: 'bg-blue-100 text-blue-700' },
  vip: { label: 'VIP', color: 'bg-yellow-100 text-yellow-700' },
  inactive: { label: 'Неактивный', color: 'bg-red-100 text-red-700' },
}

export default async function ContactPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!contact) notFound()

  const c = contact as Contact
  const statusInfo = statusLabels[c.status]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/contacts" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к контактам
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{c.full_name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-lg">{roleLabels[c.role]}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/contacts/${params.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-accent transition"
          >
            <Edit className="w-4 h-4" />
            Редактировать
          </Link>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Контактная информация</h2>
        
        {c.phone && (
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Телефон</p>
              <a href={`tel:${c.phone}`} className="text-foreground hover:text-primary transition">
                {c.phone}
              </a>
            </div>
          </div>
        )}

        {c.email && (
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <a href={`mailto:${c.email}`} className="text-foreground hover:text-primary transition">
                {c.email}
              </a>
            </div>
          </div>
        )}

        {c.telegram && (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5">✈️</div>
            <div>
              <p className="text-xs text-muted-foreground">Telegram</p>
              <p className="text-foreground">{c.telegram}</p>
            </div>
          </div>
        )}
      </div>

      {/* Address */}
      {(c.country || c.city || c.street) && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Адрес регистрации
          </h2>
          
          <div className="text-sm text-foreground space-y-1">
            {c.street && <p>{c.street}{c.house_number ? `, д. ${c.house_number}` : ''}</p>}
            {c.city && <p>{c.city}</p>}
            {c.region && <p>{c.region}</p>}
            {c.country && <p>{c.country}</p>}
          </div>
        </div>
      )}

      {/* Additional Info */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Дополнительно</h2>
        
        <div className="grid grid-cols-2 gap-4">
          {c.source && (
            <div>
              <p className="text-xs text-muted-foreground">Источник</p>
              <p className="text-foreground">📍 {c.source}</p>
            </div>
          )}
          
          {c.passport && (
            <div>
              <p className="text-xs text-muted-foreground">Паспорт</p>
              <p className="text-foreground font-mono">{c.passport}</p>
            </div>
          )}
          
          {c.birth_date && (
            <div>
              <p className="text-xs text-muted-foreground">Дата рождения</p>
              <p className="text-foreground">{new Date(c.birth_date).toLocaleDateString('ru-RU')}</p>
            </div>
          )}
        </div>

        {c.comment && (
          <div>
            <p className="text-xs text-muted-foreground">Комментарий</p>
            <p className="text-foreground mt-1">{c.comment}</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
          Добавлено: {new Date(c.created_at).toLocaleDateString('ru-RU')}
        </p>
      </div>
    </div>
  )
}
