'use client'

import { Phone, Mail, MessageCircle, TrendingUp, FileText, Tag } from 'lucide-react'
import Link from 'next/link'
import type { Contact } from '@/types/database'

const roleConfig: Record<string, { label: string }> = {
  client: { label: 'Клиент' },
  owner:  { label: 'Собственник' },
  both:   { label: 'Кл.+Собств.' },
}
const statusConfig: Record<string, { label: string; badgeCls: string }> = {
  new:      { label: 'Новый',      badgeCls: 'hp-badge-info' },
  active:   { label: 'Активный',   badgeCls: 'hp-badge-good' },
  vip:      { label: 'VIP',        badgeCls: 'hp-badge-warn' },
  inactive: { label: 'Неактивный', badgeCls: 'hp-badge-neutral' },
}

interface ContactCardProps {
  contact: Contact
  idx: number
}

export function ContactCard({ contact }: ContactCardProps) {
  const role    = roleConfig[contact.role]    ?? roleConfig.client
  const status  = statusConfig[contact.status] ?? statusConfig.new
  const initials = contact.full_name
    ?.split(' ').slice(0, 2).map(n => n.charAt(0).toUpperCase()).join('') ?? 'U'

  return (
    <div className="group bg-[var(--hp-surface)] rounded-[var(--hp-radius)] border border-[var(--hp-border)] overflow-hidden transition-colors duration-150 hover:border-[var(--hp-sub)]">
      <div className="px-5 pt-5 pb-5">
        {/* Avatar + name + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-[var(--hp-radius)] flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: 'var(--hp-accent)' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <Link href={`/contacts/${contact.id}`}>
                <h3 className="font-bold text-[var(--hp-ink)] text-[15px] leading-snug truncate group-hover:underline">
                  {contact.full_name}
                </h3>
              </Link>
              <span className="hp-badge hp-badge-neutral mt-1">{role.label}</span>
            </div>
          </div>
          <span className={`hp-badge ${status.badgeCls} shrink-0`}>{status.label}</span>
        </div>

        {/* Contact info */}
        <div className="mt-3.5 space-y-1.5">
          {contact.phone && (
            <div className="flex items-center gap-2 text-xs text-[var(--hp-sub)]">
              <Phone style={{ width: 12, height: 12, flexShrink: 0 }} />
              <span className="truncate font-medium">{contact.phone}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-xs text-[var(--hp-sub)]">
              <Mail style={{ width: 12, height: 12, flexShrink: 0 }} />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.source && (
            <div className="flex items-center gap-2 text-xs text-[var(--hp-tertiary)] mt-0.5">
              <Tag style={{ width: 12, height: 12, flexShrink: 0 }} />
              <span className="truncate">{contact.source}</span>
            </div>
          )}
        </div>

        {/* Quick actions — все одного нейтрального стиля, различаются только иконкой/подписью */}
        <div className="mt-4 pt-4 border-t border-[var(--hp-border-soft)] flex flex-wrap gap-1.5">
          {contact.phone && (
            <a href={`tel:${contact.phone}`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--hp-radius)] text-[11px] font-semibold text-[var(--hp-ink)] border border-[var(--hp-border)] hover:border-[var(--hp-sub)] transition-colors"
              title="Позвонить">
              <Phone style={{ width: 11, height: 11 }} />
              Звонок
            </a>
          )}
          {contact.phone && (
            <>
              <a href={`https://t.me/${contact.phone.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--hp-radius)] text-[11px] font-semibold text-[var(--hp-ink)] border border-[var(--hp-border)] hover:border-[var(--hp-sub)] transition-colors">
                <MessageCircle style={{ width: 11, height: 11 }} />
                TG
              </a>
              <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--hp-radius)] text-[11px] font-semibold text-[var(--hp-ink)] border border-[var(--hp-border)] hover:border-[var(--hp-sub)] transition-colors">
                <MessageCircle style={{ width: 11, height: 11 }} />
                WA
              </a>
            </>
          )}
          <Link href={`/deals/new?contact_id=${contact.id}`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--hp-radius)] text-[11px] font-semibold text-[var(--hp-ink)] border border-[var(--hp-border)] hover:border-[var(--hp-sub)] transition-colors">
            <TrendingUp style={{ width: 11, height: 11 }} />
            Сделка
          </Link>
          <Link href={`/contracts/new?contact_id=${contact.id}`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--hp-radius)] text-[11px] font-semibold text-[var(--hp-ink)] border border-[var(--hp-border)] hover:border-[var(--hp-sub)] transition-colors">
            <FileText style={{ width: 11, height: 11 }} />
            Договор
          </Link>
        </div>
      </div>
    </div>
  )
}
