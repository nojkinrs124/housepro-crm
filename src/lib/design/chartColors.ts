/**
 * Палитра графиков — те же цвета, что и токены `--hp-*` в globals.css,
 * но хексами: Recharts принимает цвет пропсом (`fill`, `stroke`), а не
 * классом, поэтому кодмод по Tailwind-классам их не задел, и графики
 * до 01.09.2026 оставались единственным местом с яркой «AI-SaaS» палитрой
 * (#22C55E, #7C3AED, #93C5FD) поверх приглушённого шалфейного интерфейса.
 *
 * ВАЖНО: значения обязаны совпадать с `:root` в `src/app/globals.css`.
 * Меняете палитру там — поправьте и здесь.
 */

export const CHART = {
  ink:        '#232A24',
  sub:        '#5C6659',
  tertiary:   '#8A9382',
  border:     '#DFE4D6',
  borderSoft: '#EAEEE2',
  surface:    '#FBFBF8',

  accent:  '#4B6B46',
  good:    '#3D6238',
  warn:    '#7A6B3F',
  danger:  '#A24B30',
  info:    '#41546B',
} as const

/**
 * Ряд для категориальных серий (доли в круговой диаграмме, цвет статьи
 * в бухгалтерии). Порядок подобран так, чтобы соседние доли различались
 * по светлоте, а не только по тону — читается и на монохромной печати.
 */
export const CHART_SERIES = [
  CHART.accent,   // мховый
  CHART.warn,     // охра
  CHART.info,     // грифельно-синий
  CHART.danger,   // терракота
  CHART.tertiary, // светлый шалфей
  CHART.sub,      // глубокий шалфей
  '#6E8A5F',      // светлее акцента
  '#9AA88C',      // самый светлый в ряду
] as const

/** Общие пропсы осей/сетки/тултипа — чтобы не повторять их в каждом графике. */
export const CHART_AXIS_TICK = { fontSize: 11, fill: CHART.tertiary } as const
export const CHART_GRID_STROKE = CHART.borderSoft
export const CHART_TOOLTIP_STYLE = {
  borderRadius: 0,
  border: `1px solid ${CHART.border}`,
  background: CHART.surface,
  fontSize: 12,
} as const
export const CHART_TOOLTIP_LABEL_STYLE = {
  fontWeight: 600,
  color: CHART.ink,
  marginBottom: 4,
} as const
