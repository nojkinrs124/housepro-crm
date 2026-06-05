'use client'

import { Search, Plus, Bell, ChevronDown } from 'lucide-react'
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

  return (
    <header
      className="h-[68px] flex items-center px-6 gap-4 shrink-0 sticky top-0 z-30"
      style={{
        background: 'rgba(248, 250, 252, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(214, 219, 235, 0.6)',
      }}
    >
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-[480px]">
        <div
          className="relative"
          style={{
            transition: 'all 0.2s ease',
          }}
        >
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
            style={{
              width: 15,
              height: 15,
              color: focused ? '#16A34A' : '#94A3B8',
            }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Поиск по CRM..."
            className="w-full h-10 pl-10 pr-14 text-sm text-[#111827] placeholder:text-[#94A3B8] outline-none transition-all duration-200"
            style={{
              background: focused ? '#ffffff' : 'rgba(255,255,255,0.7)',
              border: `1.5px solid ${focused ? '#22C55E' : 'rgba(214,219,235,0.8)'}`,
              borderRadius: '12px',
              boxShadow: focused ? '0 0 0 3px rgba(34,197,94,0.1)' : 'none',
            }}
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <kbd className="hidden sm:flex items-center px-1.5 py-0.5 text-[10px] font-mono text-[#94A3B8] rounded-md"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}>
              ⌘K
            </kbd>
          </div>
        </div>
      </form>

      <div className="flex items-center gap-2 ml-auto">
        {/* Quick create */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setCreateOpen(!createOpen) }}
            className="flex items-center gap-2 h-9 px-4 text-sm font-semibold text-white rounded-[10px] transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #16A34A, #22C55E)',
              boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,163,74,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(22,163,74,0.3)')}
          >
            <Plus style={{ width: 16, height: 16 }} />
            <span className="hidden sm:block">Создать</span>
            <ChevronDown
              style={{
                width: 14,
                height: 14,
                transition: 'transform 0.2s',
                transform: createOpen ? 'rotate(180deg)' : 'rotate(0)',
              }}
            />
          </button>

          {createOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-48 py-1.5 rounded-[14px] z-50"
              style={{
                background: '#ffffff',
                border: '1px solid rgba(214,219,235,0.8)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {[
                { label: 'Контакт',  href: '/contacts/new',   emoji: '👤' },
                { label: 'Объект',   href: '/properties/new', emoji: '🏠' },
                { label: 'Сделку',   href: '/deals/new',      emoji: '📈' },
                { label: 'Договор',  href: '/contracts/new',  emoji: '📄' },
                { label: 'Задачу',   href: '/tasks/new',      emoji: '✅' },
              ].map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-[#374151] font-medium transition-colors"
                  style={{ borderRadius: '10px' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <span className="text-base">{item.emoji}</span>
                  {item.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <NotificationBell unreadCount={unreadCount} />

        {/* Avatar */}
        <a
          href="/settings/profile"
          className="flex items-center gap-2.5 transition-all duration-200"
          title={user?.full_name ?? 'Профиль'}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden text-white text-sm font-semibold"
            style={{
              background: user?.avatar_url ? undefined : 'linear-gradient(135deg, #16A34A, #22C55E)',
              ring: '2px solid rgba(34,197,94,0.25)',
              boxShadow: '0 0 0 2.5px rgba(34,197,94,0.2)',
            }}
          >
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span>{user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}</span>
            )}
          </div>
        </a>
      </div>
    </header>
  )
}
