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
  { name: 'Дашборд',     href: '/dashboard',  icon: LayoutDashboard, section: null },
  { name: 'Лиды',        href: '/leads',      icon: Zap,             section: 'Продажи' },
  { name: 'Сделки',      href: '/deals',      icon: TrendingUp,      section: null },
  { name: 'Контакты',    href: '/contacts',   icon: Users,           section: null },
  { name: 'Объекты',     href: '/properties', icon: Home,            section: 'База' },
  { name: 'Договоры',    href: '/contracts',  icon: FileText,        section: null },
  { name: 'Задачи',      href: '/tasks',      icon: CheckSquare,     section: 'Управление' },
  { name: 'Платежи',     href: '/payments',   icon: CreditCard,      section: null },
  { name: 'Аналитика',   href: '/analytics',  icon: BarChart2,       section: null },
  { name: 'Экспорт',     href: '/export',     icon: Download,        section: 'Система' },
  { name: 'Сотрудники',  href: '/employees',  icon: UserCog,         section: null },
  { name: 'Настройки',   href: '/settings',   icon: Settings,        section: null },
]

const roleLabels: Record<string, string> = {
  admin: 'Администратор', manager: 'Менеджер',
  agent: 'Риелтор', accountant: 'Бухгалтер',
}
const roleColors: Record<string, string> = {
  admin:      'bg-red-100/80 text-red-700 border border-red-200/50',
  manager:    'bg-emerald-100/80 text-emerald-700 border border-emerald-200/50',
  agent:      'bg-green-100/80 text-green-700 border border-green-200/50',
  accountant: 'bg-purple-100/80 text-purple-700 border border-purple-200/50',
}

const bottomNav = [
  { name: 'Дашборд',  href: '/dashboard',  icon: LayoutDashboard },
  { name: 'Лиды',     href: '/leads',      icon: Zap },
  { name: 'Сделки',   href: '/deals',      icon: TrendingUp },
  { name: 'Задачи',   href: '/tasks',      icon: CheckSquare },
  { name: 'Меню',     href: '#menu',       icon: Menu },
]

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
  let lastSection: string | null = 'start'

  return (
    <>
      <nav className={cn('flex-1 py-3 overflow-y-auto', collapsed ? 'px-3' : 'px-3')}>
        <div className="space-y-0.5">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            const showSection = !collapsed && item.section && item.section !== lastSection
            if (!collapsed && item.section) lastSection = item.section
            else if (!item.section && lastSection !== 'start') lastSection = lastSection

            return (
              <div key={item.href}>
                {showSection && (
                  <div className="px-3 pt-4 pb-1.5">
                    <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.08em] letter-spacing-wider">
                      {item.section}
                    </span>
                  </div>
                )}
                <Link
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  onClick={onNavClick}
                  className={cn(
                    'relative flex items-center gap-3 rounded-[12px] text-sm font-medium transition-all duration-200 group',
                    collapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5',
                    isActive
                      ? 'text-[#16A34A]'
                      : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F1F5F9]'
                  )}
                  style={isActive ? {
                    background: 'rgba(34,197,94,0.1)',
                    color: '#16A34A',
                  } : undefined}
                >
                  {/* Active left border */}
                  {isActive && !collapsed && (
                    <span
                      className="absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-r-full"
                      style={{ background: 'linear-gradient(180deg, #16A34A, #22C55E)' }}
                    />
                  )}
                  <Icon
                    className={cn(
                      'shrink-0 transition-all duration-200',
                      isActive ? 'text-[#16A34A]' : 'text-[#94A3B8] group-hover:text-[#64748B]'
                    )}
                    style={{ width: 17, height: 17 }}
                  />
                  {!collapsed && (
                    <span className="truncate">{item.name}</span>
                  )}
                  {/* Tooltip on collapse */}
                  {collapsed && (
                    <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-[#111827] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                      {item.name}
                    </span>
                  )}
                </Link>
              </div>
            )
          })}
        </div>
      </nav>

      {/* User section */}
      <div className={cn(
        'mx-3 mb-3 rounded-[16px] overflow-hidden',
        collapsed ? '' : ''
      )}
        style={{ background: 'rgba(248,250,252,0.8)' }}>
        {!collapsed ? (
          <div className="p-3 space-y-2">
            <Link
              href="/settings/profile"
              onClick={onNavClick}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/80 transition-all duration-200 group"
            >
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={user.full_name || 'User'}
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                  style={{ boxShadow: '0 0 0 2px rgba(34,197,94,0.3)' }}
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}
                >
                  {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#111827] truncate leading-tight">
                  {user?.full_name ?? 'Сотрудник'}
                </p>
                <span className={cn(
                  'inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold mt-0.5',
                  roleColors[user?.role ?? 'agent']
                )}>
                  {roleLabels[user?.role ?? 'agent']}
                </span>
              </div>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 font-medium"
              >
                <LogOut style={{ width: 15, height: 15 }} />
                <span>Выйти</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="py-2 px-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center mx-auto text-white text-xs font-bold mb-2"
              style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)' }}
            >
              {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <form action={logout}>
              <button
                type="submit"
                title="Выйти"
                className="w-full flex items-center justify-center p-2 text-[#94A3B8] hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
              >
                <LogOut style={{ width: 16, height: 16 }} />
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  )
}

