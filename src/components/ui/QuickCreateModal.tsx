'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface QuickCreateModalProps {
 title: string
 onClose: () => void
 children: React.ReactNode
}

/**
 * Модалка проекта — на нативном `<dialog>`.
 *
 * `showModal()` даёт бесплатно то, что раньше писалось руками и было написано
 * не везде: фокус-трап, закрытие по Esc, возврат фокуса на кнопку-открывашку
 * и inert для остальной страницы. Своим остаётся только блок прокрутки фона —
 * его браузер не берёт на себя.
 *
 * Все модальные окна проекта проходят через этот компонент: своя вёрстка
 * оверлея = ещё одно окно без клавиатуры и фокуса.
 */
export function QuickCreateModal({ title, onClose, children }: QuickCreateModalProps) {
 const ref = useRef<HTMLDialogElement>(null)

 useEffect(() => {
 ref.current?.showModal()
 document.body.style.overflow = 'hidden'
 return () => { document.body.style.overflow = '' }
 }, [])

 return (
 <dialog
 ref={ref}
 onClose={onClose}
 // Клик мимо карточки: цель события — сам <dialog>, то есть его ::backdrop.
 onClick={(e) => { if (e.target === ref.current) onClose() }}
 // hidden open:flex — элемент попадает в DOM до showModal(), и без этого
 // он мелькнул бы полноэкранным блоком: `flex` перебивает display:none.
 className="hidden open:flex m-0 w-full h-full max-w-none max-h-none bg-transparent p-4 items-center justify-center backdrop:bg-black/40 backdrop:backdrop-blur-sm"
 >
 <div className="w-full max-w-md bg-[var(--hp-surface)] border border-[var(--hp-border-soft)] max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between px-5 py-4 border-b border-border">
 <h3 className="font-semibold text-foreground">{title}</h3>
 <button
 type="button"
 onClick={onClose}
 className="text-muted-foreground hover:text-foreground transition-colors"
 aria-label="Закрыть"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 <div className="p-5">{children}</div>
 </div>
 </dialog>
 )
}
