'use client'

import { Search, Plus, ChevronDown, Sparkles, User as UserIcon, Home, TrendingUp, FileText, CheckSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { User } from '@/types/database'
import { NotificationBell } from '@/components/layout/NotificationBell'

export function Header({ user, unreadCount = 0 }: { user: User | null; unreadCount?: number }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

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

  useEffect(() => {
    const handleClick = () => setCreateOpen(false)
    if (createOpen) document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [createOpen])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  const initials = user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'
  const firstName = user?.full_name?.split(' ')[0] ?? ''

  return (
    <header
      className="h-[68px] flex items-center px-5 gap-4 shrink-0 sticky top-0 z-30 overflow-x-hidden w-full"
      style={{
        background: 'rgba(248, 250, 252, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(214, 219, 235, 0.5)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.9), 0 4px 16px rgba(0,0,0,0.03)',
      }}
    >
      {/* Search bar */}
      <form onSubmit={handleSearch} className="hidden sm:block flex-1 max-w-[440px]">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200"
            style={{ width: 15, height: 15, color: focused ? '#16A34A' : '#94A3B8' }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Поиск по CRM..."
            className="w-full h-[42px] pl-11 pr-16 text-sm text-foreground placeholder:text-slate-400 outline-none transition-all duration-200"
            style={{
              background: focused ? '#ffffff' : 'rgba(255,255,255,0.85)',
              border: `1.5px solid ${focused ? '#22C55E' : 'rgba(214,219,235,0.8)'}`,
              borderRadius: '14px',
              boxShadow: focused
                ? '0 0 0 4px rgba(34,197,94,0.08), 0 2px 8px rgba(0,0,0,0.04)'
                : '0 1px 4px rgba(0,0,0,0.04)',
            }}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd
              className="hidden sm:flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 rounded-md"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}
            >
              ⌘K
            </kbd>
          </div>
        </div>
      </form>

      {/* Mobile search */}
      <button
        className="sm:hidden w-10 h-10 flex items-center justify-center rounded-[12px] text-muted-foreground hover:bg-white hover:shadow-sm transition-all duration-200"
        onClick={() => router.push('/search')}
      >
        <Search style={{ width: 18, height: 18 }} />
      </button>

      <div className="flex-1 sm:hidden" />

      <div className="flex items-center gap-2">
        {/* Quick create */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setCreateOpen(!createOpen) }}
            className="flex items-center gap-2 h-[42px] px-4 text-sm font-semibold text-white rounded-[14px] transition-all duration-200"
            style={{
              background: 'var(--hp-gradient-primary)',
              boxShadow: createOpen
                ? '0 4px 20px rgba(22,163,74,0.5), 0 0 0 3px rgba(34,197,94,0.15)'
                : '0 2px 12px rgba(22,163,74,0.35)',
            }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            <span className="hidden sm:block">Создать</span>
            <ChevronDown
              style={{
                width: 14, height: 14,
                transition: 'transform 0.2s',
                transform: createOpen ? 'rotate(180deg)' : 'rotate(0)',
              }}
              className="hidden sm:block opacity-80"
            />
          </button>

          {createOpen && (
            <div
              className="absolute right-0 top-full mt-2.5 w-52 py-2 rounded-[18px] z-50"
              style={{
                background: '#ffffff',
                border: '1px solid rgba(214,219,235,0.7)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 12px rgba(0,0,0,0.06)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-3 pb-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles style={{ width: 10, height: 10 }} />
                  Быстрое создание
                </span>
              </div>
              {[
                { label: 'Контакт',  href: '/contacts/new',   Icon: UserIcon,   color: 'hover:bg-violet-50 hover:text-violet-700', iconColor: 'text-violet-500' },
                { label: 'Объект',   href: '/properties/new', Icon: Home,       color: 'hover:bg-emerald-50 hover:text-emerald-700', iconColor: 'text-emerald-500' },
                { label: 'Сделку',   href: '/deals/new',      Icon: TrendingUp, color: 'hover:bg-green-50 hover:text-green-700', iconColor: 'text-green-500' },
                { label: 'Договор',  href: '/contracts/new',  Icon: FileText,   color: 'hover:bg-orange-50 hover:text-orange-700', iconColor: 'text-orange-500' },
                { label: 'Задачу',   href: '/tasks/new',      Icon: CheckSquare, color: 'hover:bg-blue-50 hover:text-blue-700', iconColor: 'text-blue-500' },
              ].map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 mx-1.5 px-3 py-2.5 text-sm text-[#374151] font-medium transition-all duration-150 rounded-[12px] ${item.color}`}
                >
                  <item.Icon className={`w-4 h-4 ${item.iconColor}`} />
                  {item.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div
          className="relative w-10 h-10 flex items-center justify-center rounded-[12px] transition-all duration-200 hover:bg-white hover:shadow-sm"
        >
          <NotificationBell unreadCount={unreadCount} />
        </div>

        {/* User avatar */}
        <a
          href="/settings/profile"
          className="flex items-center gap-2.5 pl-1 transition-all duration-200 group"
          title={user?.full_name ?? 'Профиль'}
        >
          {user?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar_url}
              alt="avatar"
              className="w-[38px] h-[38px] rounded-full object-cover"
              style={{ boxShadow: '0 0 0 2.5px rgba(34,197,94,0.25)' }}
            />
          ) : (
            <div
              className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-white text-sm font-bold group-hover:shadow-md transition-shadow"
              style={{
                background: 'var(--hp-gradient-primary)',
                boxShadow: '0 0 0 2.5px rgba(34,197,94,0.2)',
              }}
            >
              {initials}
            </div>
          )}
          {firstName && (
            <span className="hidden lg:block text-sm font-semibold text-[#374151] group-hover:text-foreground transition-colors">
              {firstName}
            </span>
          )}
        </a>
      </div>
    </header>
  )
}
