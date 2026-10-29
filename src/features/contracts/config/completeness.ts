/**
 * Проверка полноты договора — ОДНА для формы договора и для мастера «Оформить».
 *
 * До 29.10.2026 правила расходились: форма не требовала ничего (сохранялся
 * договор без сторон, объекта, сумм и дат — QA B-01), «Оформить» требовал
 * только дату начала; залог 0 форма отклоняла, а «Оформить» принимал (A-11);
 * дата окончания раньше начала проходила везде (B-04).
 *
 * Файл без 'use client': его вызывают server actions и юнит-тесты.
 */
import { defaultEndDate, requiredForContract } from '@/features/deals/services/deal-completion'
import { getContractTypeConfig } from './contract-types'
import { todayIso } from '@/lib/timezone'

export interface ContractCompletenessInput {
  contract_type: string
  owner_contact_id?: string | null
  client_contact_id?: string | null
  property_id?: string | null
  amount?: number | null
  deposit?: number | null
  start_date?: string | null
  end_date?: string | null
}

/** Ошибка с именем поля — форма подсветит его и прокрутит к нему. */
export interface ContractFieldError { field: keyof ContractCompletenessInput; message: string }

/**
 * Возвращает первую проблему или null. Сообщение называет поле человеческим
 * языком и говорит, что сделать (правило 6 интерфейса CRM).
 */
export function checkContractCompleteness(c: ContractCompletenessInput): ContractFieldError | null {
  const config = getContractTypeConfig(c.contract_type)
  const need = requiredForContract(c.contract_type)

  // Стороны: в форме «собственник» — owner_contact_id, «клиент» — client_contact_id.
  // У агентского с собственником вторая сторона — собственник, у агентского с
  // клиентом — клиент; агентство подставляется из профиля компании.
  if (need.owner && !c.owner_contact_id) {
    const label = config?.party2Role === 'owner' ? config.party2Label : config?.party1Label ?? 'Собственник'
    return { field: 'owner_contact_id', message: `Выберите сторону договора: ${label.toLowerCase()}` }
  }
  if (need.client && !c.client_contact_id) {
    return { field: 'client_contact_id', message: `Выберите сторону договора: ${(config?.party2Label ?? 'клиент').toLowerCase()}` }
  }
  if (need.property && !c.property_id) {
    return { field: 'property_id', message: 'Выберите объект договора' }
  }
  // У договора управления при процентной схеме вознаграждение считается от
  // поступившей аренды — фиксированной суммы в договоре может не быть.
  const amountOptional = c.contract_type === 'property_management'
  if ((c.amount === null || c.amount === undefined) && !amountOptional) {
    return { field: 'amount', message: `Укажите сумму: ${(config?.amountLabel ?? 'сумма').replace(/\s*\(₽\)\s*/, '').toLowerCase()}` }
  }
  if (c.amount !== null && c.amount !== undefined && c.amount <= 0) {
    return { field: 'amount', message: 'Сумма договора должна быть больше нуля' }
  }
  // Залог необязателен и может быть 0 — «без залога» это нормальное условие.
  if (c.deposit !== null && c.deposit !== undefined && c.deposit < 0) {
    return { field: 'deposit', message: 'Залог не может быть отрицательным — оставьте 0, если залога нет' }
  }
  if (!c.start_date) {
    return { field: 'start_date', message: `Укажите дату: ${(config?.startDateLabel ?? 'дата начала').toLowerCase()}` }
  }
  if (config?.dateMode === 'range' && !c.end_date) {
    return { field: 'end_date', message: `Укажите дату: ${(config.endDateLabel ?? 'дата окончания').toLowerCase()}` }
  }
  if (c.end_date && c.end_date < c.start_date) {
    return { field: 'end_date', message: 'Дата окончания раньше даты начала — проверьте даты' }
  }
  return null
}

/** Даты по умолчанию для нового договора — те же, что в «Оформить» (`defaultEndDate`). */
export function defaultContractDates(contractType: string, today: string = todayIso()): { start_date: string; end_date: string | null } {
  return { start_date: today, end_date: defaultEndDate(today, contractType) }
}
