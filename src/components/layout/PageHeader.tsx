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
  iconBg = 'bg-green-50',
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  backHref?: string
  backLabel?: string
  icon?: ReactNode
  iconBg?: string
}) {
  return (
    <div className="hp-section-header">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel ?? 'Назад'}
          </Link>
        )}
        <div className={icon ? 'flex items-center gap-3' : undefined}>
          {icon && (
            <div className={`w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 ${iconBg}`}>
              {icon}
            </div>
          )}
          <div>
            <h1 className="hp-h1">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
