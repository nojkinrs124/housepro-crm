import { createClient } from '@/lib/supabase/server'
import { Users, Plus, Phone, Mail, MessageCircle, TrendingUp, FileText } from 'lucide-react'
import Link from 'next/link'
import type { Contact } from '@/types/database'

const roleConfig: Record<string, { label: string; cls: string }> = {
  client: { label: 'Клиент',           cls: 'bg-blue-50 text-blue-700' },
  owner:  { label: 'Собственник',      cls: 'bg-green-50 text-green-700' },
  both:   { label: 'Кл.+Собств.',      cls: 'bg-violet-50 text-violet-700' },
}
const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
  new:      { label: 'Новый',      cls: 'bg-slate-50 text-slate-600',   dot: 'bg-slate-400' },
  active:   { label: 'Активный',   cls: 'bg-blue-50 text-blue-700',     dot: 'bg-blue-400' },
  vip:      { label: 'VIP',        cls: 'bg-amber-50 text-amber-700',   dot: 'bg-amber-400' },
  inactive: { label: 'Неактивный', cls: 'bg-red-50 text-red-600',       dot: 'bg-red-400' },
}

const avatarGradients = [
  'from-green-500 to-emerald-400',
  'from-blue-500 to-blue-400',
  'from-violet-500 to-purple-400',
  'from-orange-500 to-amber-400',
  'from-cyan-500 to-sky-400',
  'from-rose-500 to-pink-400',
]

export default async function ContactsPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Контакты</h1>
          <p className="text-[#64748B] mt-1 text-sm">{contacts?.length ?? 0} контактов в базе</p>
        </div>
        <Link href="/contacts/new"
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-colors"
          style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
          <Plus style={{ width: 16, height: 16 }} />
          Добавить контакт
        </Link>
      </div>

      {contacts && contacts.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {(contacts as Contact[]).map((contact, idx) => {
            const role   = roleConfig[contact.role]   ?? roleConfig.client
            const status = statusConfig[contact.status] ?? statusConfig.new
            const gradient = avatarGradients[idx % avatarGradients.length]
            const initials = contact.full_name
              ?.split(' ').slice(0, 2).map(n => n.charAt(0).toUpperCase()).join('') ?? 'U'

            return (
              <div key={contact.id}
                className="group bg-white rounded-[20px] border border-slate-200/60 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden">

                {/* Top accent bar */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

                <div className="p-5">
                  {/* Avatar + status */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl bg-gradient-to-br ${gradient} shadow-md`}>
                      {initials}
                    </div>
                    <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${status.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </div>

                  {/* Name & role */}
                  <Link href={`/contacts/${contact.id}`}>
                    <h3 className="font-bold text-[#111827] text-[15px] leading-snug group-hover:text-green-600 transition-colors">
                      {contact.full_name}
                    </h3>
                  </Link>
                  <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1.5 ${role.cls}`}>
                    {role.label}
                  </span>

                  {/* Contact info */}
                  <div className="mt-3 space-y-1.5">
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-xs text-[#64748B]">
                        <Phone style={{ width: 12, height: 12, flexShrink: 0 }} />
                        <span className="truncate font-medium">{contact.phone}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2 text-xs text-[#64748B]">
                        <Mail style={{ width: 12, height: 12, flexShrink: 0 }} />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.source && (
                      <div className="text-xs text-slate-400 mt-0.5">📍 {contact.source}</div>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="mt-4 pt-3 flex flex-wrap gap-1.5 border-t border-slate-100">
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                        title="Позвонить">
                        <Phone style={{ width: 11, height: 11 }} />
                        Звонок
                      </a>
                    )}
                    {contact.phone && (
                      <>
                        <a href={`https://t.me/${contact.phone.replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                          <MessageCircle style={{ width: 11, height: 11 }} />
                          TG
                        </a>
                        <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                          <MessageCircle style={{ width: 11, height: 11 }} />
                          WA
                        </a>
                      </>
                    )}
                    <Link href={`/deals/new?contact=${contact.id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors">
                      <TrendingUp style={{ width: 11, height: 11 }} />
                      Сделка
                    </Link>
                    <Link href={`/contracts/new?contact=${contact.id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors">
                      <FileText style={{ width: 11, height: 11 }} />
                      Договор
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Users style={{ width: 24, height: 24 }} className="text-slate-400" />
          </div>
          <p className="text-[#374151] font-semibold text-lg">Контактов ещё нет</p>
          <p className="text-[#64748B] text-sm mt-1">Добавьте первый контакт в базу</p>
          <Link href="/contacts/new"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
            <Plus style={{ width: 16, height: 16 }} />
            Добавить контакт
          </Link>
        </div>
      )}
    </div>
  )
}
