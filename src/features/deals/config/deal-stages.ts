/**
 * Адаптер над конфигом направлений для мест, где направление работы неизвестно
 * или несущественно: сводные списки, поиск, экспорт, дайджест.
 *
 * Настоящий источник правды — `@/features/directions/config/directions.ts`.
 * Там у каждого из четырёх направлений своя воронка; здесь — плоская проекция
 * для тех экранов, которые показывают работы всех направлений вперемешку.
 *
 * Чего здесь больше нет: плоского списка DEAL_STAGES. Общей воронки не
 * существует — стадии зависят от направления, и экран, который показывает
 * колонки или степпер, обязан знать направление. Иначе он снова начнёт
 * предлагать «Переговоры» продаже и «Регистрацию» аренде.
 *
 * Файл намеренно без 'use client': его импортируют и серверные страницы,
 * и клиентские компоненты.
 */

import {
  DIRECTIONS,
  DIRECTION_LABELS,
  STAGE_CANCELLED,
  stageBadgeClass,
  terminalStageOf,
} from '@/features/directions/config/directions'

/** Названия направлений работы. Для назначения объекта — PROPERTY_PURPOSE_LABELS. */
export const DEAL_TYPE_LABELS: Record<string, string> = DIRECTION_LABELS

/**
 * Подписи всех стадий всех направлений одной картой.
 *
 * Коды стадий переиспользуются между направлениями только там, где это один и
 * тот же шаг с одинаковым названием, поэтому плоская карта однозначна. Проверку
 * этого держит `assertNoLabelConflicts` ниже — она выполняется при загрузке
 * модуля и падает на первом же расхождении, а не молча показывает не ту подпись.
 */
export const DEAL_STATUS_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const direction of DIRECTIONS) {
    for (const stage of direction.stages) {
      const existing = map[stage.value]
      if (existing !== undefined && existing !== stage.label) {
        throw new Error(
          `Стадия «${stage.value}» называется по-разному в разных направлениях ` +
            `(«${existing}» и «${stage.label}»). Плоская карта подписей становится ` +
            `неоднозначной: либо дайте стадиям разные коды, либо одинаковые названия.`,
        )
      }
      map[stage.value] = stage.label
    }
  }
  return map
})()

/** Все стадии для фильтров на сводных экранах, где направление не выбрано. */
export const ALL_STAGE_OPTIONS: { value: string; label: string }[] =
  Object.entries(DEAL_STATUS_LABELS).map(([value, label]) => ({ value, label }))

export { STAGE_CANCELLED }

/**
 * Бейдж стадии. Направление желательно передавать: без него нельзя отличить
 * терминальную стадию от промежуточной, и «В обслуживании» покрасится как работа
 * в процессе, хотя это успешное завершение воронки управления.
 */
export function dealStageBadgeClass(status: string, direction?: string | null): string {
  if (direction) return stageBadgeClass(direction, status)
  if (status === STAGE_CANCELLED.value) return 'hp-badge-neutral'
  if (status === 'completed' || status === 'in_service') return 'hp-badge-good'
  return 'hp-badge-warn'
}

/**
 * Сделка доведена до конца успешно.
 *
 * Одного `status === 'completed'` недостаточно: у управления терминальная стадия
 * называется `in_service` — объект ушёл в обслуживание. Проверка по общему коду
 * недосчитывала выручку и число закрытых сделок именно по управлению.
 */
export function isDealSucceeded(status: string, direction?: string | null): boolean {
  if (direction) return status === terminalStageOf(direction)
  return status === 'completed' || status === 'in_service'
}

/** Сделка закрыта — успешно или отменена. */
export function isDealClosed(status: string, direction?: string | null): boolean {
  if (status === STAGE_CANCELLED.value) return true
  if (direction) return status === terminalStageOf(direction)
  return status === 'completed' || status === 'in_service'
}
