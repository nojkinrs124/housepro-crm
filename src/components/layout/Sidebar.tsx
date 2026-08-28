'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2, LayoutDashboard, Users, Home, FileText, BookOpen,
  CheckSquare, Settings, LogOut, ChevronLeft, ChevronRight,
  Zap, TrendingUp, UserCog, Download, BarChart2, X, Menu,
  Eye, FolderOpen,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { logout } from '@/features/auth/actions/auth.actions'
import type { User } from '@/types/database'

const navigation = [
  { name: 'Дашборд',     href: '/dashboard',    icon: LayoutDashboard, section: null },
  { name: 'Лиды',        href: '/leads',         icon: Zap,             section: 'Продажи' },
  { name: 'Сделки',      href: '/deals',         icon: TrendingUp,      section: null },
  { name: 'Контакты',    href: '/contacts',      icon: Users,           section: null },
  { name: 'Объекты',     href: '/properties',    icon: Home,            section: 'База' },
  { name: 'Показы',      href: '/showings',      icon: Eye,             section: null },
  { name: 'Подборки',    href: '/collections',   icon: FolderOpen,      section: null },
  { name: 'Договоры',    href: '/contracts',     icon: FileText,        section: null },
  { name: 'Задачи',      href: '/tasks',         icon: CheckSquare,     section: 'Управление' },
  { name: 'Бухгалтерия', href: '/accounting',    icon: BookOpen,        section: null },
  { name: 'Аналитика',   href: '/analytics',     icon: BarChart2,       section: null },
  { name: 'Экспорт',     href: '/export',        icon: Download,        section: 'Система' },
  { name: 'Сотрудники',  href: '/employees',     icon: UserCog,         section: null },
  { name: 'Настройки',   href: '/settings',      icon: Settings,        section: null },
]

const roleLabels: Record<string, string> = {
  admin: 'Администратор', manager: 'Менеджер',
  agent: 'Риелтор', accountant: 'Бухгалтер',
}
/* Роли — монохромные бейджи с hairline-границей, без цветных заливок:
   единственный цвет в системе — семантика статусов (good/warn/danger),
   роль сотрудника статусом не является. */
