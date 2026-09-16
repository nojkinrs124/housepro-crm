import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

/**
 * Скелет формы — правила простоты №3 и №4.
 *
 *   <ServerActionForm action={createThingAction} className="space-y-4">
 *     <FormSection title="Основное">
 *       <Field label="Название" required>{поле: обычный input с классом hp-input}</Field>
 *       …не больше шести полей на виду…
 *     </FormSection>
 *     <FormExtra>            ← всё остальное, свёрнуто по умолчанию
 *       <Field label="Торг, ₽" hint="На сколько снизили цену от заявленной">…</Field>
 *     </FormExtra>
 *     <FormActions submitLabel="Создать сделку" cancelHref="/deals" />
 *   </ServerActionForm>
 *
 * Все компоненты серверные: разметка + нативный <details>, без состояния.
 * Поля — обычные <input className="hp-input">, чтобы проверка form-fields
 * видела их name.
 */

export function FormSection({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`hp-card p-5 space-y-4 ${className}`}>
      {title && <h2 className="hp-h2">{title}</h2>}
      {children}
    </div>
  )
}

/** Сетка полей: одна колонка на телефоне, две на десктопе. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
}

/**
 * Подпись + поле + подсказка. Подсказка — для полей, назначение которых
 * не очевидно по названию («Первый взнос — собственные средства при ипотеке»).
 */
export function Field({
  label,
  hint,
  required,
  children,
  className = '',
}: {
  label: string
  hint?: ReactNode
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="hp-label">
        {label}
        {required && <span className="text-[var(--hp-danger)]"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-[var(--hp-sub)]">{hint}</p>}
    </div>
  )
}

/**
 * «Дополнительно» — свёрнутый блок для полей, которые можно заполнить позже.
 * Нативный <details>: работает без JS, состояние не теряется при ошибке
 * валидации, если браузер вернул ту же страницу.
 */
export function FormExtra({
  title = 'Дополнительно',
  summary,
  defaultOpen = false,
  children,
}: {
  title?: string
  /** Что внутри — «банк, аванс, торг, источник» — чтобы не открывать вслепую */
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details className="hp-card group" open={defaultOpen} data-testid="form-extra">
      <summary className="flex items-center justify-between gap-3 p-5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="hp-h2 block">{title}</span>
          {summary && <span className="block text-xs text-[var(--hp-sub)] mt-0.5 truncate">{summary}</span>}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-[var(--hp-sub)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5 space-y-4 border-t border-[var(--hp-border-soft)] pt-4">
        {children}
      </div>
    </details>
  )
}

/**
 * Кнопки формы: одна главная + «Отмена» ссылкой. Сохранение не спрашивает
 * подтверждения (правило №7) — просто сохраняет.
 */
export function FormActions({
  submitLabel,
  cancelHref,
  cancelLabel = 'Отмена',
  submitTestId = 'form-submit',
  children,
}: {
  submitLabel: string
  cancelHref?: string
  cancelLabel?: string
  submitTestId?: string
  /** Дополнительные элементы справа, например второй submit «Сохранить и создать ещё» */
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 pt-1 flex-wrap">
      <button type="submit" data-testid={submitTestId} className="hp-btn-primary">
        {submitLabel}
      </button>
      {cancelHref && <Link href={cancelHref} className="hp-btn-secondary">{cancelLabel}</Link>}
      {children}
    </div>
  )
}
