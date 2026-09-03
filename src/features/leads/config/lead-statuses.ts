/**
 * Статусы лида — единый источник для канбана, реестра, карточки, фильтров и
 * серверной валидации.
 *
 * До 02.09.2026 словарь был скопирован в шести местах и разъехался по составу
 * ключей: список и фильтры знали несуществующий `in_work` (его не пишет ни один
 * экшен), а на доске не было колонок под `interested` и `rejected` — лид с таким
 * статусом не попадал ни в одну колонку и просто исчезал с канбана. Статус
 * `interested` при этом ставится автоматически по результату показа
 * (`showings.actions.ts`).
 *
 * Порядок массива = порядок воронки слева направо на доске.
 *
 * Файл намеренно без 'use client': его импортируют и серверные страницы,
 * и клиентские компоненты (см. проверку границы client/server).
 */

/** Ключ оформления колонки в `STAGE_COLORS` (см. `lib/design/stageColors.ts`). */
type StageKey = 'blue' | 'yellow' | 'orange' | 'purple' | 'cyan' | 'gray' | 'green' | 'red'

export const LEAD_STATUSES = [
  { value: 'new',        label: 'Новый',         board: 'Новые',          stage: 'blue'   as StageKey, badge: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]' },
  { value: 'contacted',  label: 'Связались',     board: 'Связались',      stage: 'yellow' as StageKey, badge: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]' },
  { value: 'showing',    label: 'Показ',         board: 'Показ',          stage: 'orange' as StageKey, badge: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]' },
  { value: 'searching',  label: 'Подбор',        board: 'Подбор',         stage: 'purple' as StageKey, badge: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]' },
  { value: 'interested', label: 'Заинтересован', board: 'Заинтересованы', stage: 'cyan'   as StageKey, badge: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]' },
  { value: 'converted',  label: 'Конвертирован', board: 'Клиенты',        stage: 'green'  as StageKey, badge: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]' },
  { value: 'closed',     label: 'Закрыт',        board: 'Закрыты',        stage: 'gray'   as StageKey, badge: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]' },
  { value: 'rejected',   label: 'Отказ',         board: 'Отказ',          stage: 'red'    as StageKey, badge: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]' },
] as const

/** Допустимые значения `leads.status` — ими же валидируется вход в экшене. */
export const LEAD_STATUS_VALUES: string[] = LEAD_STATUSES.map(s => s.value)

export const LEAD_STATUS_LABELS: Record<string, string> =
  Object.fromEntries(LEAD_STATUSES.map(s => [s.value, s.label]))

/** Классы бейджа `bg-*-tint text-*` — без рамки, её каждый экран ставит сам. */
export const LEAD_STATUS_BADGE: Record<string, string> =
  Object.fromEntries(LEAD_STATUSES.map(s => [s.value, s.badge]))

/**
 * «В работе» = лид уже не новый, но ещё не закрыт ни в какую сторону.
 * Раньше эту плашку считали по `status === 'in_work'`, которого нет в природе,
 * и она всегда показывала 0.
 */
export const LEAD_STATUSES_IN_WORK: string[] = ['contacted', 'showing', 'searching', 'interested']

/** Терминальные статусы: из них лид уже никуда не двигают, конвертировать нечего. */
export const LEAD_STATUSES_TERMINAL: string[] = ['converted', 'closed', 'rejected']

/**
 * Порядок продвижения лида «на шаг вперёд» — то, что предлагает кнопка
 * «следующий статус» в Telegram-боте.
 *
 * Из воронки исключены `closed` и `rejected`: это не следующий шаг, а решение
 * человека, и ставить их автоматически нельзя. `converted` — финиш воронки.
 *
 * Живёт здесь, а не в боте: до 04.09.2026 у бота была своя копия с лишним
 * статусом `meeting` и перепутанным порядком. `meeting` не проходит
 * CHECK-ограничение, поэтому кнопка «следующий статус» для лида в статусе
 * «Связались» просто отвечала отказом — ровно то расхождение словарей,
 * что разбиралось в #28.
 */
export const LEAD_PIPELINE: string[] = LEAD_STATUSES
  .map(s => s.value)
  .filter(v => v !== 'closed' && v !== 'rejected')
