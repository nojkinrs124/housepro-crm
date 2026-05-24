'use client'

import { Bell, Search, Plus } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@/types/database'

export function Header({ user }: { user: User | null }) {
  const [search, setSearch] = useState('')
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      router.push(`/clients?search=${encodeURIComponent(search.trim())}`)
    }
  }

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-6 gap-4 shrink-0">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск клиентов, объектов, договоров..."
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
      </form>

      <div className="flex items-center gap-2 ml-auto">
        {/* Quick create */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 h-9 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:block">Создать</span>
          </button>
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-lg p-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            {[
              { label: 'Клиент', href: '/clients?new=true' },
              { label: 'Объект', href: '/properties?new=true' },
              { label: 'Договор', href: '/contracts?new=true' },
              { label: 'Задача', href: '/tasks?new=true' },
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

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-all">
          <span className="text-primary text-sm font-semibold">
            {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
          </span>
        </div>
      </div>
    </header>
  )
}
