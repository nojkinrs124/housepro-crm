'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2, LayoutDashboard, Users, Home, FileText, CreditCard,
  CheckSquare, Settings, LogOut, ChevronLeft, ChevronRight,
  Zap, TrendingUp, UserCog, Download, BarChart2, X, Menu,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { logout } from '@/features/auth/actions/auth.actions'
import type { User } from '@/types/database'

const navigation = [
  { name: 'Дашборд',     href: '/dashboard',  icon: LayoutDashboard },
  { name: 'Лиды',        href: '/leads',      icon: Zap },
  { name: 'Сделки',      href: '/deals',      icon: TrendingUp },
  { name: 'Контакты',    href: '/contacts',   icon: Users },
  { name: 'Объекты',     href: '/properties', icon: Home },
  { name: 'Договоры',    href: '/contracts',  icon: FileText },
  { name: 'Задачи',      href: '/tasks',      icon: CheckSquare },
  { name: 'Платежи',     href: '/payments',   icon: CreditCard },
  { name: 'Аналитика',   href: '/analytics',  icon: BarChart2 },
  { name: 'Экспорт',     href: '/export',     icon: Download },
  { name: 'Сотрудники',  href: '/employees',  icon: UserCog },
  { name: 'Настройки',   href: '/settings',   icon: Settings },
]

const roleLabels: Record<string, string> = {
  admin: 'Администратор', manager: 'Менеджер',
  agent: 'Риелтор', accountant: 'Бухгалтер',
}
const roleBadgeColors: Record<string, string> = {
  admin:      'bg-red-100 text-red-700',
  manager:    'bg-emerald-100 text-emerald-700',
  agent:      'bg-green-100 text-green-700',
  accountant: 'bg-purple-100 text-purple-700',
}

// ─── Mobile bottom nav (5 most-used items) ───────────────────────────────────

const bottomNav = [
  { name: 'Дашборд',  href: '/dashboard',  icon: LayoutDashboard },
  { name: 'Лиды',     href: '/leads',      icon: Zap },
  { name: 'Сделки',   href: '/deals',      icon: TrendingUp },
  { name: 'Задачи',   href: '/tasks',      icon: CheckSquare },
  { name: 'Меню',     href: '#menu',       icon: Menu },
]

// ─── Sidebar inner content (shared between desktop + mobile drawer) ──────────

function SidebarContent({
  user,
  collapsed,
  onNavClick,
}: {
  user: User | null
  collapsed: boolean
  onNavClick?: () => void
}) {
  const pathname = usePathname()

  return (
    <>
      {/* Nav */}
      <nav className={cn('flex-1 py-4 overflow-y-auto', collapsed ? 'px-3' : 'px-4')}>
        <div className="space-y-0.5">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.name : undefined}
                onClick={onNavClick}
                className={cn(
                  'relative flex items-center gap-3 rounded-[12px] text-sm font-medium transition-all duration-200',
                  collapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3.5 py-2.5',
                  isActive
                    ? 'text-[#16A34A]'
                    : 'text-[#64748B] hover:text-[#111827]'
                )}
                style={isActive ? { background: 'rgba(34,197,94,0.1)' } : undefined}
              >
                {isActive && !collapsed && (
                  <span
                    className="absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-r-full"
                    style={{ background: '#22C55E' }}
                  />
                )}
                <span
                  className={cn(
                    'absolute inset-0 rounded-[12px] transition-all duration-200',
                    !isActive && 'hover:bg-[#F8FAFC]'
                  )}
                  aria-hidden
                />
                <Icon
                  className={cn(
                    'shrink-0 relative z-10 transition-all duration-200',
                    isActive ? 'text-[#16A34A]' : 'text-[#94A3B8]'
                  )}
                  style={{ width: 17, height: 17 }}
                />
                {!collapsed && <span className="relative z-10">{item.name}</span>}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User section */}
      <div className={cn('border-t border-border/60 p-4', collapsed && 'p-3')}>
        {!collapsed ? (
          <div className="space-y-3">
            <Link
              href="/settings/profile"
              onClick={onNavClick}
              className="flex items-center gap-3 p-2.5 rounded-[12px] hover:bg-[#F8FAFC] transition-all duration-200 group"
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name || 'User'}
                  className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-[#22C55E]/20"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-semibold"
                  style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)' }}
                >
                  {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#111827] truncate leading-tight">
                  {user?.full_name ?? 'Сотрудник'}
                </p>
                <span className={cn(
                  'inline-block text-[11px] px-1.5 py-0.5 rounded-full font-medium mt-0.5',
                  roleBadgeColors[user?.role ?? 'agent']
                )}>
                  {roleLabels[user?.role ?? 'agent']}
                </span>
              </div>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-[12px] transition-all duration-200 font-medium"
              >
                <LogOut style={{ width: 16, height: 16 }} />
                <span>Выйти</span>
              </button>
            </form>
          </div>
        ) : (
          <form action={logout}>
            <button
              type="submit"
              title="Выйти"
              className="w-full flex items-center justify-center p-2.5 text-[#94A3B8] hover:text-red-600 hover:bg-red-50 rounded-[12px] transition-all duration-200"
            >
              <LogOut style={{ width: 17, height: 17 }} />
            </button>
          </form>
        )}
      </div>
    </>
  )
}

