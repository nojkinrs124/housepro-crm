'use client'

import { Phone, Mail, MessageCircle, TrendingUp, FileText } from 'lucide-react'
import Link from 'next/link'
import type { Contact } from '@/types/database'

const roleConfig: Record<string, { label: string; cls: string }> = {
  client: { label: 'Клиент',      cls: 'bg-blue-50 text-blue-700 border border-blue-100' },
  owner:  { label: 'Собственник', cls: 'bg-green-50 text-green-700 border border-green-100' },
  both:   { label: 'Кл.+Собств.', cls: 'bg-violet-50 text-violet-700 border border-violet-100' },
}
const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  new:      { label: 'Новый',      dot: 'bg-slate-400',  badge: 'bg-slate-50 text-slate-600 border border-slate-100' },
  active:   { label: 'Активный',   dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border border-blue-100' },
  vip:      { label: 'VIP',        dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 border border-amber-100' },
  inactive: { label: 'Неактивный', dot: 'bg-red-400',    badge: 'bg-red-50 text-red-600 border border-red-100' },
}

const avatarGradients = [
  ['#16A34A', '#22C55E'],
  ['#3B82F6', '#60A5FA'],
  ['#8B5CF6', '#A78BFA'],
  ['#F59E0B', '#FBBF24'],
  ['#06B6D4', '#22D3EE'],
  ['#EF4444', '#F87171'],
]

interface ContactCardProps {
  contact: Contact
  idx: number
}

export function ContactCard({ contact, idx }: ContactCardProps) {
  const role    = roleConfig[contact.role]    ?? roleConfig.client
  const status  = statusConfig[contact.status] ?? statusConfig.new
  const [c1, c2] = avatarGradients[idx % avatarGradients.length]
  const initials = contact.full_name
    ?.split(' ').slice(0, 2).map(n => n.charAt(0).toUpperCase()).join('') ?? 'U'

  return (
    <div
      className="group bg-white rounded-[20px] border border-slate-100 overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.1)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)'
      }}
    >
      {/* Top gradient banner */}
      <div className="h-[72px] relative"
        style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}>
        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
            {status.label}
          </span>
        </div>
        {/* Avatar — overlapping */}
        <div className="absolute -bottom-7 left-5">
          <div
            className="w-[58px] h-[58px] rounded-[18px] flex items-center justify-center text-white font-bold text-xl border-4 border-white"
            style={{
              background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            {initials}
          </div>
        </div>
      </div>

      <div className="px-5 pt-10 pb-5">
        {/* Role badge */}
        <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${role.cls}`}>
          {role.label}
        </span>

        {/* Name */}
        <Link href={`/contacts/${contact.id}`}>
          <h3 className="font-bold text-foreground text-[15px] leading-snug mt-2 group-hover:text-[#16A34A] transition-colors">
            {contact.full_name}
          </h3>
        </Link>

        {/* Contact info */}
        <div className="mt-3 space-y-1.5">
          {contact.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone style={{ width: 12, height: 12, flexShrink: 0, color: '#94A3B8' }} />
              <span className="truncate font-medium">{contact.phone}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail style={{ width: 12, height: 12, flexShrink: 0, color: '#94A3B8' }} />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.source && (
            <div className="text-xs text-slate-400 mt-0.5">📍 {contact.source}</div>
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-1.5">
          {contact.phone && (
            <a href={`tel:${contact.phone}`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-[11px] font-bold bg-green-50 text-green-700 hover:bg-green-100 transition-all hover:scale-105 border border-green-100"
              title="Позвонить">
              <Phone style={{ width: 11, height: 11 }} />
              Звонок
            </a>
          )}
          {contact.phone && (
            <>
              <a href={`https://t.me/${contact.phone.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all hover:scale-105 border border-blue-100">
                <MessageCircle style={{ width: 11, height: 11 }} />
                TG
              </a>
              <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-[11px] font-bold bg-green-50 text-green-700 hover:bg-green-100 transition-all hover:scale-105 border border-green-100">
                <MessageCircle style={{ width: 11, height: 11 }} />
                WA
              </a>
            </>
          )}
          <Link href={`/deals/new?contact_id=${contact.id}`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-[11px] font-bold bg-violet-50 text-violet-700 hover:bg-violet-100 transition-all hover:scale-105 border border-violet-100">
            <TrendingUp style={{ width: 11, height: 11 }} />
            Сделка
          </Link>
          <Link href={`/contracts/new?contact_id=${contact.id}`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-[11px] font-bold bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all hover:scale-105 border border-orange-100">
            <FileText style={{ width: 11, height: 11 }} />
            Договор
          </Link>
        </div>
      </div>
    </div>
  )
}
