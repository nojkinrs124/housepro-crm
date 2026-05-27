import { createClient } from '@/lib/supabase/server'
import { Plus, Phone, MessageCircle, UserCheck } from 'lucide-react'
import Link from 'next/link'
import { updateLeadStatusAction, convertLeadToClient } from '@/features/leads/actions/leads.actions'

const columns = [
  { status: 'new', label: 'Новые', color: 'border-t-blue-400', badge: 'bg-blue-100 text-blue-700' },
  { status: 'contacted', label: 'Связались', color: 'border-t-yellow-400', badge: 'bg-yellow-100 text-yellow-700' },
  { status: 'showing', label: 'Показ', color: 'border-t-orange-400', badge: 'bg-orange-100 text-orange-700' },
  { status: 'searching', label: 'Подбор', color: 'border-t-purple-400', badge: 'bg-purple-100 text-purple-700' },
  { status: 'converted', label: 'Клиенты', color: 'border-t-green-400', badge: 'bg-green-100 text-green-700' },
  { status: 'closed', label: 'Закрыты', color: 'border-t-gray-300', badge: 'bg-gray-100 text-gray-600' },
]

const sourceLabels: Record<string, string> = {
  avito: 'Авито', cian: 'ЦИАН', whatsapp: 'WhatsApp',
  telegram: 'Telegram', call: 'Звонок', website: 'Сайт',
  referral: 'Рекомендация', other: 'Другое',
}

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  const byStatus = (status: string) =>
    (leads ?? []).filter(l => l.status === status)

  const total = leads?.length ?? 0
  const newCount = byStatus('new').length

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Лиды</h1>
          <p className="text-muted-foreground mt-1">
            {total} лидов · {newCount} новых
          </p>
        </div>
        <Link href="/leads/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" />
          Новый лид
        </Link>
      </div>

      {/* Pipeline Kanban */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {columns.map(col => {
            const colLeads = byStatus(col.status)
            return (
              <div key={col.status}
                className={`w-64 bg-card border-t-2 ${col.color} border border-border rounded-2xl flex flex-col`}>
                {/* Column header */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <span className="font-semibold text-foreground text-sm">{col.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${col.badge}`}>
                    {colLeads.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="p-3 space-y-2 min-h-40 flex-1">
                  {colLeads.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">Нет лидов</div>
                  ) : (
                    colLeads.map(lead => (
                      <div key={lead.id}
                        className="bg-background border border-border rounded-xl p-3 space-y-2 hover:shadow-sm transition-all">
                        {/* Name */}
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {lead.full_name || 'Без имени'}
                          </p>
                          {lead.source && (
                            <span className="text-xs text-muted-foreground">
                              {sourceLabels[lead.source] ?? lead.source}
                            </span>
                          )}
                        </div>

                        {/* Contacts */}
                        <div className="space-y-1">
                          {lead.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />{lead.phone}
                            </div>
                          )}
                          {lead.telegram && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MessageCircle className="w-3 h-3" />{lead.telegram}
                            </div>
                          )}
                        </div>

                        {lead.comment && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{lead.comment}</p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-1.5 pt-1 flex-wrap">
                          {/* Move buttons */}
                          {col.status !== 'contacted' && col.status !== 'converted' && col.status !== 'closed' && (
                            <form action={async () => {
                              'use server'
                              const next: Record<string, string> = {
                                new: 'contacted', contacted: 'showing',
                                showing: 'searching', searching: 'converted',
                              }
                              await updateLeadStatusAction(lead.id, next[col.status] || 'contacted')
                            }}>
                              <button type="submit"
                                className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all">
                                →
                              </button>
                            </form>
                          )}

                          {/* Convert to client */}
                          {col.status !== 'converted' && col.status !== 'closed' && (
                            <form action={convertLeadToClient.bind(null, lead.id)}>
                              <button type="submit"
                                className="flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all">
                                <UserCheck className="w-3 h-3" />
                                Клиент
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
