'use client'

import { useEffect, useRef } from 'react'

/**
 * Чекбокс выделения строки. Отдельный компонент ради двух вещей: состояния
 * «выбрано не всё» в шапке таблицы (его нельзя выразить разметкой) и остановки
 * всплытия — строки реестра кликабельны целиком.
 */
export function SelectBox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  label: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked
  }, [indeterminate, checked])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={onChange}
      onClick={e => e.stopPropagation()}
      className="w-4 h-4 cursor-pointer accent-[var(--hp-accent)] align-middle"
    />
  )
}
