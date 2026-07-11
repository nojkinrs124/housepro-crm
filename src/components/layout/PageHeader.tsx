import { ReactNode } from 'react'

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
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="hp-section-header">
      <div>
        <h1 className="hp-h1">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
