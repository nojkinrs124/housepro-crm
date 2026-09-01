'use client'

import { useEffect, useId, useRef, useState } from 'react'

// Поле ввода с подсказками DaData (адрес / организация / банк).
//
// Запросы идут в наш роут /api/dadata/[type], а не напрямую в DaData: ключ
// агентства не должен попадать в браузер.
//
// Если подсказки не настроены (нет DADATA_API_KEY), компонент молча работает
// как обычный input — это осознанно: отсутствие интеграции не должно мешать
// заводить объекты и контрагентов.

export type SuggestKind = 'address' | 'party' | 'bank'

/** Плоская запись подсказки: ключ → значение, как их отдаёт lib/dadata/client. */
export type SuggestionRecord = Record<string, string | number | null>

interface DadataSuggestInputProps {
 /** Имя поля в форме — сюда попадает выбранная строка. */
 name: string
 kind: SuggestKind
 defaultValue?: string | null
 placeholder?: string
 required?: boolean
 className?: string
 id?: string
 /**
 * Какое поле подсказки показывать в списке и подставлять в input.
 * Для адреса — 'value', для организации — 'name', для банка — 'name'.
 */
 labelKey?: string
 /**
 * Карта «поле подсказки → name другого input в той же форме».
 * При выборе значения проставляются автоматически: ИНН → инпут inn и т.д.
 * Заполняются и обычные, и hidden-поля (координаты объекта).
 */
 fillFields?: Record<string, string>
 /** Дополнительная подпись под полем — например, найденные координаты. */
 renderHint?: (suggestion: SuggestionRecord) => string | null
}

const MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 250

export function DadataSuggestInput({
 name,
 kind,
 defaultValue,
 placeholder,
 required,
 className,
 id,
 labelKey = kind === 'address' ? 'value' : 'name',
 fillFields,
 renderHint,
}: DadataSuggestInputProps) {
 const generatedId = useId()
 const inputId = id ?? `${name}-${generatedId}`
 const [value, setValue] = useState(defaultValue ?? '')
 const [items, setItems] = useState<SuggestionRecord[]>([])
 const [open, setOpen] = useState(false)
 const [loading, setLoading] = useState(false)
 const [hint, setHint] = useState<string | null>(null)
 const wrapRef = useRef<HTMLDivElement>(null)
 // Пользователь мог выбрать подсказку — тогда следующий ввод не должен
 // немедленно открывать список заново поверх уже выбранного значения.
 const skipNextFetch = useRef(false)

 useEffect(() => {
 if (skipNextFetch.current) {
 skipNextFetch.current = false
 return
 }
 if (value.trim().length < MIN_QUERY_LENGTH) {
 setItems([])
 return
 }

 const controller = new AbortController()
 const timer = setTimeout(async () => {
 setLoading(true)
 try {
 const res = await fetch(`/api/dadata/${kind}?q=${encodeURIComponent(value)}`, {
 signal: controller.signal,
 })
 if (!res.ok) return
 const json = (await res.json()) as { suggestions?: SuggestionRecord[] }
 setItems(json.suggestions ?? [])
 setOpen((json.suggestions ?? []).length > 0)
 } catch {
 // Прерванный запрос или сетевая ошибка — поле продолжает работать как обычное.
 } finally {
 setLoading(false)
 }
 }, DEBOUNCE_MS)

 return () => {
 controller.abort()
 clearTimeout(timer)
 }
 }, [value, kind])

 // Клик вне поля закрывает список — без этого выпадашка перекрывает форму.
 useEffect(() => {
 function onDocClick(e: MouseEvent) {
 if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
 }
 document.addEventListener('mousedown', onDocClick)
 return () => document.removeEventListener('mousedown', onDocClick)
 }, [])

 function applySuggestion(suggestion: SuggestionRecord) {
 const label = String(suggestion[labelKey] ?? '')
 skipNextFetch.current = true
 setValue(label)
 setOpen(false)
 setHint(renderHint ? renderHint(suggestion) : null)

 if (!fillFields) return
 // Форма может быть неконтролируемой (defaultValue + name), поэтому значения
 // проставляем через DOM ближайшей формы, а не через общий state — это
 // единственный способ не переписывать существующие формы целиком.
 const form = wrapRef.current?.closest('form')
 if (!form) return

 for (const [suggestionKey, fieldName] of Object.entries(fillFields)) {
 const raw = suggestion[suggestionKey]
 if (raw === null || raw === undefined || raw === '') continue
 const field = form.elements.namedItem(fieldName)
 if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
 field.value = String(raw)
 // React-контролируемые поля не увидят прямое присваивание value —
 // событие input заставляет их синхронизироваться.
 field.dispatchEvent(new Event('input', { bubbles: true }))
 }
 }
 }

 return (
 <div ref={wrapRef} className="relative">
 <input
 id={inputId}
 name={name}
 value={value}
 required={required}
 placeholder={placeholder}
 autoComplete="off"
 onChange={(e) => setValue(e.target.value)}
 onFocus={() => { if (items.length > 0) setOpen(true) }}
 className={className ?? 'hp-input'}
 />

 {loading && (
 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--hp-tertiary)]">
 ищем…
 </span>
 )}

 {open && items.length > 0 && (
 <ul className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-auto bg-[var(--hp-surface)] border border-[var(--hp-border)] divide-y divide-[var(--hp-border-soft)]">
 {items.map((item, index) => (
 <li key={`${String(item[labelKey])}-${index}`}>
 <button
 type="button"
 onClick={() => applySuggestion(item)}
 className="w-full text-left px-4 py-2.5 hover:bg-[var(--hp-neutral-tint)] transition-colors"
 >
 <span className="block text-sm text-[var(--hp-ink)]">{String(item[labelKey] ?? '')}</span>
 <SuggestionMeta kind={kind} item={item} />
 </button>
 </li>
 ))}
 </ul>
 )}

 {hint && <p className="text-xs text-[var(--hp-sub)] mt-1">{hint}</p>}
 </div>
 )
}

function SuggestionMeta({ kind, item }: { kind: SuggestKind; item: SuggestionRecord }) {
 if (kind === 'party') {
 const parts = [item.inn ? `ИНН ${item.inn}` : null, item.legalAddress].filter(Boolean)
 const liquidated = item.status && item.status !== 'ACTIVE'
 return (
 <span className="block text-xs text-[var(--hp-sub)] mt-0.5">
 {liquidated && <span className="text-[var(--hp-danger)] font-semibold">не действует · </span>}
 {parts.join(' · ')}
 </span>
 )
 }
 if (kind === 'bank') {
 return (
 <span className="block text-xs text-[var(--hp-sub)] mt-0.5">
 {[item.bik ? `БИК ${item.bik}` : null, item.address].filter(Boolean).join(' · ')}
 </span>
 )
 }
 const geo = item.latitude && item.longitude ? 'координаты найдены' : null
 return (
 <span className="block text-xs text-[var(--hp-sub)] mt-0.5">
 {[item.postalCode, item.metro ? `м. ${item.metro}` : null, geo].filter(Boolean).join(' · ')}
 </span>
 )
}
