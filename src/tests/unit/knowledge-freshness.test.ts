import { describe, it, expect } from 'vitest'
import { freshnessOf, needsReview } from '@/features/knowledge/services/freshness'

const NOW = new Date('2026-09-04T12:00:00Z')

/** Дата за N месяцев до NOW. */
function monthsAgo(n: number): string {
  const d = new Date(NOW)
  d.setMonth(d.getMonth() - n)
  return d.toISOString()
}

describe('freshnessOf', () => {
  it('статья без проверки требует внимания', () => {
    const state = freshnessOf(null, 6, NOW)
    expect(state.kind).toBe('never')
    expect(needsReview(state)).toBe(true)
  })

  it('свежая статья внутри срока — актуальна', () => {
    const state = freshnessOf(monthsAgo(1), 6, NOW)
    expect(state.kind).toBe('fresh')
    expect(needsReview(state)).toBe(false)
  })

  it('за две недели до срока предупреждает заранее', () => {
    // ровно 6 месяцев минус 10 дней
    const d = new Date(NOW)
    d.setMonth(d.getMonth() - 6)
    d.setDate(d.getDate() + 10)
    const state = freshnessOf(d.toISOString(), 6, NOW)
    expect(state.kind).toBe('soon')
    expect(needsReview(state)).toBe(true)
  })

  it('после срока — просрочена', () => {
    const state = freshnessOf(monthsAgo(8), 6, NOW)
    expect(state.kind).toBe('stale')
    expect(state.daysLeft).toBeLessThan(0)
    expect(state.label).toContain('Просрочена')
  })

  it('срок пересмотра свой у каждой статьи', () => {
    // те же 8 месяцев при годовом сроке ещё не просрочка
    expect(freshnessOf(monthsAgo(8), 12, NOW).kind).toBe('fresh')
    // а при трёхмесячном — уже
    expect(freshnessOf(monthsAgo(8), 3, NOW).kind).toBe('stale')
  })

  it('просрочку меньше месяца показывает в днях', () => {
    // 01.03 + 6 мес = 01.09, сегодня 04.09 — три дня просрочки
    expect(freshnessOf('2026-03-01T12:00:00Z', 6, NOW).label).toBe('Просрочена на 3 дн.')
  })
})
