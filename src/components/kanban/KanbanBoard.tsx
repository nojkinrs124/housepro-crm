'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface KanbanItem {
  id: string
  status: string
}

interface KanbanBoardProps<T extends KanbanItem> {
  items: T[]
  columns: Array<{ status: string; label: string; [key: string]: unknown }>
  columnClassName?: (status: string, isOver: boolean) => string
  canDrop?: (item: T, status: string) => boolean
  onInvalidDrop?: (item: T, status: string) => void
  onCardClickCapture?: (event: React.MouseEvent, item: T) => void
  columnContent?: (column: { status: string; label: string; [key: string]: unknown }, items: T[], isOver: boolean, defaultContent: React.ReactNode) => React.ReactNode
  renderColumn?: (column: { status: string; label: string; [key: string]: unknown }, items: T[], isOver: boolean) => React.ReactNode
  columnStyle?: React.CSSProperties
  boardClassName?: string
  boardStyle?: React.CSSProperties
  children?: (item: T, isDragging: boolean) => React.ReactNode
  onStatusChange: (id: string, status: string) => Promise<{ error?: string } | void>
  onError?: (message: string) => void
  onDragStateChange?: (dragging: boolean) => void
  renderColumnHeader?: (column: { status: string; label: string; [key: string]: unknown }, items: T[]) => React.ReactNode
  renderEmpty?: (isOver: boolean) => React.ReactNode
  renderColumnFooter?: (column: { status: string; label: string; [key: string]: unknown }, items: T[]) => React.ReactNode
  /** Сколько карточек показывать в колонке до «Показать ещё». Без лимита — все. */
  previewLimit?: number
}

