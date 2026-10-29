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
    return uniqueViolationMessage(`${error.message ?? ''} ${error.details ?? ''}`)
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

/**
 * Нарушение уникальности — текст по имени ограничения. Раньше любая 23505
 * объяснялась как «проверьте телефон или email … дубли контактов», хотя у
 * контактов уникальности нет вовсе; второй договор того же типа по сделке
 * показывал именно эту фразу (QA 28.10.2026, A-02).
 */
const UNIQUE_MESSAGES: Array<[RegExp, string]> = [
  [/contracts_deal_type_uniq/, 'По этой сделке уже есть договор такого типа. Откройте его в блоке «Договоры» сделки — или выберите другой тип договора.'],
  [/contracts_contract_number_key/, 'Договор с таким номером уже есть — укажите другой номер или оставьте поле пустым, номер присвоится сам.'],
  [/idx_deals_number/, 'Сделка с таким номером уже есть. Обновите страницу и сохраните ещё раз.'],
  [/idx_management_engagements_active_property/, 'Этот объект уже в управлении — открыть его можно в разделе «Объекты в управлении».'],
  [/idx_property_handovers_engagement/, 'Акт приёма по этому объекту уже составлен — откройте его в карточке управления.'],
  [/idx_portal_access_unique/, 'У этого контакта уже есть доступ в личный кабинет по этому объекту.'],
  [/idx_service_plans_code/, 'Тариф с таким кодом уже есть — укажите другой код.'],
  [/idx_knowledge_articles_slug/, 'Статья с таким адресом уже есть — измените заголовок или адрес статьи.'],
  [/idx_accounting_categories_code|accounting_categories/, 'Такая категория уже есть.'],
  [/users_email_key/, 'Сотрудник с таким email уже есть.'],
  [/employee_targets/, 'План на этот месяц для сотрудника уже задан — измените существующий.'],
]

export function uniqueViolationMessage(raw: string): string {
  for (const [re, text] of UNIQUE_MESSAGES) if (re.test(raw)) return text
  return 'Такая запись уже есть. Найдите её через поиск и измените существующую.'
}
