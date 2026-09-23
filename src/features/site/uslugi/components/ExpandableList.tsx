'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

/**
 * Список строк, который по умолчанию показывает первые `visibleCount`,
 * остальное — под кнопкой «Показать все N». Используется вместо длинных стен
 * буллетов на страницах раздела «Услуги» («Что делаем», «Если вы…»).
 *
 * Принимает только строки (без renderItem/keyFor-пропов): страницы, которые его
 * вызывают, — серверные компоненты, а функцию из них в клиентский компонент
 * передать нельзя (RSC-payload её не сериализует, падает React error #441).
 * Тарифам с составными пунктами (`{ lead, text }`) нужен свой рендер — там
 * список раскрытия сделан локально внутри клиентского TariffCards.tsx.
 */

interface Props {
  items: string[]
  visibleCount?: number
  className?: string
}

export function ExpandableList({ items, visibleCount = 5, className }: Props) {
  const [expanded, setExpanded] = useState(false)
  const hasMore = items.length > visibleCount
  const shown = expanded ? items : items.slice(0, visibleCount)

  return (
    <>
      <ul className={className ?? 'space-y-2.5'}>
        {shown.map(item => (
          <li
            key={item}
            className="flex items-start gap-2.5 text-[14px] leading-relaxed"
            style={{ color: 'var(--hp-ink)' }}
          >
            <Check
              aria-hidden="true"
              style={{ width: 16, height: 16, marginTop: 3, color: 'var(--hp-accent)', flexShrink: 0 }}
            />
            <span className="break-words">{item}</span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold"
          style={{ color: 'var(--hp-accent)' }}
        >
          {expanded ? 'Свернуть' : `Показать все ${items.length} пунктов`}
          <ChevronDown
            aria-hidden="true"
            className={`transition-transform${expanded ? ' rotate-180' : ''}`}
            style={{ width: 14, height: 14 }}
          />
        </button>
      )}
    </>
  )
}
