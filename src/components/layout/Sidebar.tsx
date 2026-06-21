'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2, LayoutDashboard, Users, Home, FileText, CreditCard,
  CheckSquare, Settings, LogOut, ChevronLeft, ChevronRight,
  Zap, TrendingUp, UserCog, Download, BarChart2, X, Menu,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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
const roleColorsLight: Record<string, string> = {
  admin:      'bg-red-100/80 text-red-700 border border-red-200/50',
  manager:    'bg-emerald-100/80 text-emerald-700 border border-emerald-200/50',
  agent:      'bg-green-100/80 text-green-700 border border-green-200/50',
  accountant: 'bg-purple-100/80 text-purple-700 border border-purple-200/50',
}
const roleColorsDark: Record<string, string> = {
  admin:      'bg-red-500/15 text-red-400 border border-red-500/20',
  manager:    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  agent:      'bg-green-500/15 text-green-400 border border-green-500/20',
  accountant: 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
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
  dark = false,
}: {
  user: User | null
  collapsed: boolean
  onNavClick?: () => void
  dark?: boolean
}) {
  const pathname = usePathname()
  let lastSection: string | null = 'start'
  const [hoveredItem, setHoveredItem] = useState<{ name: string; top: number } | null>(null)

  return (
    <>
      <nav className="flex-1 py-3 px-3 overflow-y-auto overflow-x-hidden relative">
        <div className="space-y-0.5">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            const showSection = !collapsed && item.section && item.section !== lastSection
            if (!collapsed && item.section) lastSection = item.section

            return (
              <div key={item.href}>
                {showSection && (
                  <div className="px-3 pt-4 pb-1.5">
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-[0.08em]',
                      dark ? 'text-slate-600' : 'text-[#94A3B8]'
                    )}>
                      {item.section}
                    </span>
                  </div>
                )}
                <Link
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  onClick={onNavClick}
                  onMouseEnter={(e) => {
                    if (!collapsed) return
                    const itemRect = e.currentTarget.getBoundingClientRect()
                    const asideEl = e.currentTarget.closest('aside')
                    const asideRect = asideEl?.getBoundingClientRect()
                    if (!asideRect) return
                    setHoveredItem({ name: item.name, top: itemRect.top - asideRect.top + itemRect.height / 2 })
                  }}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={cn(
                    'relative flex items-center gap-3 rounded-[12px] text-sm font-medium transition-colors duration-200 group',
                    collapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5',
                    isActive
                      ? (dark ? 'text-[#4ADE80]' : 'text-[#16A34A]')
                      : (dark ? 'text-slate-400 hover:text-slate-200' : 'text-[#64748B] hover:text-[#111827] hover:bg-[#F1F5F9]')
                  )}
                >
                  {/* Анимированная активная «таблетка» — единый layoutId плавно перемещается между пунктами */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      className="absolute inset-0 rounded-[12px] -z-10"
                      style={dark ? {
                        background: 'rgba(34,197,94,0.18)',
                        boxShadow: '0 0 0 1px rgba(74,222,128,0.25), 0 0 20px rgba(34,197,94,0.35)',
                      } : {
                        background: 'rgba(34,197,94,0.1)',
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon
                    className={cn(
                      'shrink-0 relative transition-transform duration-200 group-hover:scale-110',
                      isActive
                        ? (dark ? 'text-[#4ADE80]' : 'text-[#16A34A]')
                        : (dark ? 'text-slate-500 group-hover:text-slate-300' : 'text-[#94A3B8] group-hover:text-[#64748B]')
                    )}
                    style={{ width: 17, height: 17 }}
                  />
                  {!collapsed && (
                    <span className="truncate relative">{item.name}</span>
                  )}
                </Link>
              </div>
            )
          })}
        </div>
      </nav>

      {/* Единый тултип для свёрнутого режима — рендерится ВНЕ overflow-контейнера nav,
          иначе он растягивает scrollWidth и браузер рисует горизонтальный скроллбар */}
      {collapsed && hoveredItem && (
        <span
          className="absolute z-50 px-2 py-1 text-xs font-medium text-white bg-[#111827] rounded-lg pointer-events-none whitespace-nowrap shadow-lg"
          style={{ left: 'calc(100% + 10px)', top: hoveredItem.top, transform: 'translateY(-50%)' }}
        >
          {hoveredItem.name}
        </span>
      )}

      {/* User section */}
      <div
        className="mx-3 mb-3 rounded-[16px] overflow-hidden"
        style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(248,250,252,0.8)' }}
      >
        {!collapsed ? (
          <div className="p-3 space-y-2">
            <Link
              href="/settings/profile"
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 group',
                dark ? 'hover:bg-white/[0.06]' : 'hover:bg-white/80'
              )}
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
                <p className={cn('text-sm font-semibold truncate leading-tight', dark ? 'text-white' : 'text-[#111827]')}>
                  {user?.full_name ?? 'Сотрудник'}
                </p>
                <span className={cn(
                  'inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold mt-0.5',
                  (dark ? roleColorsDark : roleColorsLight)[user?.role ?? 'agent']
                )}>
                  {roleLabels[user?.role ?? 'agent']}
                </span>
              </div>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl transition-all duration-200 font-medium',
                  dark ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-[#64748B] hover:text-red-600 hover:bg-red-50'
                )}
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
                className={cn(
                  'w-full flex items-center justify-center p-2 rounded-xl transition-all duration-200',
                  dark ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-[#94A3B8] hover:text-red-600 hover:bg-red-50'
                )}
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
        'relative hidden md:flex flex-col shrink-0 transition-all duration-300 ease-in-out',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
      style={{
        background: 'linear-gradient(180deg, #0F172A 0%, #111827 100%)',
        boxShadow: '8px 0 40px rgba(0,0,0,0.18)',
      }}
    >
      {/* Logo area */}
      <div className={cn(
        'h-[72px] flex items-center border-b shrink-0 relative overflow-hidden',
        collapsed ? 'px-4 justify-center' : 'px-5',
      )}
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {/* Дышащее свечение за лого */}
        <div
          className="sidebar-logo-glow absolute -top-10 -left-2 w-[140px] h-[140px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.35), transparent 70%)', filter: 'blur(10px)' }}
        />
        <div className="flex items-center gap-3 min-w-0 relative">
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
              <span className="font-bold text-white text-[16px] leading-tight block tracking-tight">HousePro</span>
              <span className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase leading-tight">CRM</span>
            </div>
          )}
        </div>
      </div>

      <SidebarContent user={user} collapsed={collapsed} dark />

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-[88px] w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-[#4ADE80] transition-all z-10"
        style={{
          background: '#1E293B',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        }}
      >
        {collapsed ? <ChevronRight style={{ width: 13, height: 13 }} /> : <ChevronLeft style={{ width: 13, height: 13 }} />}
      </button>
    </aside>
  )
}
