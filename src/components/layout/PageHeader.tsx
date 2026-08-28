import { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Единый заголовок страницы. Раньше строка
 *   <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">
 * была вручную скопирована в 15+ файлах (deals, leads, contacts, tasks, dashboard…).
 * Теперь размер/цвет/трекинг заголовка меняется в одном месте.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel,
  icon,
  iconBg = 'bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]',
  iconBoxClassName = 'w-11 h-11 rounded-[var(--hp-radius)]',
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  backHref?: string
  backLabel?: string
  icon?: ReactNode
  iconBg?: string
  iconBoxClassName?: string
}) {
  return (
    <div className="hp-section-header">
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="hp-back-link inline-flex items-center gap-2 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel ?? 'Назад'}
          </Link>
        )}
        <div className={icon ? 'flex items-center gap-4 min-w-0' : 'min-w-0'}>
          {icon && (
            <div className={`flex items-center justify-center shrink-0 ${iconBg} ${iconBoxClassName}`}>
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="hp-h1 break-words">{title}</h1>
            {subtitle && (
              <p className="text-sm text-[var(--hp-sub)] mt-1">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  )
}
