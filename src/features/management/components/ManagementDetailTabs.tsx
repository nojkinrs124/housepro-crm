'use client'

import { useState, type ReactNode } from 'react'

export interface DetailTab {
  key: string
  label: string
  content: ReactNode
  /** Точка на ярлыке — есть что-то, требующее внимания именно на этой вкладке. */
  alert?: boolean
}

/**
 * Вкладки карточки объекта в управлении.
 *
 * Контент всех вкладок уже отрисован сервером и приходит сюда готовыми
 * деревьями — переключение прячет их через `hidden`, а не размонтирует:
 * иначе открытая форма выплаты или счётчика теряла бы состояние при
 * случайном клике по соседней вкладке.
 */
export function ManagementDetailTabs({ tabs }: { tabs: DetailTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key)

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex items-center gap-1 border-b border-[var(--hp-border)] flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => setActive(tab.key)}
            className={`relative px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
              active === tab.key
                ? 'text-[var(--hp-ink)] border-b-2 border-[var(--hp-accent)]'
                : 'text-[var(--hp-sub)] border-b-2 border-transparent hover:text-[var(--hp-ink)]'
            }`}
          >
            {tab.label}
            {tab.alert && <span className="absolute top-2 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--hp-danger)]" />}
          </button>
        ))}
      </div>

      {tabs.map(tab => (
        <div key={tab.key} hidden={active !== tab.key} className="space-y-4">
          {tab.content}
        </div>
      ))}
    </div>
  )
}
