/**
 * Свежесть инструкции.
 *
 * Чистые функции: по ним считается, пора ли перечитывать статью. Отдельно от
 * страниц, чтобы одно и то же правило работало и в списке, и в карточке, и в
 * будущем напоминании — а не разъехалось по трём местам, как разъезжались
 * словари статусов.
 *
 * Файл намеренно без 'use client'.
 */

/** Сколько дней до срока считается «скоро». */
const SOON_DAYS = 14

export type Freshness = 'fresh' | 'soon' | 'stale' | 'never'

export interface FreshnessState {
  kind: Freshness
  /** Дней до срока; отрицательное — просрочено. */
  daysLeft: number | null
  label: string
  badge: string
}

function addMonths(iso: string, months: number): Date {
  const d = new Date(iso)
  d.setMonth(d.getMonth() + months)
  return d
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/**
 * Состояние статьи на дату.
 *
 * `reviewedAt` — дата последней ПРОВЕРКИ, а не правки: опечатка в заголовке не
 * должна омолаживать устаревшую инструкцию.
 */
export function freshnessOf(
  reviewedAt: string | null | undefined,
  periodMonths: number,
  now: Date = new Date(),
): FreshnessState {
  if (!reviewedAt) {
    return { kind: 'never', daysLeft: null, label: 'Не проверялась', badge: 'hp-badge-warn' }
  }

  const due = addMonths(reviewedAt, periodMonths)
  const daysLeft = daysBetween(now, due)

  if (daysLeft < 0) {
    const overdue = Math.abs(daysLeft)
    return {
      kind: 'stale',
      daysLeft,
      label: overdue >= 30 ? `Просрочена на ${Math.floor(overdue / 30)} мес.` : `Просрочена на ${overdue} дн.`,
      badge: 'hp-badge-danger',
    }
  }

  if (daysLeft <= SOON_DAYS) {
    return { kind: 'soon', daysLeft, label: `Проверить через ${daysLeft} дн.`, badge: 'hp-badge-warn' }
  }

  return { kind: 'fresh', daysLeft, label: 'Актуальна', badge: 'hp-badge-good' }
}

/** Требует внимания — просрочена или срок вот-вот наступит. */
export function needsReview(state: FreshnessState): boolean {
  return state.kind === 'stale' || state.kind === 'never' || state.kind === 'soon'
}
