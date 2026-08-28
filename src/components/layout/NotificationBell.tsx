'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Link href="/settings/notifications"
      className="relative w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all">
      <Bell className="w-4 h-4" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none"
          style={{ background: 'var(--hp-danger)' }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
