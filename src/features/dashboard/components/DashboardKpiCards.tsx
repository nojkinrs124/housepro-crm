'use client'

import Link from 'next/link'
import {
  Zap, TrendingUp, Users, Home, FileText, CheckSquare
} from 'lucide-react'

const iconMap: Record<string, React.ElementType> = {
  Zap, TrendingUp, Users, Home, FileText, CheckSquare,
}

interface KpiCard {
  title: string
  value: number
  icon: string
  /** Оставлены в данных для совместимости; иконка рисуется одним цветом --hp-sub. */
  color?: string
  iconBg?: string
  href: string
  /** Динамика за период — только настоящая; без данных бейдж не рисуется. */
  trend?: string
  trendPos?: boolean | null
}

/**
 * Показатели дашборда. Брендбук v2: иконка линейная и одного цвета (цвет в CRM
 * означает статус, а не раздел), без подложек, теней и «прыжка» при наведении;
 * число — засечками, как цены.
 */
export function DashboardKpiCards({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map(card => {
        const Icon = iconMap[card.icon]
        const trendClass =
          card.trendPos === true
            ? 'text-[var(--hp-good)] bg-[var(--hp-good-tint)]'
            : card.trendPos === false
              ? 'text-[var(--hp-danger)] bg-[var(--hp-danger-tint)]'
              : 'text-[var(--hp-sub)] bg-[var(--hp-neutral-tint)]'

        return (
          <Link
            key={card.title}
            href={card.href}
            className="block bg-[var(--hp-surface)] p-5 border border-[var(--hp-border-soft)] transition-colors hover:border-[var(--hp-sub)]"
          >
            <div className="flex items-start justify-between mb-4">
              {Icon && <Icon strokeWidth={1.6} style={{ width: 20, height: 20, color: 'var(--hp-sub)' }} />}
              {card.trend && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-[var(--hp-radius-badge)] ${trendClass}`}>
                  {card.trend}
                </span>
              )}
            </div>
            <p className="hp-price text-[32px] text-[var(--hp-ink)] leading-none">
              {card.value.toLocaleString('ru-RU')}
            </p>
            <p className="text-[12.5px] text-[var(--hp-sub)] mt-2 leading-snug font-medium">{card.title}</p>
          </Link>
        )
      })}
    </div>
  )
}
