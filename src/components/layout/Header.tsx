'use client'

import { Search, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { User } from '@/types/database'

import { NotificationBell } from '@/components/layout/NotificationBell'

export function Header({ user, unreadCount = 0 }: { user: User | null; unreadCount?: number }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')

  // Ctrl+K / Cmd+K фокус на поиск
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-6 gap-4 shrink-0">
      {/* Search form */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск по CRM..."
            className="w-full h-9 pl-9 pr-16 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-xs border border-border rounded-md font-mono bg-muted/50 text-muted-foreground pointer-events-none">
            Ctrl K
          </kbd>
        </div>
      </form>

      <div className="flex items-center gap-2 ml-auto">
        {/* Quick create */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 h-9 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:block">Создать</span>
          </button>
          <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-lg p-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            {[
              { label: 'Контакт',  href: '/contacts/new'   },
              { label: 'Объект',   href: '/properties/new' },
              { label: 'Сделку',   href: '/deals/new'      },
              { label: 'Договор',  href: '/contracts/new'  },
              { label: 'Задачу',   href: '/tasks/new'      },
            ].map(item => (
              <a key={item.href} href={item.href}
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg transition-colors">
                + {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <NotificationBell unreadCount={unreadCount} />

        {/* Avatar → Profile */}
        <a href="/settings/profile"
          className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-all overflow-hidden shrink-0"
          title={user?.full_name ?? 'Профиль'}>
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
