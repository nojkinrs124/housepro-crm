import { createClient } from '@/lib/supabase/server'
import { Users, Plus, Phone, Mail, MessageCircle, TrendingUp, FileText } from 'lucide-react'
import Link from 'next/link'
import type { Contact } from '@/types/database'

const roleConfig: Record<string, { label: string; bg: string; color: string }> = {
  client: { label: 'Клиент',             bg: '#EFF6FF', color: '#2563EB' },
  owner:  { label: 'Собственник',        bg: '#F0FDF4', color: '#16A34A' },
  both:   { label: 'Клиент + Собств.',   bg: '#F5F3FF', color: '#7C3AED' },
}
const statusConfig: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  new:      { label: 'Новый',      bg: '#F8FAFC', color: '#64748B', dot: '#94A3B8' },
  active:   { label: 'Активный',   bg: '#EFF6FF', color: '#2563EB', dot: '#60A5FA' },
  vip:      { label: 'VIP',        bg: '#FFFBEB', color: '#D97706', dot: '#F59E0B' },
  inactive: { label: 'Неактивный', bg: '#FEF2F2', color: '#DC2626', dot: '#F87171' },
}

const avatarGradients = [
  'linear-gradient(135deg, #16A34A, #22C55E)',
  'linear-gradient(135deg, #2563EB, #60A5FA)',
  'linear-gradient(135deg, #7C3AED, #A78BFA)',
  'linear-gradient(135deg, #EA580C, #FB923C)',
  'linear-gradient(135deg, #0891B2, #22D3EE)',
  'linear-gradient(135deg, #D97706, #FCD34D)',
]

const cardStyle = {
  background: '#ffffff',
  borderRadius: '20px',
  border: '1px solid rgba(214,219,235,0.6)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)',
}

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
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-[12px] text-sm font-semibold transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #22C55E)',
            boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
          }}>
          <Plus style={{ width: 16, height: 16 }} />
          Добавить контакт
        </Link>
      </div>

      {/* Grid */}
      {contacts && contacts.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {(contacts as Contact[]).map((contact, idx) => {
            const role = roleConfig[contact.role] ?? roleConfig.client
            const status = statusConfig[contact.status] ?? statusConfig.new
            const gradient = avatarGradients[idx % avatarGradients.length]
            const initials = contact.full_name
              ?.split(' ')
              .slice(0, 2)
              .map(n => n.charAt(0).toUpperCase())
              .join('') ?? 'U'

            return (
              <div
                key={contact.id}
                style={{ ...cardStyle, transition: 'all 0.25s ease' }}
                className="group overflow-hidden"
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(-3px)'
                  el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08), 0 20px 40px rgba(0,0,0,0.1)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(0)'
                  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)'
                }}
              >
                {/* Card top accent */}
                <div className="h-1.5 w-full" style={{ background: gradient }} />

                <div className="p-5">
                  {/* Avatar + status */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl"
                        style={{ background: gradient, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                      >
                        {initials}
                      </div>
                    </div>
                    <span
                      className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: status.bg, color: status.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />
                      {status.label}
                    </span>
                  </div>

                  {/* Name & role */}
                  <Link href={`/contacts/${contact.id}`}>
                    <h3 className="font-bold text-[#111827] text-[15px] leading-snug hover:text-[#16A34A] transition-colors">
                      {contact.full_name}
                    </h3>
                  </Link>
                  <span
                    className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1.5"
                    style={{ background: role.bg, color: role.color }}
                  >
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
                      <div className="text-xs text-[#94A3B8] mt-0.5">📍 {contact.source}</div>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="mt-4 pt-3 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid rgba(214,219,235,0.6)' }}>
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-all"
                        style={{ background: '#F0FDF4', color: '#16A34A' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#DCFCE7'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F0FDF4'}
                        title="Позвонить"
                      >
                        <Phone style={{ width: 11, height: 11 }} />
                        Звонок
                      </a>
                    )}
                    {contact.phone && (
                      <>
                        <a
                          href={`https://t.me/${contact.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-all"
                          style={{ background: '#EFF6FF', color: '#2563EB' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#DBEAFE'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#EFF6FF'}
                          title="Telegram"
                        >
                          <MessageCircle style={{ width: 11, height: 11 }} />
                          TG
                        </a>
                        <a
                          href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-all"
                          style={{ background: '#F0FDF4', color: '#16A34A' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#DCFCE7'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F0FDF4'}
                          title="WhatsApp"
                        >
                          <MessageCircle style={{ width: 11, height: 11 }} />
                          WA
                        </a>
                      </>
                    )}
                    <Link
                      href={`/deals/new?contact=${contact.id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-all"
                      style={{ background: '#F5F3FF', color: '#7C3AED' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EDE9FE'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F5F3FF'}
                    >
                      <TrendingUp style={{ width: 11, height: 11 }} />
                      Сделка
                    </Link>
                    <Link
                      href={`/contracts/new?contact=${contact.id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-all"
                      style={{ background: '#FFF7ED', color: '#EA580C' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FFEDD5'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#FFF7ED'}
                    >
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
        <div style={cardStyle} className="p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-4">
            <Users style={{ width: 24, height: 24, color: '#94A3B8' }} />
          </div>
          <p className="text-[#374151] font-semibold text-lg">Контактов ещё нет</p>
          <p className="text-[#64748B] text-sm mt-1">Добавьте первый контакт в базу</p>
          <Link href="/contacts/new"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-[12px] text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
            <Plus style={{ width: 16, height: 16 }} />
            Добавить контакт
          </Link>
        </div>
      )}
    </div>
  )
}
