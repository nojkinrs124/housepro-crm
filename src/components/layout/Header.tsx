'use client'

import { Bell, Search, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { User } from '@/types/database'

function isMac() {
  return typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
}

export function Header({ user }: { user: User | null }) {
  const [, setMac] = useState(false)

  useEffect(() => { setMac(isMac()) }, [])

  function openSearch() {
    // Dispatch synthetic Ctrl+K to trigger GlobalSearch
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true })
    )
  }

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-6 gap-4 shrink-0">
      {/* Search trigger */}
      <button
        onClick={openSearch}
        className="flex-1 max-w-md flex items-center gap-2 h-9 px-3 rounded-lg border border-input bg-background text-sm text-muted-foreground hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
      >
        <Search className="w-4 h-4 shrink-0" />
        <span className="flex-1">Поиск по CRM...</span>
        <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-xs border border-border rounded-md font-mono bg-muted/50">
          Ctrl K
        </kbd>
      </button>

      <div className="flex items-center gap-2 ml-auto">
        {/* Quick create */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 h-9 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:block">Создать</span>
          </button>
          <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-lg p-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            {[
              { label: 'Клиент',  href: '/clients/new' },
              { label: 'Объект',  href: '/properties/new' },
              { label: 'Договор', href: '/contracts/new' },
              { label: 'Задача',  href: '/tasks/new' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors"
              >
                + {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </button>

        {/* Avatar → Profile */}
        <a
          href="/settings/profile"
          className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-all overflow-hidden shrink-0"
          title={user?.full_name ?? 'Профиль'}
        >
          {user?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary text-sm font-semibold">
              {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
            </span>
          )}
        </a>
      </div>
    </header>
  )
}
