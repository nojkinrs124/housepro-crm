import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Phone, MessageCircle, FileText, Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteClientAction } from '@/features/clients/actions/clients.actions'

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  vip: 'bg-purple-100 text-purple-700',
  blacklist: 'bg-red-100 text-red-700',
}

const statusLabels: Record<string, string> = {
  new: 'Новый', in_progress: 'В работе', active: 'Активный',
  closed: 'Закрыт', vip: 'VIP', blacklist: 'Чёрный список',
}

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client) notFound()

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, contract_number, contract_type, status, created_at')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  const contractTypeLabels: Record<string, string> = {
    rent_apartment: 'Аренда квартиры',
    rent_commercial: 'Коммерческая аренда',
    sale_apartment: 'Продажа квартиры',
    sale_house: 'Продажа дома',
    property_management: 'Управление',
    sublease: 'Субаренда',
    agency_contract: 'Агентский',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/clients" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Все клиенты
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="text-primary text-xl font-bold">
              {client.full_name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{client.full_name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[client.status] ?? 'bg-gray-100'}`}>
              {statusLabels[client.status] ?? client.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-accent transition-all"
          >
            <Edit className="w-4 h-4" />
            Редактировать
          </Link>
          <form action={deleteClientAction.bind(null, id)}>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 border border-destructive/30 text-destructive rounded-xl text-sm font-medium hover:bg-destructive/10 transition-all"
              onClick={(e) => {
                if (!confirm('Удалить клиента?')) e.preventDefault()
              }}
            >
              <Trash2 className="w-4 h-4" />
              Удалить
            </button>
          </form>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — client info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Контакты</h2>
            <div className="space-y-3">
              {client.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">{client.phone}</span>
                </div>
              )}
              {client.telegram && (
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">{client.telegram}</span>
                  <span className="text-xs text-muted-foreground">Telegram</span>
                </div>
              )}
              {client.whatsapp && (
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">{client.whatsapp}</span>
                  <span className="text-xs text-muted-foreground">WhatsApp</span>
                </div>
              )}
              {!client.phone && !client.telegram && !client.whatsapp && (
                <p className="text-sm text-muted-foreground">Контакты не указаны</p>
              )}
            </div>
          </div>

          {client.passport && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-semibold text-foreground mb-3">Паспорт</h2>
              <p className="text-sm text-foreground">{client.passport}</p>
            </div>
          )}

          {client.comment && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-semibold text-foreground mb-3">Комментарий</h2>
              <p className="text-sm text-foreground leading-relaxed">{client.comment}</p>
            </div>
          )}

          {/* Contracts */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Договоры</h2>
              <Link
                href={`/contracts/new?client_id=${id}`}
                className="text-sm text-primary hover:underline"
              >
                + Создать договор
              </Link>
            </div>
            {!contracts || contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Договоров нет</p>
            ) : (
              <div className="space-y-2">
                {contracts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contracts/${c.id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{c.contract_number ?? `#${c.id.slice(0,8)}`}</p>
                        <p className="text-xs text-muted-foreground">{contractTypeLabels[c.contract_type] ?? c.contract_type}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — meta */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Информация</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Статус</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[client.status] ?? 'bg-gray-100'}`}>
                  {statusLabels[client.status]}
                </span>
              </div>
              {client.source && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Источник</span>
                  <span className="text-foreground">{client.source}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Создан</span>
                <span className="text-foreground">
                  {new Date(client.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
