/**
 * Разбор пользовательского ввода в Telegram-боте.
 *
 * Вынесено из роута отдельно и без единого обращения к сети и базе: это
 * единственная часть подсистемы, которую можно проверить тестом честно, а
 * именно здесь и живут ошибки формата («не разобрал день», «не та рубрика»).
 * До 04.09.2026 на 3 749 строк телеграм-подсистемы не было ни одного теста.
 *
 * Каждая функция возвращает либо разобранное значение, либо `error` с готовым
 * текстом для пользователя — чтобы формулировка отказа не расползлась по
 * обработчикам.
 *
 * Файл без 'use client'.
 */

/**
 * Дни недели по началу слова.
 *
 * Раньше принимались только точные «пн»…«вс», и живой ввод отвергался: «вск»,
 * «воскресенье», «воскресеньк» с опечаткой — всё это одинаково получало
 * «не разобрал формат». Сравнение по началу слова покрывает и сокращения, и
 * полные названия, и хвостовые опечатки.
 *
 * Основы не короче двух букв и не пересекаются: «в» и «с» сами по себе
 * неоднозначны (вторник/воскресенье, среда/суббота).
 */
const DAY_STEMS: Array<[string[], string]> = [
  [['пн', 'пон', 'mon'], 'mon'],
  [['вт', 'вто', 'tue'], 'tue'],
  [['ср', 'сре', 'wed'], 'wed'],
  [['чт', 'чет', 'thu'], 'thu'],
  [['пт', 'пят', 'fri'], 'fri'],
  [['сб', 'суб', 'sat'], 'sat'],
  [['вс', 'вск', 'вос', 'sun'], 'sun'],
]

/** `воскресенье` → `sun`. Возвращает null, если день не узнан. */
export function parseDay(raw: string): string | null {
  const word = raw.trim().toLowerCase().replace(/[^a-zа-яё]/g, '')
  if (word.length < 2) return null
  for (const [stems, key] of DAY_STEMS) {
    if (stems.some(stem => word.startsWith(stem))) return key
  }
  return null
}

/** День недели по-русски — для подтверждений и списков. */
export const DAY_RU: Record<string, string> = {
  mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс',
}

/**
 * Сравнение названий рубрик: без эмодзи, регистра и знаков.
 * `📊 Аналитика` и `аналитика` — одно и то же.
 */
