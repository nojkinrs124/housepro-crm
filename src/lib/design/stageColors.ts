/**
 * Единый набор цветовых пар для канбан-колонок (leads/deals/tasks).
 * Раньше у каждой доски был свой независимый набор Tailwind-классов:
 * счётчик карточек в колонке либо красился в цвет колонки (leads),
 * либо всегда был серым (deals, tasks) — доски выглядели по-разному
 * без причины. Теперь все доски берут пару { border, badge } отсюда.
 */
export const STAGE_COLORS = {
  blue:   { color: 'border-t-blue-400',   badge: 'bg-blue-100 text-blue-700' },
  yellow: { color: 'border-t-yellow-400', badge: 'bg-yellow-100 text-yellow-700' },
  orange: { color: 'border-t-orange-400', badge: 'bg-orange-100 text-orange-700' },
  purple: { color: 'border-t-purple-400', badge: 'bg-purple-100 text-purple-700' },
  cyan:   { color: 'border-t-cyan-400',   badge: 'bg-cyan-100 text-cyan-700' },
  green:  { color: 'border-t-green-400',  badge: 'bg-green-100 text-green-700' },
  gray:   { color: 'border-t-gray-300',   badge: 'bg-gray-100 text-gray-600' },
  red:    { color: 'border-t-red-300',    badge: 'bg-red-100 text-red-600' },
} as const

export type StageColorKey = keyof typeof STAGE_COLORS
