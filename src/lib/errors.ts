/**
 * Ошибки базы данных — человеческим языком.
 *
 * Server Actions по всему проекту возвращали `{ error: error.message }`, и
 * сотрудник видел на экране `duplicate key value violates unique constraint
 * "contacts_phone_key"` — текст Postgres на английском, без ответа на вопрос
 * «что случилось и что делать». Здесь коды Postgres переводятся в понятную
 * фразу; исходный текст уходит в консоль сервера (и в Sentry), а не на экран.
 *
 * Файл без 'use client' — используется только из экшенов и серверного кода.
 */

interface DbErrorLike {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

/** Что делали с записью — подставляется в текст: «Не получилось сохранить сделку». */
export type DbErrorContext = {
  /** «сделку», «контакт», «задачу» — в винительном падеже */
  entity?: string
  /** «сохранить» (по умолчанию), «удалить», «загрузить» */
  verb?: 'сохранить' | 'удалить' | 'загрузить' | 'изменить'
}

const FALLBACK_SUPPORT = 'Попробуйте ещё раз. Если повторится — напишите в поддержку.'

/**
 * Возвращает строку для показа сотруднику. Всегда непустая.
 *
 *   const { error } = await supabase.from('deals').insert(...)
 *   if (error) return { error: friendlyDbError(error, { entity: 'сделку' }) }
 */
export function friendlyDbError(error: DbErrorLike | null | undefined, ctx: DbErrorContext = {}): string {
  const verb = ctx.verb ?? 'сохранить'
  const what = ctx.entity ? ` ${ctx.entity}` : ''
  const base = `Не получилось ${verb}${what}.`

  if (!error) return `${base} ${FALLBACK_SUPPORT}`

  // Исходный текст — в лог, не пользователю.
  console.error('[db]', error.code ?? '-', error.message ?? '', error.details ?? '', error.hint ?? '')

  const code = error.code ?? ''
  const msg = (error.message ?? '').toLowerCase()

  // unique_violation
  if (code === '23505' || msg.includes('duplicate key')) {
    return 'Такая запись уже есть — проверьте телефон или email. Дубли объединяются в разделе «Контакты → Дубли».'
  }
  // foreign_key_violation
  if (code === '23503' || msg.includes('foreign key')) {
    return verb === 'удалить'
      ? `Нельзя удалить${what}: с ней связаны другие записи (договоры, задачи или платежи). Сначала отвяжите или удалите их.`
      : `${base} Связанная запись (объект, контакт или договор) не найдена — возможно, её удалили. Обновите страницу и выберите заново.`
  }
  // not_null_violation
  if (code === '23502' || msg.includes('null value in column')) {
    return `${base} Не заполнено обязательное поле.`
  }
  // check_violation
  if (code === '23514' || msg.includes('check constraint')) {
    return `${base} Одно из значений не подходит — проверьте выбранные статусы и суммы.`
  }
  // RLS / права
  if (code === '42501' || msg.includes('row-level security') || msg.includes('permission denied')) {
    return 'Нет доступа к этой записи в вашей организации.'
  }
  // PostgREST: строка не найдена / несколько строк
  if (code === 'PGRST116') {
    return 'Запись не найдена — возможно, её уже удалили.'
  }
  // Сеть / таймаут
  if (code === '57014' || msg.includes('timeout') || msg.includes('fetch failed')) {
    return `${base} Сервер не ответил вовремя. ${FALLBACK_SUPPORT}`
  }

  return `${base} ${FALLBACK_SUPPORT}`
}
