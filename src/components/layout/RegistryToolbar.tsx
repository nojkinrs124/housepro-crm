'use client'

import { useState } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface FilterOption { value: string; label: string }

export interface FilterDef {
  /** Уникальный ключ фильтра — используется как React key и id открытого меню */
  key: string
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
}

export interface ViewOption {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

/**
 * Панель над реестром: поиск, выпадающие фильтры, переключатель вида.
 *
 * Раньше эта разметка жила двумя почти одинаковыми копиями в
 * ContactsViewSwitcher и DealsViewSwitcher — и они успели разъехаться
 * (контакты были в токенах «Кабинета», сделки остались на ярко-зелёном
 * хардкоде из старой системы). Теперь вид один на оба реестра.
 *
 * Компонент презентационный: состояние (в т.ч. сохранение в localStorage)
 * остаётся во владении вызывающего свитчера.
 */
export function RegistryToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Поиск…',
  filters = [],
  views,
  view,
  onViewChange,
  onReset,
  foundLabel,
}: {
  search: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string
  filters?: FilterDef[]
  views?: ViewOption[]
  view?: string
  onViewChange?: (v: string) => void
  onReset?: () => void
  /** «Найдено: 12 из 1 248» — показывается только при активных фильтрах */
  foundLabel?: React.ReactNode
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const hasFilters = search.trim() !== '' || filters.some(f => f.value !== 'all')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Поиск */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--hp-tertiary)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-[34px] pl-9 pr-8 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius-sm)] text-[12.5px] outline-none focus:border-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] transition-colors"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              aria-label="Очистить поиск"
            >
              <X className="w-3.5 h-3.5 text-[var(--hp-tertiary)] hover:text-[var(--hp-ink)]" />
            </button>
          )}
        </div>

        {/* Фильтры */}
        {filters.map(filter => {
          const currentLabel = filter.options.find(o => o.value === filter.value)?.label
          const isOpen = openKey === filter.key
          const isActive = filter.value !== 'all'
          return (
            <div key={filter.key} className="relative">
              <button
                onClick={() => setOpenKey(isOpen ? null : filter.key)}
                className={`hp-chip${isActive ? ' active' : ''}`}
              >
                {currentLabel}
                {isActive ? (
                  <X
                    className="w-3 h-3 shrink-0"
                    onClick={e => { e.stopPropagation(); filter.onChange('all'); setOpenKey(null) }}
                  />
                ) : (
                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              <AnimatePresence>
                {isOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenKey(null)} />
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full mt-1.5 left-0 z-50 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] py-1 min-w-[170px] overflow-hidden"
                    >
                      {filter.options.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => { filter.onChange(opt.value); setOpenKey(null) }}
                          className={`w-full text-left px-3.5 py-2 text-[12.5px] hover:bg-[var(--hp-neutral-tint)] transition-colors ${
                            filter.value === opt.value
                              ? 'font-semibold text-[var(--hp-ink)]'
                              : 'text-[var(--hp-sub)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )
        })}

        {hasFilters && onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-2 h-[34px] text-[12.5px] font-medium text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Сбросить
          </button>
        )}

        <div className="flex-1" />

        {/* Переключатель вида */}
        {views && views.length > 1 && onViewChange && (
          <div className="flex items-center gap-1 bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius-sm)] p-1">
            {views.map(v => {
              const Icon = v.icon
              const isCurrent = view === v.value
              return (
                <button
                  key={v.value}
                  onClick={() => onViewChange(v.value)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--hp-radius-sm)] text-[12.5px] font-semibold transition-colors"
                  style={isCurrent
                    ? { background: 'var(--hp-accent)', color: '#fff' }
                    : { color: 'var(--hp-sub)' }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {hasFilters && foundLabel && (
        <p className="text-[11.5px] text-[var(--hp-sub)]">{foundLabel}</p>
      )}
    </div>
  )
}
