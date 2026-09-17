'use client'

import { useEffect, useRef, useState } from 'react'

export interface ConfirmOptions {
  /** Заголовок окна. По умолчанию — «Подтвердите действие». */
  title?: string
  /** Подпись кнопки подтверждения. По умолчанию — «Удалить». */
  confirmLabel?: string
  /** Опасное действие красит кнопку в цвет тревоги. По умолчанию — да. */
  danger?: boolean
}

export interface PromptOptions extends ConfirmOptions {
  /** Подпись поля ввода. */
  inputLabel: string
  placeholder?: string
  /** Без текста подтверждение недоступно. По умолчанию — да. */
  required?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  text: string
  prompt?: PromptOptions
  resolve: (value: string | boolean) => void
}

/**
 * Подтверждение необратимого действия — окно приложения вместо `window.confirm`.
 *
 *   if (!(await confirmDialog('Удалить сделку СД-12? Отменить нельзя.'))) return
 *
 * Зачем свой: нативный диалог не стилизуется, не читается в тёмной теме, его
 * гасят headless-браузеры (сквозной проход 17.09.2026 не смог проверить ни
 * одно удаление), а текст последствий в нём нельзя оформить.
 *
 * Окно живёт в `<ConfirmHost />` (смонтирован один раз в корневом layout), а не
 * рядом с кнопкой: кнопка в меню «…» размонтируется вместе с меню сразу после
 * клика, и окно, привязанное к ней, исчезло бы вместе с ней.
 * На нативном `<dialog>` — фокус-трап, Esc и inert фона достаются бесплатно,
 * как в `QuickCreateModal`.
 */
let host: ((p: PendingConfirm) => void) | null = null

export function confirmDialog(text: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    if (!host) {
      // Хост не смонтирован (тест, storybook) — не блокируем действие молча.
      resolve(typeof window !== 'undefined' ? window.confirm(text) : false)
      return
    }
    host({ text, resolve: v => resolve(Boolean(v)), ...options })
  })
}

/**
 * Подтверждение с полем ввода — для действий, которым нужна причина
 * («Отменить сделку»). Возвращает введённый текст или null при отказе.
 */
export function promptDialog(text: string, options: PromptOptions): Promise<string | null> {
  return new Promise<string | null>(resolve => {
    if (!host) {
      resolve(typeof window !== 'undefined' ? window.prompt(text) : null)
      return
    }
    host({ text, prompt: options, resolve: v => resolve(typeof v === 'string' ? v : null), ...options })
  })
}

export function ConfirmHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  useEffect(() => {
    host = setPending
    return () => { host = null }
  }, [])

  if (!pending) return null
  const close = (value: string | boolean) => { pending.resolve(value); setPending(null) }
  return <ConfirmDialogView pending={pending} onClose={close} />
}

function ConfirmDialogView({ pending, onClose }: { pending: PendingConfirm; onClose: (value: string | boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    ref.current?.showModal()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const { title = 'Подтвердите действие', confirmLabel = 'Удалить', danger = true, text, prompt } = pending
  const canConfirm = !prompt || prompt.required === false || value.trim().length > 0
  const confirm = () => onClose(prompt ? value.trim() : true)

  return (
    <dialog
      ref={ref}
      onClose={() => onClose(false)}
      onClick={(e) => { if (e.target === ref.current) onClose(false) }}
      data-testid="confirm-dialog"
      className="hidden open:flex m-0 w-full h-full max-w-none max-h-none bg-transparent p-4 items-center justify-center backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="w-full max-w-md bg-[var(--hp-surface)] border border-[var(--hp-border)] p-5 space-y-4">
        <h3 className="font-semibold text-[var(--hp-ink)]">{title}</h3>
        <p className="text-sm text-[var(--hp-sub)] whitespace-pre-line">{text}</p>
        {prompt && (
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="confirm-dialog-input">{prompt.inputLabel}</label>
            <textarea
              id="confirm-dialog-input"
              data-testid="confirm-dialog-input"
              rows={3}
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={prompt.placeholder}
              className="hp-input !h-auto py-2.5 resize-none"
            />
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="hp-btn-secondary" onClick={() => onClose(false)} autoFocus={!prompt}>
            Отмена
          </button>
          <button
            type="button"
            data-testid="confirm-dialog-ok"
            disabled={!canConfirm}
            className={danger
              ? 'hp-btn-secondary text-[var(--hp-danger)] hover:border-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)] disabled:opacity-50'
              : 'hp-btn-primary disabled:opacity-50'}
            onClick={confirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