/** Shared native HTML5 Kanban shell: drop zones, optimistic status updates and rollback. */
export function KanbanBoard<T extends KanbanItem>({
  items: initialItems,
  columns,
  columnContent,
  canDrop,
  onInvalidDrop,
  onCardClickCapture,
  columnClassName,

  boardClassName = 'flex gap-4 min-w-max',
  boardStyle,
  children,
  onStatusChange,
  onError,
  onDragStateChange,
  columnStyle,
  renderColumn,
  renderColumnHeader,
  renderEmpty,
  renderColumnFooter,
  previewLimit,
}: KanbanBoardProps<T>) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  // Локально храним только оптимистичные смены статуса (id → статус), а сам
  // список берём из пропса. Раньше список копировался в state один раз при
  // монтировании, и фильтры/поиск над доской не меняли карточки вовсе: счётчик
  // «Найдено: 1», а на доске все лиды (QA 28.10.2026, E-01).
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const items = useMemo(
    () => initialItems.map(item => (overrides[item.id] && overrides[item.id] !== item.status ? { ...item, status: overrides[item.id] } : item)),
    [initialItems, overrides],
  )
  const setStatus = (id: string, status: string) => setOverrides(current => ({ ...current, [id]: status }))
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  const [dragged, setDragged] = useState<T | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const draggingRef = useRef(false)

  const clearDrag = () => {
    setDragged(null)
    setDragOver(null)
    draggingRef.current = false
    onDragStateChange?.(false)
  }

  const drop = async (event: React.DragEvent, status: string) => {
    event.preventDefault()
    const item = dragged ?? items.find(candidate => candidate.id === event.dataTransfer.getData('text/plain'))
    setDragOver(null)
    if (!item) { clearDrag(); return }
    if (canDrop && !canDrop(item, status)) { onInvalidDrop?.(item, status); clearDrag(); return }
    if (item.status === status) { clearDrag(); return }
    setStatus(item.id, status)
    clearDrag()
    try {
      const result = await onStatusChange(item.id, status)
      if (result && 'error' in result && result.error) {
        setStatus(item.id, item.status)
        onError?.(result.error)
      }
    } catch {
      setStatus(item.id, item.status)
      onError?.('Не удалось изменить статус. Попробуйте ещё раз.')
    }
  }

  // Стрелки прокрутки: доска шире экрана, а горизонтальный бегунок у её нижнего
  // края — на длинной колонке он уезжает за низ окна (QA 28.10.2026, A-09).
  const updateEdges = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])
  useEffect(() => {
    updateEdges()
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(updateEdges)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [updateEdges, items.length])
  const scrollByColumn = (direction: 1 | -1) => {
    stopHoverScroll()
    const el = scrollRef.current
    if (!el) return
    const column = el.querySelector<HTMLElement>('[data-stage]')
    const step = (column?.offsetWidth ?? 280) + 16
    el.scrollBy({ left: direction * step, behavior: 'smooth' })
  }
  // Наведение на стрелку плавно прокручивает доску, пока курсор на стрелке
  // (просьба владельца 28.10.2026); клик — шаг на одну колонку.
  const hoverTimer = useRef<number | null>(null)
  const stopHoverScroll = () => {
    if (hoverTimer.current !== null) cancelAnimationFrame(hoverTimer.current)
    hoverTimer.current = null
  }
  const startHoverScroll = (direction: 1 | -1) => {
    stopHoverScroll()
    const tick = () => {
      const el = scrollRef.current
      if (!el) return
      el.scrollLeft += direction * 8
      hoverTimer.current = requestAnimationFrame(tick)
    }
    hoverTimer.current = requestAnimationFrame(tick)
  }
  useEffect(() => stopHoverScroll, [])

  // При перетаскивании карточки к краю доска прокручивается сама.
  const autoScrollOnDrag = (event: React.DragEvent) => {
    const el = scrollRef.current
    if (!el || !draggingRef.current) return
    const rect = el.getBoundingClientRect()
    const zone = 60
    if (event.clientX < rect.left + zone) el.scrollBy({ left: -24 })
    else if (event.clientX > rect.right - zone) el.scrollBy({ left: 24 })
  }

  return (
    <div className="relative group/kanban">
    {edges.left && (
      <button type="button" aria-label="Прокрутить доску влево" onClick={() => scrollByColumn(-1)}
        onMouseEnter={() => startHoverScroll(-1)} onMouseLeave={stopHoverScroll}
        onDragEnter={() => startHoverScroll(-1)} onDragLeave={stopHoverScroll}
        className="hp-kanban-arrow left-0">
        <ChevronLeft strokeWidth={1.6} className="w-5 h-5" />
      </button>
    )}
    {edges.right && (
      <button type="button" aria-label="Прокрутить доску вправо" onClick={() => scrollByColumn(1)}
        onMouseEnter={() => startHoverScroll(1)} onMouseLeave={stopHoverScroll}
        onDragEnter={() => startHoverScroll(1)} onDragLeave={stopHoverScroll}
        className="hp-kanban-arrow right-0">
        <ChevronRight strokeWidth={1.6} className="w-5 h-5" />
      </button>
    )}
    <div ref={scrollRef} onScroll={updateEdges} onDragOver={autoScrollOnDrag} className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className={boardClassName} style={boardStyle}>
        {columns.map(column => {
          const columnItems = items.filter(item => item.status === column.status)
          const isOver = dragOver === column.status
          const defaultContent = <div className="p-3 space-y-2 min-h-40 flex-1">
                {columnItems.length === 0
                  ? renderEmpty?.(isOver) ?? <div className="text-center py-6 text-[12.5px] text-[var(--hp-tertiary)]">{isOver ? 'Перетащите сюда' : 'Нет карточек'}</div>
                  : (previewLimit && !expanded[column.status] ? columnItems.slice(0, previewLimit) : columnItems).map(item => (
                    <div key={item.id} draggable onDragStart={event => { draggingRef.current = true; setDragged(item); onDragStateChange?.(true); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id) }} onDragEnd={clearDrag} className={dragged?.id === item.id ? 'opacity-40' : undefined} onClickCapture={event => onCardClickCapture?.(event, item)}>
                      {children?.(item, dragged?.id === item.id)}
                    </div>
                  ))}
                {previewLimit != null && columnItems.length > previewLimit && (
                  <button
                    type="button"
                    onClick={() => setExpanded(state => ({ ...state, [column.status]: !state[column.status] }))}
                    className="w-full py-2 text-[12.5px] font-semibold text-[var(--hp-sub)] border border-dashed border-[var(--hp-border)] hover:text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors"
                  >
                    {expanded[column.status] ? 'Свернуть' : `Показать ещё ${columnItems.length - previewLimit}`}
                  </button>
                )}
              </div>
          const columnNode = <div key={column.status} data-stage={column.status} className={columnClassName?.(column.status, isOver)} style={{ scrollSnapAlign: 'start', ...columnStyle }} onDragOver={event => { const item = dragged ?? items.find(candidate => candidate.id === event.dataTransfer.getData('text/plain')); if (!item || (canDrop && !canDrop(item, column.status))) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOver(column.status) }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(null) }} onDrop={event => { const item = dragged ?? items.find(candidate => candidate.id === event.dataTransfer.getData('text/plain')); if (!item) return; void drop(event, column.status) }}>
            {renderColumnHeader?.(column, columnItems)}
            {renderColumn ? renderColumn(column, columnItems, isOver) : columnContent?.(column, columnItems, isOver, defaultContent) ?? defaultContent}
            {renderColumnFooter?.(column, columnItems)}
          </div>
          return columnNode
        })}
      </div>
    </div>
    </div>
  )
}
