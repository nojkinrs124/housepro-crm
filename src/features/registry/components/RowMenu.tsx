'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { MoreHorizontal } from 'lucide-react'

export type RowMenuItem =
  | { label: string; href: string; icon?: ReactNode; danger?: false }
  | { label: string; onSelect: () => void; icon?: ReactNode; danger?: boolean; disabled?: boolean }

/**
 * Меню действий строки реестра: одна кнопка «…» вместо ряда иконок в каждой
 * строке. Иконки-карандаши и корзины в 20 строках подряд шумят и провоцируют
 * случайное удаление; опасные действия в меню — ниже черты и красным.
 */
export function RowMenu({ items, label = 'Действия' }: { items: RowMenuItem[]; label?: string }) {
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null)
  const open = pos !== null
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const setOpen = (v: boolean) => { if (!v) setPos(null) }

  // Меню рендерится в body с position: fixed — таблица реестра обёрнута в
  // overflow-hidden/overflow-x-auto и обрезала бы его у нижних строк.
  const toggle = () => {
    if (open) { setPos(null); return }
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const up = window.innerHeight - r.bottom < 140
    setPos({ top: up ? r.top - 4 : r.bottom + 4, right: window.innerWidth - r.right, up })
  }

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !menuRef.current?.contains(t)) setPos(null)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPos(null) }
    const off = () => setPos(null)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    window.addEventListener('scroll', off, true)
    window.addEventListener('resize', off)
    return () => {
      document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', off, true); window.removeEventListener('resize', off)
    }
  }, [open])

  const safe = items.filter(i => !('onSelect' in i && i.danger))
  const danger = items.filter(i => 'onSelect' in i && i.danger)
  const itemClass = 'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors disabled:opacity-50'

  const render = (item: RowMenuItem) => 'href' in item
    ? (
      <Link key={item.label} href={item.href} role="menuitem" onClick={() => setOpen(false)}
        className={`${itemClass} text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)]`}>
        {item.icon}{item.label}
      </Link>
    )
    : (
      <button key={item.label} type="button" role="menuitem" disabled={item.disabled}
        onClick={() => { setOpen(false); item.onSelect() }}
        className={`${itemClass} ${item.danger ? 'text-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)]' : 'text-[var(--hp-ink)] hover:bg-[var(--hp-neutral-tint)]'}`}>
        {item.icon}{item.label}
      </button>
    )

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className={`flex h-8 w-8 items-center justify-center border transition-colors ${open ? 'border-[var(--hp-sub)] text-[var(--hp-ink)]' : 'border-transparent text-[var(--hp-tertiary)] hover:border-[var(--hp-border)] hover:text-[var(--hp-ink)]'}`}
      >
        <MoreHorizontal style={{ width: 16, height: 16 }} />
      </button>
      {pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 min-w-[180px] border border-[var(--hp-border)] bg-[var(--hp-surface)] py-1"
          style={{ right: pos.right, ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
        >
          {safe.map(render)}
          {danger.length > 0 && safe.length > 0 && <div className="my-1 border-t border-[var(--hp-border-soft)]" />}
          {danger.map(render)}
        </div>,
        document.body,
      )}
    </div>
  )
}
