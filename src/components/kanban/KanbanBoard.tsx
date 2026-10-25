'use client'

import React, { useRef, useState } from 'react'

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
  const [items, setItems] = useState(initialItems)
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
    setItems(current => current.map(candidate => candidate.id === item.id ? { ...candidate, status } : candidate))
    clearDrag()
    try {
      const result = await onStatusChange(item.id, status)
      if (result && 'error' in result && result.error) {
        setItems(current => current.map(candidate => candidate.id === item.id ? { ...candidate, status: item.status } : candidate))
        onError?.(result.error)
      }
    } catch {
      setItems(current => current.map(candidate => candidate.id === item.id ? { ...candidate, status: item.status } : candidate))
      onError?.('Не удалось изменить статус. Попробуйте ещё раз.')
    }
  }

  return (
    <div className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
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
  )
}
