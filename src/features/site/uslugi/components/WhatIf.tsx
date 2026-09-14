'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Экран «Что если» — аккордеон вопросов и ответов.
 *
 * Общий для страниц раздела «Услуги»: «Сдать квартиру», «Снять», «Продать/купить»
 * задают свои вопросы через проп `items` (для «Сдать» — SDAT_WHAT_IF из
 * what-if-sdat.ts). Каждый пункт раскрывается независимо от остальных.
 * Клиентский из-за useState/onClick.
 */

export interface WhatIfItem {
  /** Вопрос — заголовок пункта */
  q: string
  /** Ответ — текст раскрывающейся панели */
  a: string
}

interface Props {
  items: WhatIfItem[]
  /** Заголовок секции (H2) */
  title?: string
  /** id секции для якорных ссылок */
  id?: string
}

export function WhatIf({ items, title = 'Что если', id }: Props) {
  const prefix = useId()
  const [openItems, setOpenItems] = useState<Set<number>>(() => new Set())

  const toggle = (index: number) => {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <section id={id} className="scroll-mt-20 pt-16 sm:pt-20">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          {title}
        </h2>

        <div
          className="mt-8 border px-5 sm:px-6"
          style={{
            background: 'var(--hp-surface)',
            borderColor: 'var(--hp-border)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          {items.map((item, index) => {
            const open = openItems.has(index)
            const buttonId = `${prefix}-whatif-btn-${index}`
            const panelId = `${prefix}-whatif-panel-${index}`
            return (
              <div
                key={item.q}
                className={index === 0 ? '' : 'border-t'}
                style={index === 0 ? undefined : { borderColor: 'var(--hp-border-soft)' }}
              >
                <h3 className="m-0">
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => toggle(index)}
                    className="w-full flex items-start justify-between gap-4 py-4 text-left"
                    style={{ color: 'var(--hp-ink)' }}
                  >
                    <span className="text-[15px] font-bold leading-snug">{item.q}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`transition-transform shrink-0${open ? ' rotate-180' : ''}`}
                      style={{ width: 16, height: 16, marginTop: 3, color: 'var(--hp-sub)' }}
                    />
                  </button>
                </h3>
                <div
                  role="region"
                  id={panelId}
                  aria-labelledby={buttonId}
                  hidden={!open}
                  className="pb-4 text-[14px] leading-relaxed"
                  style={{ color: 'var(--hp-sub)' }}
                >
                  {item.a}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
