'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  LayoutDashboard,
  Users,
  Home,
  FileText,
  CheckSquare,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { logout } from '@/features/auth/actions/auth.actions'
import type { User } from '@/types/database'

const navigation = [
  { name: 'Дашборд', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Клиенты', href: '/clients', icon: Users },
  { name: 'Объекты', href: '/properties', icon: Home },
  { name: 'Договоры', href: '/contracts', icon: FileText },
  { name: 'Задачи', href: '/tasks', icon: CheckSquare },
  { name: 'Настройки', href: '/settings', icon: Settings },
]

const roleLabels: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  agent: 'Риелтор',
  accountant: 'Бухгалтер',
}

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  agent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  accountant: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

export function Sidebar({ user }: { user: User | null }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r border-border bg-card transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-bold text-foreground truncate">HousePro CRM</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User profile */}
      <div className="border-t border-border p-3">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 px-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary text-xs font-semibold">
                  {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.full_name ?? 'Сотрудник'}
                </p>
                <span className={cn(
                  'inline-block text-xs px-1.5 py-0.5 rounded-full font-medium',
                  roleBadgeColors[user?.role ?? 'agent']
                )}>
                  {roleLabels[user?.role ?? 'agent']}
                </span>
              </div>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Выйти</span>
              </button>
            </form>
          </div>
        ) : (
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center justify-center p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-all shadow-sm z-10"
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3" />
          : <ChevronLeft className="w-3 h-3" />
        }
      </button>
    </aside>
  )
}