function normalizeRubric(value: string): string {
  return value.toLowerCase().replace(/[^a-zа-яё0-9]/g, '')
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/** `nav:crm_leads` → `{ action: 'nav', arg: 'crm_leads' }`. */
export function parseCallbackData(data: string | undefined): { action: string; arg: string } | null {
  if (!data) return null
  const idx = data.indexOf(':')
  if (idx <= 0) return null
  const action = data.slice(0, idx)
  const arg = data.slice(idx + 1)
  if (!arg) return null
  return { action, arg }
}

/**
 * Кого добавить в допущенные: пересланное сообщение или «<id> [подпись]».
 *
 * Пересылка надёжнее ручного ввода — Telegram сам сообщает id, ошибиться
 * цифрой нельзя.
 */
export function parseAddUserInput(
  text: string,
  forwardFromId?: number,
  forwardFromName?: string,
): Parsed<{ telegramUserId: string; label?: string }> {
  if (forwardFromId) {
    return { ok: true, value: { telegramUserId: String(forwardFromId), label: forwardFromName } }
  }
  const match = text.trim().match(/^(\d+)\s*(.*)$/)
  if (!match) {
    return {
      ok: false,
      error: '⚠️ Не распознал ID. Перешли сообщение от человека или пришли его числовой Telegram ID.',
    }
  }
  return { ok: true, value: { telegramUserId: match[1], label: match[2]?.trim() || undefined } }
}

export interface RubricRef {
  key: string
  label: string
}

/**
 * Слот расписания: «пн 08:00 cta», «воскресенье 19:00 Аналитика».
 *
 * Рубрика берётся как весь остаток строки и узнаётся по ключу ИЛИ по названию:
 * человек читает в меню «📊 Аналитика» и пишет «аналитика», а не `analytics`.
 *
 * Ошибка называет, что именно не разобрано. Раньше на любую причину — не тот
 * день, не то время, неизвестная рубрика — отвечало одно и то же «не разобрал
 * формат», и человек перебирал варианты вслепую.
 */
export function parseScheduleSlot(
  text: string,
  rubrics: readonly RubricRef[],
): Parsed<{ dayKey: string; dayLabel: string; time: string; rubricKey: string }> {
  const rubricList = rubrics.map(r => `${r.key} (${r.label})`).join(', ')
  const howToAdd = rubrics.length
    ? `\nДоступные рубрики: ${rubricList}.\nНужной нет — заведи её кнопкой «➕ Новая рубрика».`
    : '\nРубрик пока нет — сначала заведи рубрику кнопкой «➕ Новая рубрика».'

  const match = text.trim().match(/^(\S+)\s+(\d{1,2}:\d{2})\s+(.+)$/)
  if (!match) {
    return {
      ok: false,
      error:
        '⚠️ Жду три части: день, время и рубрику одной строкой.\n' +
        'Например: <code>вс 19:00 cta</code>',
    }
  }
  const [, dayRaw, timeRaw, rubricRaw] = match

  const dayKey = parseDay(dayRaw)
  if (!dayKey) {
    return {
      ok: false,
      error: `⚠️ Не узнал день «${dayRaw}». Можно так: пн, вт, ср, чт, пт, сб, вс — или полным словом.`,
    }
  }

  const [hh, mm] = timeRaw.split(':').map(Number)
  if (hh > 23 || mm > 59) {
    return { ok: false, error: `⚠️ Времени «${timeRaw}» не бывает. Часы 00–23, минуты 00–59.` }
  }
  const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`

  const wanted = normalizeRubric(rubricRaw)
  const rubric = rubrics.find(
    r => normalizeRubric(r.key) === wanted || normalizeRubric(r.label) === wanted,
  )
  if (!rubric) {
    return { ok: false, error: `⚠️ Не знаю рубрику «${rubricRaw.trim()}».${howToAdd}` }
  }

  return { ok: true, value: { dayKey, dayLabel: DAY_RU[dayKey], time, rubricKey: rubric.key } }
}

/** Новая рубрика: «key | Название | текст промпта». */
export function parseRubricInput(text: string): Parsed<{ key: string; label: string; prompt: string }> {
  const parts = text.split('|').map(p => p.trim())
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return { ok: false, error: '⚠️ Формат: <code>key | Название | текст промпта</code>' }
  }
  const [key, label, prompt] = parts
  if (!/^[a-z0-9_]+$/.test(key)) {
    return { ok: false, error: '⚠️ key — латиницей в нижнем регистре, без пробелов (например: listing).' }
  }
  return { ok: true, value: { key, label, prompt } }
}

/**
 * Ответ на черновик, начинающийся с «фото:» — пожелание к картинке, а не
 * замена текста поста.
 */
export function parseImageNote(text: string): string | null {
  const match = text.match(/^(?:фото|картинка|изображение)\s*:\s*([\s\S]+)/i)
  return match ? match[1].trim() : null
}

/** Стиль картинки рубрики: «-» и пустая строка означают «сбросить на общий». */
export function parseImageStyle(text: string): string | null {
  const trimmed = text.trim()
  return trimmed === '-' || trimmed === '' ? null : trimmed
}

/**
 * Часовой пояс организации из живого ввода.
 *
 * Принимаем и IANA-имя (`Europe/Moscow`), и привычное «UTC+7» / «+7»: в чате
 * человек пишет смещение, а не идентификатор базы tz. Смещение переводится в
 * `Etc/GMT∓N` — там знак намеренно обратный (POSIX), и именно на этом легко
 * ошибиться руками: Etc/GMT-7 это UTC+7.
 */
export function parseTimezone(raw: string): Parsed<string> {
  const text = raw.trim()
  if (!text) return { ok: false, error: 'Пустой ввод. Напиши, например: <code>Europe/Moscow</code> или <code>UTC+7</code>' }

  const offset = text.match(/^(?:utc|gmt|мск|msk)?\s*([+-])\s*(\d{1,2})$/i)
  if (offset) {
    const hours = Number(offset[2])
    if (hours > 14) return { ok: false, error: `Смещение UTC${offset[1]}${hours} не существует.` }
    // POSIX-знак в Etc/GMT обратный: UTC+7 → Etc/GMT-7.
    const zone = `Etc/GMT${offset[1] === '+' ? '-' : '+'}${hours}`
    return { ok: true, value: zone }
  }

  try {
    new Intl.DateTimeFormat('ru-RU', { timeZone: text })
    return { ok: true, value: text }
  } catch {
    return {
      ok: false,
      error:
        `Не знаю такого часового пояса: «${text}». Напиши смещение (<code>UTC+7</code>) ` +
        'или имя зоны (<code>Europe/Moscow</code>, <code>Asia/Krasnoyarsk</code>).',
    }
  }
}

/**
 * Значение для `ilike` внутри `.or(...)` PostgREST.
 *
 * Условия в `or=` разделяются запятыми, поэтому поисковый запрос вроде
 * «Ленина, 10» без кавычек разъезжается на два битых условия и запрос падает —
 * а адрес с запятой человек пишет первым делом. Значение в двойных кавычках
 * запятую переживает; сами кавычки и обратные слэши из ввода убираем, внутри
 * закавыченной строки они и ломают разбор.
 */
export function likeFilterValue(raw: string): string {
  return `"%${raw.replace(/["\\]/g, ' ').trim()}%"`
}
