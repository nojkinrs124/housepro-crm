'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Phone, LogIn } from 'lucide-react'
import { SITE_BRAND, SITE_NAV } from '@/features/site/config'

interface Props {
  phone: string
  phoneHref: string
}

export function SiteHeader({ phone, phoneHref }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ background: 'var(--hp-surface)', borderColor: 'var(--hp-border)' }}
    >
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
        <Link
          href="/"
          className="flex items-baseline gap-2 shrink-0"
          onClick={() => setOpen(false)}
        >
          <span
            className="text-[20px] font-bold tracking-tight"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--hp-ink)' }}
          >
            {SITE_BRAND}
          </span>
          <span className="hidden sm:inline text-[11px] font-semibold" style={{ color: 'var(--hp-tertiary)' }}>
            Красноярск
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-2">
          {SITE_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 text-[13.5px] font-semibold transition-colors"
              style={{
                color: isActive(item.href) ? 'var(--hp-ink)' : 'var(--hp-sub)',
                background: isActive(item.href) ? 'var(--hp-accent-tint)' : 'transparent',
                borderRadius: 'var(--hp-radius)',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <a
            href={phoneHref}
            className="hidden sm:flex items-center gap-2 text-[13.5px] font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--hp-ink)' }}
          >
            <Phone style={{ width: 15, height: 15, color: 'var(--hp-accent)' }} />
            {phone}
          </a>

          {/* Вход для сотрудников — намеренно скромный (не конкурирует с телефоном/CTA
              для посетителей сайта), но всегда виден: раньше в CRM попадали только
              по прямой ссылке /login, теперь есть заметная точка входа. */}
          <Link
            href="/login"
            className="hidden sm:flex items-center gap-1.5 text-[13px] font-semibold transition-colors hover:text-[var(--hp-ink)]"
            style={{ color: 'var(--hp-sub)' }}
          >
            <LogIn style={{ width: 14, height: 14 }} />
            Вход
          </Link>

          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={open}
            className="md:hidden w-10 h-10 flex items-center justify-center border"
            style={{
              borderColor: 'var(--hp-border)',
              borderRadius: 'var(--hp-radius)',
              color: 'var(--hp-ink)',
            }}
          >
            {open ? <X style={{ width: 18, height: 18 }} /> : <Menu style={{ width: 18, height: 18 }} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t" style={{ borderColor: 'var(--hp-border)' }}>
          <nav className="max-w-[1180px] mx-auto px-4 py-2 flex flex-col">
            {SITE_NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="py-3 text-[15px] font-semibold border-b last:border-b-0"
                style={{
                  color: isActive(item.href) ? 'var(--hp-accent)' : 'var(--hp-ink)',
                  borderColor: 'var(--hp-border-soft)',
                }}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={phoneHref}
              className="py-3 text-[15px] font-semibold flex items-center gap-2"
              style={{ color: 'var(--hp-ink)' }}
            >
              <Phone style={{ width: 16, height: 16, color: 'var(--hp-accent)' }} />
              {phone}
            </a>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="py-3 text-[15px] font-semibold flex items-center gap-2 border-t"
              style={{ color: 'var(--hp-sub)', borderColor: 'var(--hp-border-soft)' }}
            >
              <LogIn style={{ width: 16, height: 16 }} />
              Вход для сотрудников
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
