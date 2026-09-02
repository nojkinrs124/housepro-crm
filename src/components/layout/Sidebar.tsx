'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Home, FileText, BookOpen,
  CheckSquare, Settings, LogOut, PanelLeftClose, PanelLeftOpen,
  Zap, TrendingUp, UserCog, BarChart2, X, Menu,
  Eye, FolderOpen, CalendarDays, Building2, Library,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { logout } from '@/features/auth/actions/auth.actions'
import type { UserBadge } from '@/types/database'

const navigation = [
  { name: 'Дашборд',     href: '/dashboard',    icon: LayoutDashboard, section: null },
  { name: 'Лиды',        href: '/leads',         icon: Zap,             section: 'Продажи' },
  { name: 'Сделки',      href: '/deals',         icon: TrendingUp,      section: null },
  { name: 'Контакты',    href: '/contacts',      icon: Users,           section: null },
  { name: 'Объекты',     href: '/properties',    icon: Home,            section: 'База' },
  { name: 'Управление',  href: '/management',    icon: Building2,       section: null },
  { name: 'Показы',      href: '/showings',      icon: Eye,             section: null },
  { name: 'Подборки',    href: '/collections',   icon: FolderOpen,      section: null },
  { name: 'Договоры',    href: '/contracts',     icon: FileText,        section: null },
  { name: 'Календарь',   href: '/calendar',      icon: CalendarDays,    section: 'Управление' },
  { name: 'Задачи',      href: '/tasks',         icon: CheckSquare,     section: null },
  { name: 'Бухгалтерия', href: '/accounting',    icon: BookOpen,        section: null },
  { name: 'Аналитика',   href: '/analytics',     icon: BarChart2,       section: null },
  { name: 'База знаний', href: '/knowledge',     icon: Library,         section: 'Система' },
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
  onToggleCollapse,
}: {
  user: UserBadge | null
  collapsed: boolean
  onNavClick?: () => void
  /** Есть только у десктопного сайдбара — мобильному drawer сворачивать нечего. */
  onToggleCollapse?: () => void
}) {
  const pathname = usePathname()
  let lastSection: string | null = 'start'
  const [hoveredItem, setHoveredItem] = useState<{ name: string; top: number } | null>(null)

  return (
    <>
      {/* hp-scroll-hidden — сам список скроллится (колесом/трекпадом), если не
          помещается, но полоса скролла нигде не рисуется: на части систем она
          рисуется толстой и заметной и визуально спорит с компактным меню. */}
      <nav className="flex-1 py-1.5 px-3 overflow-y-auto overflow-x-hidden relative hp-scroll-hidden">
        <div className="space-y-0.5">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            const showSection = !collapsed && item.section && item.section !== lastSection
            if (!collapsed && item.section) lastSection = item.section

            return (
              <div key={item.href}>
                {showSection && (
                  <div className="px-3 pt-2 pb-0.5">
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
                    'relative flex items-center gap-3 rounded-[var(--hp-radius)] text-sm font-medium transition-colors duration-150 group focus:outline-none focus-visible:bg-[var(--hp-neutral-tint)]',
                    collapsed ? 'px-2.5 py-1 justify-center' : 'px-3 py-1',
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

      {/* User section — плоско, без рамки-бокса: во всём сайдбаре нет ни одной
          обводки вокруг пункта, только hover-заливка и hairline-разделители
          между секциями, поэтому и здесь разделитель один — верхняя граница,
          а не отдельная коробка на весь блок. Отступы ссылки (px-3) те же,
          что и у пунктов меню (nav px-3 + Link px-3) — аватар встаёт точно
          под иконками, а не правее них. */}
      <div className="border-t border-[var(--hp-border)] shrink-0">
        {!collapsed ? (
          <div className="px-3 py-2 space-y-0.5">
            <Link
              href="/settings/profile"
              onClick={onNavClick}
              className="flex items-center gap-3 px-3 py-1.5 rounded-[var(--hp-radius)] transition-colors duration-150 group hover:bg-[var(--hp-neutral-tint)] focus:outline-none focus-visible:bg-[var(--hp-neutral-tint)]"
            >
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={user.full_name || 'User'}
                  className="w-8 h-8 rounded-[var(--hp-radius)] object-cover shrink-0 border border-[var(--hp-border)]"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-[var(--hp-radius)] flex items-center justify-center shrink-0 text-white text-sm font-bold"
                  style={{ background: 'var(--hp-accent)' }}
                >
                  {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate leading-tight text-[var(--hp-ink)]">
                  {user?.full_name ?? 'Сотрудник'}
                </p>
                <p className="text-[11.5px] text-[var(--hp-sub)] truncate mt-0.5">
                  {roleLabels[user?.role ?? 'agent']}
                </p>
              </div>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center gap-3 px-3 py-1.5 text-sm rounded-[var(--hp-radius)] transition-colors duration-150 font-medium text-[var(--hp-sub)] hover:text-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)] focus:outline-none focus-visible:bg-[var(--hp-danger-tint)] focus-visible:text-[var(--hp-danger)]"
              >
                <LogOut style={{ width: 15, height: 15 }} className="shrink-0" />
                <span>Выйти</span>
              </button>
            </form>
            {/* Свернуть меню — обычная плоская строка в общем ряду с профилем
                и выходом, а не отдельная плавающая кнопка на границе сайдбара:
                так она не спорит ни с шапкой (там логотип), ни со списком
                меню (там скролл). Иконка предметная (панель), не шеврон. */}
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="w-full flex items-center gap-3 px-3 py-1.5 text-sm rounded-[var(--hp-radius)] transition-colors duration-150 font-medium text-[var(--hp-sub)] hover:text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] focus:outline-none focus-visible:bg-[var(--hp-neutral-tint)] focus-visible:text-[var(--hp-ink)]"
              >
                <PanelLeftClose style={{ width: 15, height: 15 }} className="shrink-0" />
                <span>Свернуть меню</span>
              </button>
            )}
          </div>
        ) : (
          <div className="py-2 px-2 space-y-1.5">
            <div
              className="w-8 h-8 rounded-[var(--hp-radius)] flex items-center justify-center mx-auto text-white text-xs font-bold"
              style={{ background: 'var(--hp-accent)' }}
            >
              {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <form action={logout}>
              <button
                type="submit"
                title="Выйти"
                className="w-full flex items-center justify-center p-1.5 rounded-[var(--hp-radius)] transition-colors duration-150 text-[var(--hp-sub)] hover:text-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)] focus:outline-none focus-visible:bg-[var(--hp-danger-tint)] focus-visible:text-[var(--hp-danger)]"
              >
                <LogOut style={{ width: 16, height: 16 }} />
              </button>
            </form>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Развернуть меню"
                className="w-full flex items-center justify-center p-1.5 rounded-[var(--hp-radius)] transition-colors duration-150 text-[var(--hp-sub)] hover:text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)] focus:outline-none focus-visible:bg-[var(--hp-neutral-tint)] focus-visible:text-[var(--hp-ink)]"
              >
                <PanelLeftOpen style={{ width: 16, height: 16 }} />
              </button>
            )}
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
  user: UserBadge | null
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
          'fixed left-0 top-0 bottom-0 z-50 w-[300px] flex flex-col bg-[var(--hp-surface)] transition-transform duration-300 ease-in-out md:hidden',
        )}
        style={{
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <div className="h-[68px] flex items-center justify-between px-5 border-b border-[var(--hp-border)] shrink-0">
          <a href="/" title="На сайт ХаусПро" className="group">
            <span
              className="font-bold text-[var(--hp-ink)] text-[18px] leading-tight block tracking-tight transition-colors group-hover:text-[var(--hp-accent)]"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              ХаусПро
            </span>
            <span className="text-[10px] text-[var(--hp-tertiary)] font-semibold tracking-widest uppercase leading-tight">CRM</span>
          </a>
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

export function MobileBottomNav({ user }: { user: UserBadge | null }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <MobileDrawer user={user} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-[var(--hp-surface)]"
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

export function Sidebar({ user }: { user: UserBadge | null }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'relative hidden md:flex flex-col shrink-0 transition-all duration-300 ease-in-out bg-[var(--hp-surface)] border-r border-[var(--hp-border)]',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo area — высота ровно как у Header (68px), иначе граница под этим
          блоком и граница под шапкой справа не совпадают по одной линии и
          дают «ступеньку» ровно на стыке сайдбара и основного окна. */}
      <div className={cn(
        'h-[68px] flex items-center border-b border-[var(--hp-border)] shrink-0',
        collapsed ? 'px-4 justify-center' : 'px-5',
      )}>
        {/* Логотип ведёт на публичный сайт «ХаусПро» — привычное поведение
            бренда в шапке; переход внутрь CRM даёт пункт «Дашборд» в меню.
            Обычный <a>, а не <Link>: сайт и кабинет — разные разделы,
            клиентская навигация Next.js тут ничего не ускоряет. */}
        {collapsed ? (
          // Свёрнутая ширина (72px) слишком узкая для текста — здесь остаётся
          // компактный монограмма-квадрат вместо иконки здания: буква имени,
          // а не сторонний глиф, тот же принцип «только название».
          <a
            href="/"
            title="На сайт ХаусПро"
            className="w-8 h-8 rounded-[var(--hp-radius)] flex items-center justify-center shrink-0 text-white text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: 'var(--hp-accent)', fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            Х
          </a>
        ) : (
          <a href="/" title="На сайт ХаусПро" className="min-w-0 group">
            <span
              className="font-bold text-[var(--hp-ink)] text-[18px] leading-tight block tracking-tight transition-colors group-hover:text-[var(--hp-accent)]"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              ХаусПро
            </span>
            <span className="text-[10px] text-[var(--hp-tertiary)] font-semibold tracking-widest uppercase leading-tight">CRM</span>
          </a>
        )}
      </div>

      {/* Сворачивание — обычная строка в подвале сайдбара (см. SidebarContent),
          не отдельная плавающая кнопка на границе: раньше она стояла то на
          скролле списка меню, то в шапке рядом с логотипом — в обоих случаях
          выглядела чужеродно, единственный «бокс» на весь плоский сайдбар. */}
      <SidebarContent user={user} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
    </aside>
  )
}