const roleColorsLight: Record<string, string> = {
  admin:      'bg-[var(--hp-neutral-tint)] text-[var(--hp-ink)] border border-[var(--hp-border)]',
  manager:    'bg-[var(--hp-neutral-tint)] text-[var(--hp-ink)] border border-[var(--hp-border)]',
  agent:      'bg-[var(--hp-neutral-tint)] text-[var(--hp-ink)] border border-[var(--hp-border)]',
  accountant: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-ink)] border border-[var(--hp-border)]',
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
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--hp-tertiary)]">
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
                    'relative flex items-center gap-3 rounded-[var(--hp-radius)] text-sm font-medium transition-colors duration-150 group',
                    collapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5',
                    isActive
                      ? 'text-[var(--hp-ink)]'
                      : 'text-[var(--hp-sub)] hover:text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)]'
                  )}
                >
                  {/* Активный пункт — заливка hp-accent-tint, плавно едет между пунктами (layoutId) */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      className="absolute inset-0 rounded-[var(--hp-radius)] -z-10 border border-[var(--hp-border)]"
                      style={{ background: 'var(--hp-accent-tint)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon
                    className={cn(
                      'shrink-0 relative transition-transform duration-150',
                      isActive ? 'text-[var(--hp-ink)]' : 'text-[var(--hp-sub)] group-hover:text-[var(--hp-ink)]'
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
          className="absolute z-50 px-2 py-1 text-xs font-medium text-white bg-[var(--hp-accent)] rounded-[var(--hp-radius)] pointer-events-none whitespace-nowrap"
          style={{ left: 'calc(100% + 10px)', top: hoveredItem.top, transform: 'translateY(-50%)' }}
        >
          {hoveredItem.name}
        </span>
      )}

      {/* User section */}
      <div className="mx-3 mb-3 rounded-[var(--hp-radius)] overflow-hidden border border-[var(--hp-border)]">
        {!collapsed ? (
          <div className="p-3 space-y-2">
            <Link
              href="/settings/profile"
              onClick={onNavClick}
              className="flex items-center gap-3 p-2.5 rounded-[var(--hp-radius)] transition-colors duration-150 group hover:bg-[var(--hp-neutral-tint)]"
            >
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={user.full_name || 'User'}
                  className="w-9 h-9 rounded-full object-cover shrink-0 border border-[var(--hp-border)]"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold"
                  style={{ background: 'var(--hp-accent)' }}
                >
                  {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate leading-tight text-[var(--hp-ink)]">
                  {user?.full_name ?? 'Сотрудник'}
                </p>
                <span className={cn(
                  'inline-block text-[10px] px-2 py-0.5 rounded-[var(--hp-radius)] font-semibold mt-0.5',
                  roleColorsLight[user?.role ?? 'agent']
                )}>
                  {roleLabels[user?.role ?? 'agent']}
                </span>
              </div>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-[var(--hp-radius)] transition-colors duration-150 font-medium text-[var(--hp-sub)] hover:text-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)]"
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
              style={{ background: 'var(--hp-accent)' }}
            >
              {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <form action={logout}>
              <button
                type="submit"
                title="Выйти"
                className="w-full flex items-center justify-center p-2 rounded-[var(--hp-radius)] transition-colors duration-150 text-[var(--hp-sub)] hover:text-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)]"
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
        <div className="h-[72px] flex items-center justify-between px-5 border-b border-[var(--hp-border)] shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-[var(--hp-radius)] flex items-center justify-center shrink-0"
              style={{ background: 'var(--hp-accent)' }}
            >
              <Building2 style={{ width: 18, height: 18 }} className="text-white" />
            </div>
            <div>
              <span
                className="font-bold text-[var(--hp-ink)] text-[17px] leading-tight block tracking-tight"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
              >
                HousePro
              </span>
              <span className="text-[10px] text-[var(--hp-tertiary)] font-semibold tracking-widest uppercase leading-tight">CRM</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-[var(--hp-radius)] text-[var(--hp-sub)] hover:text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] transition-colors"
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
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white"
        style={{
          borderTop: '1px solid var(--hp-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
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
                  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-[var(--hp-radius)] transition-colors duration-150 min-w-[52px]',
                  isActive ? 'text-[var(--hp-ink)] bg-[var(--hp-neutral-tint)]' : 'text-[var(--hp-tertiary)]'
                )}
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
        'relative hidden md:flex flex-col shrink-0 transition-all duration-300 ease-in-out bg-white border-r border-[var(--hp-border)]',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo area */}
      <div className={cn(
        'h-[72px] flex items-center border-b border-[var(--hp-border)] shrink-0',
        collapsed ? 'px-4 justify-center' : 'px-5',
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-[var(--hp-radius)] flex items-center justify-center shrink-0"
            style={{ background: 'var(--hp-accent)' }}
          >
            <Building2 className="text-white" style={{ width: 18, height: 18 }} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span
                className="font-bold text-[var(--hp-ink)] text-[17px] leading-tight block tracking-tight"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
              >
                HousePro
              </span>
              <span className="text-[10px] text-[var(--hp-tertiary)] font-semibold tracking-widest uppercase leading-tight">CRM</span>
            </div>
          )}
        </div>
      </div>

      <SidebarContent user={user} collapsed={collapsed} />

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-[88px] w-7 h-7 flex items-center justify-center rounded-full text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors z-10 bg-white border border-[var(--hp-border)]"
      >
        {collapsed ? <ChevronRight style={{ width: 13, height: 13 }} /> : <ChevronLeft style={{ width: 13, height: 13 }} />}
      </button>
    </aside>
  )
}
