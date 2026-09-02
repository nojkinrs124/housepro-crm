import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { ReadinessIssue } from '@/lib/readiness'

/**
 * Блок «Чего не хватает» — показывает не «поле не заполнено», а какая функция
 * из-за этого молча не сработает: письмо не уйдёт, объявление не выгрузится,
 * в договоре останется пропуск. Ничего не запрещает: заводить записи можно в
 * любом порядке, блок просто не даёт пропуску потеряться.
 *
 * Server Component: только данные и разметка, интерактива внутри нет.
 */
export function ReadinessPanel({
  issues,
  title = 'Чего не хватает',
  actionLabel = 'Заполнить',
}: {
  issues: ReadinessIssue[]
  title?: string
  actionLabel?: string
}) {
  if (issues.length === 0) return null

  const blockers = issues.filter(i => i.level === 'blocker').length

  return (
    <div className="hp-block">
      <div className="hp-block-header flex items-center justify-between gap-3">
        <span>{title}</span>
        <span className={`hp-badge ${blockers > 0 ? 'hp-badge-danger' : 'hp-badge-warn'}`}>
          {blockers > 0 ? `${blockers} критичных` : `${issues.length}`}
        </span>
      </div>

      {issues.map(issue => (
        <div key={issue.id} className="hp-block-item items-start">
          <span
            className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
              issue.level === 'blocker' ? 'bg-[var(--hp-danger)]' : 'bg-[var(--hp-warn)]'
            }`}
          />
          <span className="flex-1 min-w-0">
            <span className="block text-[var(--hp-ink)] font-medium">{issue.missing}</span>
            <span className="block text-[12px] text-[var(--hp-sub)] mt-0.5">{issue.effect}</span>
          </span>
          {issue.href && (
            <Link
              href={issue.href}
              className="shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--hp-accent)] hover:underline"
            >
              {actionLabel}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}
