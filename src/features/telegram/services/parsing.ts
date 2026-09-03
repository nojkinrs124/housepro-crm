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

/** Дни недели так, как их пишет человек, и так, как они лежат в базе. */
export const DAY_ALIASES: Record<string, string> = {
  пн: 'mon', вт: 'tue', ср: 'wed', чт: 'thu', пт: 'fri', сб: 'sat', вс: 'sun',
  mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri', sat: 'sat', sun: 'sun',
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

/** Слот расписания: «пн 08:00 cta». */
export function parseScheduleSlot(
  text: string,
  knownRubricKeys: readonly string[],
): Parsed<{ dayKey: string; dayRaw: string; time: string; rubricKey: string }> {
  const match = text.trim().toLowerCase().match(/^(\S+)\s+(\d{1,2}:\d{2})\s+(\S+)$/)
  if (!match) {
    return { ok: false, error: '⚠️ Не разобрал формат. Пример: <code>пн 08:00 cta</code>' }
  }
  const [, dayRaw, time, rubricKey] = match

  const dayKey = DAY_ALIASES[dayRaw]
  if (!dayKey) {
    return { ok: false, error: '⚠️ Не узнал день. Используй: пн вт ср чт пт сб вс.' }
  }

  const [hh, mm] = time.split(':').map(Number)
  if (hh > 23 || mm > 59) {
    return { ok: false, error: '⚠️ Такого времени не бывает. Часы 00–23, минуты 00–59.' }
  }

  if (!knownRubricKeys.includes(rubricKey)) {
    return {
      ok: false,
      error: `⚠️ Не знаю рубрику «${rubricKey}». Доступные: ${knownRubricKeys.join(', ')}`,
    }
  }

  return { ok: true, value: { dayKey, dayRaw, time: time.padStart(5, '0'), rubricKey } }
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
