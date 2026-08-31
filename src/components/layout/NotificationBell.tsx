'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'

/**
 * «Уведомления · N» в шапке — как в макете «Кабинета»: подпись словом, а не
 * голый колокольчик с точкой. Счётчик непрочитанных — терракотовая метка,
 * единственное тревожное пятно в шапке.
 *
 * На узком экране подпись скрывается, остаётся иконка со счётчиком поверх.
 */
export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Link
      href="/settings/notifications"
      title="Уведомления"
      className="relative flex items-center gap-2 h-[40px] px-3 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-sub)] text-sm font-semibold transition-colors duration-150 hover:border-[var(--hp-sub)] hover:text-[var(--hp-ink)]"
    >
      <Bell style={{ width: 15, height: 15 }} className="shrink-0" />
      <span className="hidden md:block">Уведомления</span>

      {unreadCount > 0 && (
        <span
          className="flex items-center justify-center text-white text-[11px] font-bold leading-none rounded-full min-w-[18px] h-[18px] px-1.5 max-md:absolute max-md:-top-1.5 max-md:-right-1.5"
          style={{ background: 'var(--hp-danger)' }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