function MobileDrawer({
  user,
  open,
  onClose,
}: {
  user: User | null
  open: boolean
  onClose: () => void
}) {
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
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 w-[300px] flex flex-col bg-white transition-transform duration-300 ease-in-out md:hidden',
        )}
        style={{
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: '8px 0 48px rgba(0,0,0,0.15)',
        }}
      >
        <div className="h-[72px] flex items-center justify-between px-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)', boxShadow: '0 4px 12px rgba(22,163,74,0.35)' }}
            >
              <Building2 style={{ width: 18, height: 18 }} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-[#111827] text-[16px] leading-tight block tracking-tight">HousePro</span>
              <span className="text-[10px] text-[#64748B] font-semibold tracking-widest uppercase leading-tight">CRM</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#64748B] hover:text-[#111827] hover:bg-slate-100 transition-all"
          >
            <X style={{ width: 17, height: 17 }} />
          </button>
        </div>

        <SidebarContent user={user} collapsed={false} onNavClick={onClose} />
      </aside>
    </>
  )
}

export function MobileBottomNav({ user }: { user: User | null }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <MobileDrawer user={user} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(214,219,235,0.6)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center justify-around px-2 h-[62px]">
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
                  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-[12px] transition-all duration-200 min-w-[52px]',
                  isActive ? 'text-[#16A34A]' : 'text-[#94A3B8]'
                )}
                style={isActive ? { background: 'rgba(34,197,94,0.1)' } : undefined}
              >
                <Icon style={{ width: 20, height: 20 }} />
                <span className="text-[10px] font-semibold leading-tight">{item.name}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export function Sidebar({ user }: { user: User | null }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'relative hidden md:flex flex-col shrink-0 transition-all duration-300 ease-in-out bg-white',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
      style={{ borderRight: '1px solid rgba(214,219,235,0.5)', boxShadow: '4px 0 32px rgba(0,0,0,0.03)' }}
    >
      {/* Logo area */}
      <div className={cn(
        'h-[72px] flex items-center border-b shrink-0',
        collapsed ? 'px-4 justify-center' : 'px-5',
      )}
        style={{ borderColor: 'rgba(214,219,235,0.5)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
              boxShadow: '0 4px 12px rgba(22,163,74,0.35)',
            }}
          >
            <Building2 className="text-white" style={{ width: 18, height: 18 }} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-bold text-[#111827] text-[16px] leading-tight block tracking-tight">HousePro</span>
              <span className="text-[10px] text-[#64748B] font-semibold tracking-widest uppercase leading-tight">CRM</span>
            </div>
          )}
        </div>
      </div>

      <SidebarContent user={user} collapsed={collapsed} />

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-[88px] w-7 h-7 bg-white border flex items-center justify-center rounded-full text-[#64748B] hover:text-[#16A34A] transition-all z-10"
        style={{
          borderColor: 'rgba(214,219,235,0.8)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        }}
      >
        {collapsed ? <ChevronRight style={{ width: 13, height: 13 }} /> : <ChevronLeft style={{ width: 13, height: 13 }} />}
      </button>
    </aside>
  )
}
