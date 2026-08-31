/**
 * Оформление канбан-колонок (leads/tasks). Раньше у каждой доски был свой
 * независимый набор Tailwind-классов, и колонки красились в шесть разных
 * палитр (blue/yellow/orange/purple/cyan/green) — доска пестрила без пользы.
 *
 * В системе «Кабинет» этап читается по позиции колонки слева направо, а не
 * по цвету: единственный акцент в системе один, а цвет несёт только семантику
 * статуса. Поэтому колонки нейтральные, и лишь завершение/отмена получают
 * смысловой бейдж (`good` / `danger`).
 *
 * Ключи оставлены прежними (blue, yellow, …), чтобы не переписывать вызовы на
 * трёх досках: это теперь просто имена позиций, а не названия цветов.
 */

const NEUTRAL = { color: 'border-t-[var(--hp-border)]', badge: 'hp-badge hp-badge-neutral' } as const

export const STAGE_COLORS = {
  blue:   NEUTRAL,
  yellow: NEUTRAL,
  orange: NEUTRAL,
  purple: NEUTRAL,
  cyan:   NEUTRAL,
  gray:   NEUTRAL,
  green:  { color: 'border-t-[var(--hp-good)]',   badge: 'hp-badge hp-badge-good' },
  red:    { color: 'border-t-[var(--hp-danger)]', badge: 'hp-badge hp-badge-danger' },
} as const

export type StageColorKey = keyof typeof STAGE_COLORS
