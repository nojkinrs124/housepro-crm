'use client'

import { Search, Plus, ChevronDown, Sparkles, User as UserIcon, Home, TrendingUp, FileText, CheckSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { User } from '@/types/database'
import { NotificationBell } from '@/components/layout/NotificationBell'

// Профиль и выход живут внизу сайдбара — в шапке «Кабинета» только поиск,
// уведомления и «Создать», как в макете. Проп user оставлен в сигнатуре:
// layout передаёт его, и шапке он ещё понадобится для персональных подсказок.
export function Header({ unreadCount = 0 }: { user?: User | null; unreadCount?: number }) {
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
      className="h-[68px] flex items-center px-5 gap-4 shrink-0 sticky top-0 z-30 w-full bg-[var(--hp-surface)]"
      style={{ borderBottom: '1px solid var(--hp-border)' }}
    >
      {/* Search bar */}
      <form onSubmit={handleSearch} className="hidden sm:block flex-1 max-w-[440px]">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-150"
            style={{ width: 15, height: 15, color: focused ? 'var(--hp-ink)' : 'var(--hp-tertiary)' }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Поиск: контакт, объект, № сделки"
            className="w-full h-[40px] pl-11 pr-16 text-sm text-foreground placeholder:text-[var(--hp-tertiary)] outline-none transition-colors duration-150"
            style={{
              background: 'var(--hp-surface)',
              border: `1px solid ${focused ? 'var(--hp-ink)' : 'var(--hp-border)'}`,
              borderRadius: 'var(--hp-radius)',
            }}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd
              className="hidden sm:flex items-center px-1.5 py-0.5 text-[10px] font-mono text-[var(--hp-tertiary)] rounded-[var(--hp-radius)]"
              style={{ background: 'var(--hp-neutral-tint)', border: '1px solid var(--hp-border)' }}
            >
              ⌘K
            </kbd>
          </div>
        </div>
      </form>

      {/* Mobile search */}
      <button
        className="sm:hidden w-10 h-10 flex items-center justify-center rounded-[var(--hp-radius)] text-muted-foreground hover:bg-[var(--hp-neutral-tint)] transition-colors duration-150"
        onClick={() => router.push('/search')}
      >
        <Search style={{ width: 18, height: 18 }} />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <NotificationBell unreadCount={unreadCount} />

        {/* Quick create */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setCreateOpen(!createOpen) }}
            className="flex items-center gap-2 h-[40px] px-4 text-sm font-semibold text-white rounded-[var(--hp-radius)] transition-colors duration-150"
            style={{ background: createOpen ? 'var(--hp-accent-hover)' : 'var(--hp-accent)' }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            <span className="hidden sm:block">Создать</span>
            <ChevronDown
              style={{
                width: 14, height: 14,
                transition: 'transform 0.15s',
                transform: createOpen ? 'rotate(180deg)' : 'rotate(0)',
              }}
              className="hidden sm:block opacity-80"
            />
          </button>

          {createOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-52 py-2 rounded-[var(--hp-radius)] z-50 bg-[var(--hp-surface)]"
              style={{ border: '1px solid var(--hp-border)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-3 pb-1.5">
                <span
                  className="text-[10px] font-bold text-[var(--hp-tertiary)] uppercase tracking-widest flex items-center gap-1"
                >
                  <Sparkles style={{ width: 10, height: 10 }} />
                  Быстрое создание
                </span>
              </div>
              {[
                { label: 'Контакт',  href: '/contacts/new',   Icon: UserIcon },
                { label: 'Объект',   href: '/properties/new', Icon: Home },
                { label: 'Сделку',   href: '/deals/new',      Icon: TrendingUp },
                { label: 'Договор',  href: '/contracts/new',  Icon: FileText },
                { label: 'Задачу',   href: '/tasks/new',      Icon: CheckSquare },
              ].map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 mx-1.5 px-3 py-2.5 text-sm text-[var(--hp-ink)] font-medium transition-colors duration-150 rounded-[var(--hp-radius)] hover:bg-[var(--hp-neutral-tint)]"
                >
                  <item.Icon className="w-4 h-4 text-[var(--hp-sub)]" />
                  {item.label}
                </a>
              ))}
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
