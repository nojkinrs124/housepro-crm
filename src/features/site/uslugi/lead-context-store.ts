'use client'

/**
 * Клиентское хранилище контекста заявки на странице «Сдать квартиру».
 *
 * Секции страницы — независимые клиентские компоненты (карточки тарифов,
 * калькулятор, документы, липкая панель), общего React-контекста над ними
 * нет. Поэтому контекст живёт в модульном сторе: любая кнопка вызывает
 * `requestLead(ctx)` — контекст сохраняется, страница прокручивается к форме,
 * форма подписана через `useLeadContext()` и подставляет значения.
 *
 * Калькулятор дополнительно публикует текущие район/комнатность/ставку через
 * `updateCalcContext()` — чтобы кнопка тарифа, нажатая ПОСЛЕ игры с
 * калькулятором, унесла в лид и ставку, а не только тариф.
 */

import { useSyncExternalStore } from 'react'
import { USLUGI_ANCHORS } from './config'
import type { UslugiLeadContext } from './lead-context'

type Listener = () => void

let context: UslugiLeadContext = {}
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): UslugiLeadContext {
  return context
}

const EMPTY: UslugiLeadContext = {}
function getServerSnapshot(): UslugiLeadContext {
  return EMPTY
}

/** Текущий контекст заявки; ререндер при каждом изменении */
export function useLeadContext(): UslugiLeadContext {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Калькулятор сообщает свои текущие значения. Тариф и intent не трогает —
 * они принадлежат кнопке, которую нажмёт пользователь.
 */
export function updateCalcContext(
  patch: Pick<UslugiLeadContext, 'district' | 'rooms' | 'rate'>
) {
  context = { ...context, ...patch }
  emit()
}

/**
 * Кнопка «хочу заявку»: дополняет контекст и прокручивает к форме.
 * Поля из `patch` перекрывают текущие; остальное (например ставка из
 * калькулятора) сохраняется.
 */
export function requestLead(patch: UslugiLeadContext) {
  context = { ...context, ...patch }
  emit()
  scrollToAnchor(USLUGI_ANCHORS.lead)
}

/** Плавная прокрутка к якорю на странице; вне браузера — ничего */
export function scrollToAnchor(id: string) {
  if (typeof document === 'undefined') return
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Сброс после успешной отправки, чтобы вторая заявка не унесла старый контекст */
export function resetLeadContext() {
  context = {}
  emit()
}
