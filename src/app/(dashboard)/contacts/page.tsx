import { createClient } from '@/lib/supabase/server'
import { Users, Plus, Phone, Mail, Badge } from 'lucide-react'
import Link from 'next/link'
import type { Contact } from '@/types/database'

const roleLabels = {
  client: { label: 'Клиент', color: 'bg-blue-100 text-blue-700' },
  owner: { label: 'Собственник', color: 'bg-green-100 text-green-700' },
  both: { label: 'Клиент + Собственник', color: 'bg-purple-100 text-purple-700' },
}

const statusLabels = {
  new: { label: 'Новый', color: 'bg-gray-100 text-gray-700' },
  active: { label: 'Активный', color: 'bg-blue-100 text-blue-700' },
  vip: { label: 'VIP', color: 'bg-yellow-100 text-yellow-700' },
  inactive: { label: 'Неактивный', color: 'bg-red-100 text-red-700' },
}

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Контакты</h1>
          <p className="text-muted-foreground mt-1">{contacts?.length ?? 0} контактов</p>
        </div>
        <Link
          href="/contacts/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </Link>
      </div>

      {/* Table */}
      {contacts && contacts.length > 0 ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                  Имя
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                  Роль
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                  Контакт
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                  Статус
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                  Источник
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(contacts as Contact[]).map(contact => {
                const roleInfo = roleLabels[contact.role]
                const statusInfo = statusLabels[contact.status]

                return (
                  <tr key={contact.id} className="hover:bg-muted/50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{contact.full_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {contact.phone && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {contact.phone}
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {contact.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-muted-foreground">
                        {contact.source ? `📍 ${contact.source}` : '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Открыть
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Контактов ещё нет</p>
          <Link href="/contacts/new" className="text-primary hover:underline mt-2 inline-block">
            Добавить первый контакт
          </Link>
        </div>
      )}
    </div>
  )
}