// ─── Mobile Drawer ────────────────────────────────────────────────────────────

function MobileDrawer({
  user,
  open,
  onClose,
}: {
  user: User | null
  open: boolean
  onClose: () => void
}) {
  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 w-[280px] flex flex-col bg-white transition-transform duration-300 ease-in-out md:hidden',
        )}
        style={{
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: '4px 0 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Drawer header */}
        <div className="h-[68px] flex items-center justify-between px-6 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)' }}
            >
              <Building2 style={{ width: 18, height: 18 }} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-[#111827] text-[15px] leading-tight block">HousePro</span>
              <span className="text-[11px] text-[#64748B] font-medium tracking-wide uppercase leading-tight">CRM</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC] transition-all"
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <SidebarContent user={user} collapsed={false} onNavClick={onClose} />
      </aside>
    </>
  )
}

// ─── Mobile Bottom Nav Bar ────────────────────────────────────────────────────

export function MobileBottomNav({ user }: { user: User | null }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <MobileDrawer user={user} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden"
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(214,219,235,0.8)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex items-center justify-around px-2 h-[60px]">
          {bottomNav.map((item) => {
            const Icon = item.icon
            const isMenu = item.href === '#menu'
            const isActive = isMenu
              ? drawerOpen
              : (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)))

            return (
              <button
                key={item.href}
                onClick={() => {
                  if (isMenu) {
                    setDrawerOpen(true)
                  } else {
                    window.location.href = item.href
                  }
                }}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 min-w-[52px]',
                  isActive ? 'text-[#16A34A]' : 'text-[#94A3B8]'
                )}
                style={isActive ? { background: 'rgba(34,197,94,0.08)' } : undefined}
              >
                <Icon style={{ width: 20, height: 20 }} />
                <span className="text-[10px] font-medium leading-tight">{item.name}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────

export function Sidebar({ user }: { user: User | null }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'relative hidden md:flex flex-col shrink-0 transition-all duration-300 ease-in-out',
        'bg-white border-r border-border/60',
        collapsed ? 'w-[72px]' : 'w-[280px]'
      )}
      style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.03)' }}
    >
      {/* Logo */}
      <div className={cn(
        'h-[68px] flex items-center border-b border-border/60 shrink-0',
        collapsed ? 'px-4 justify-center' : 'px-6'
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)' }}
          >
            <Building2 className="text-white" style={{ width: 18, height: 18 }} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-bold text-[#111827] text-[15px] leading-tight block">HousePro</span>
              <span className="text-[11px] text-[#64748B] font-medium tracking-wide uppercase leading-tight">CRM</span>
            </div>
          )}
        </div>
      </div>

      <SidebarContent user={user} collapsed={collapsed} />

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-[84px] w-7 h-7 bg-white border border-border/80 rounded-full flex items-center justify-center text-[#64748B] hover:text-[#16A34A] hover:border-[#22C55E]/40 transition-all shadow-sm z-10"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
      >
        {collapsed ? <ChevronRight style={{ width: 13, height: 13 }} /> : <ChevronLeft style={{ width: 13, height: 13 }} />}
      </button>
    </aside>
  )
}
