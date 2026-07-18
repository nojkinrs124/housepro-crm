'use server'

import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ContractVariables {
  // ── Арендодатель (Сторона 1) ──────────────────────────────
  ФИО_АРЕНДОДАТЕЛЯ: string
  СЕРИЯ_НОМЕР_ПАСПОРТА_АРЕНДОДАТЕЛЯ: string
  ОРГАН_ВЫДАЧИ_ПАСПОРТА_АРЕНДОДАТЕЛЯ: string
  АДРЕС_РЕГИСТРАЦИИ_АРЕНДОДАТЕЛЯ: string
  ТЕЛЕФОН_АРЕНДОДАТЕЛЯ: string
  НАЗВАНИЕ_ОРГАНИЗАЦИИ_АРЕНДОДАТЕЛЯ: string
  ИНН_АРЕНДОДАТЕЛЯ: string
  КПП_АРЕНДОДАТЕЛЯ: string
  ОГРН_АРЕНДОДАТЕЛЯ: string
  ЮР_АДРЕС_АРЕНДОДАТЕЛЯ: string
  ФИО_ПРЕДСТАВИТЕЛЯ_АРЕНДОДАТЕЛЯ: string
  ДОЛЖНОСТЬ_ПРЕДСТАВИТЕЛЯ_АРЕНДОДАТЕЛЯ: string
  ОСНОВАНИЕ_ПРЕДСТАВИТЕЛЯ_АРЕНДОДАТЕЛЯ: string

  // ── Арендатор (Сторона 2) ─────────────────────────────────
  ФИО_АРЕНДАТОРА: string
  СЕРИЯ_НОМЕР_ПАСПОРТА_АРЕНДАТОРА: string
  ОРГАН_ВЫДАЧИ_ПАСПОРТА_АРЕНДАТОРА: string
  АДРЕС_РЕГИСТРАЦИИ_АРЕНДАТОРА: string
  ТЕЛЕФОН_АРЕНДАТОРА: string
  НАЗВАНИЕ_ОРГАНИЗАЦИИ_АРЕНДАТОРА: string
  ИНН_АРЕНДАТОРА: string
  КПП_АРЕНДАТОРА: string
  ОГРН_АРЕНДАТОРА: string
  ЮР_АДРЕС_АРЕНДАТОРА: string
  ФИО_ПРЕДСТАВИТЕЛЯ_АРЕНДАТОРА: string
  ДОЛЖНОСТЬ_ПРЕДСТАВИТЕЛЯ_АРЕНДАТОРА: string
  ОСНОВАНИЕ_ПРЕДСТАВИТЕЛЯ_АРЕНДАТОРА: string

  // ── Объект ────────────────────────────────────────────────
  АДРЕС_ЖИЛОГО_ПОМЕЩЕНИЯ: string
  ПЛОЩАДЬ: string
  ДОКУМЕНТ_ПРАВА_СОБСТВЕННОСТИ: string

  // ── Проживающие ───────────────────────────────────────────
  'ФИО_И_ПАСПОРТ_ПРОЖИВАЮЩИХ': string
  'КОЛ-ВО_ДЕТЕЙ': string

  // ── Животные ──────────────────────────────────────────────
  'ЖИВОТНЫЕ_ЗАПРЕЩ_РАЗРЕШ': string
  ЖИВОТНЫЕ_ВИД: string
  'ЖИВОТНЫЕ_КОЛ-ВО': string

  // ── Сроки ─────────────────────────────────────────────────
  'КОЛ-ВО_МЕСЯЦЕВ': string
  ДЕНЬ_НАЧАЛА: string
  МЕСЯЦ_НАЧАЛА: string
  ГОД_НАЧАЛА: string
  СРОК_УВЕДОМЛЕНИЯ_О_НЕПРОДЛЕНИИ: string
  СРОК_УВЕДОМЛЕНИЯ_О_РАСТОРЖЕНИИ: string
  НЕУСТОЙКА_ЗА_ДЕНЬ: string
  СРОК_УВЕДОМЛЕНИЯ_О_ПРОВЕРКЕ: string

  // ── Финансы ───────────────────────────────────────────────
  РАЗМЕР_АРЕНДНОЙ_ПЛАТЫ: string
  'ВХОДИТ_ИЛИ_НЕ_ВХОДИТ': string
  ПЕРЕЧЕНЬ_КОММУНАЛЬНЫХ_УСЛУГ: string
  'КТО_ОПЛАЧИВАЕТ_ИНТЕРНЕТ_КОНСЬЕРЖ': string
  РАЗМЕР_ОБЕСПЕЧИТЕЛЬНОГО_ПЛАТЕЖА: string

  // ── Дата договора ─────────────────────────────────────────
  ДЕНЬ: string
  МЕСЯЦ: string
  ГОД: string
  'КОЛ-ВО_ЭКЗЕМПЛЯРОВ': string

  // ── Акт передачи (Приложение №1) ─────────────────────────
  ДЕНЬ_ДОГОВОРА: string
  МЕСЯЦ_ДОГОВОРА: string
  ГОД_ДОГОВОРА: string
  ДЕНЬ_АКТА: string
  МЕСЯЦ_АКТА: string
  ГОД_АКТА: string
  'КОЛ-ВО_КЛЮЧЕЙ': string
  'СЧЕТЧИК_ЭЛК-ВО': string
  СЧЕТЧИК_ГВС: string
  СЧЕТЧИК_ХВС: string
  ОПИСЬ_ИМУЩЕСТВА: string

  // ── Акт возврата (Приложение №2) ──────────────────────────
  ДЕНЬ_ВОЗВРАТА: string
  МЕСЯЦ_ВОЗВРАТА: string
  ГОД_ВОЗВРАТА: string
  'КОЛ-ВО_КЛЮЧЕЙ_ВОЗВРАТ': string
  ПРЕТЕНЗИИ_ПРИ_ВОЗВРАТЕ: string

  // ── Исполнитель (Агентство, для агентских/субаренды/управления) ──
  ИСПОЛНИТЕЛЬ_НАЗВАНИЕ: string
  ИСПОЛНИТЕЛЬ_ФОРМА: string
  ИСПОЛНИТЕЛЬ_ИНН: string
  ИСПОЛНИТЕЛЬ_ОГРН: string
  ИСПОЛНИТЕЛЬ_КПП: string
  ИСПОЛНИТЕЛЬ_АДРЕС: string
  ИСПОЛНИТЕЛЬ_БАНК: string
  ИСПОЛНИТЕЛЬ_РАСЧЕТНЫЙ_СЧЕТ: string
  ИСПОЛНИТЕЛЬ_КОРР_СЧЕТ: string
  ИСПОЛНИТЕЛЬ_БИК: string
  ИСПОЛНИТЕЛЬ_ТЕЛЕФОН: string
  ИСПОЛНИТЕЛЬ_ПОДПИСАНТ: string
  ИСПОЛНИТЕЛЬ_ДОЛЖНОСТЬ: string
  ИСПОЛНИТЕЛЬ_ОСНОВАНИЕ: string
  ИСПОЛНИТЕЛЬ_ПАСПОРТ: string
  ИСПОЛНИТЕЛЬ_ПАСПОРТ_ВЫДАН: string

  // ── Договор-основание (для субаренды) ──
  ОСНОВАНИЕ_НОМЕР_ДОГОВОРА: string
  ОСНОВАНИЕ_ДАТА_ДОГОВОРА: string

  // ── Агентские услуги (agency_owner / agency_client / agency_legal_entity) ──
  ПЕРЕЧЕНЬ_УСЛУГ: string
  УСЛУГА_ДРУГОЕ: string
  МОДЕЛЬ_ВОЗНАГРАЖДЕНИЯ: string
  ПРОЦЕНТ_ВОЗНАГРАЖДЕНИЯ: string
  УСЛОВИЯ_ОПЛАТЫ: string

  // ── Аренда коммерческой недвижимости ──
  НАЗНАЧЕНИЕ_ИСПОЛЬЗОВАНИЯ: string
  НДС_ВКЛЮЧЕН: string
  КТО_ДЕЛАЕТ_РЕМОНТ: string

  // ── Купля-продажа ──
  СПОСОБ_ОПЛАТЫ: string
  РАСХОДЫ_НА_РЕГИСТРАЦИЮ_НЕСЕТ: string
  ОБРЕМЕНЕНИЯ: string
  ЗАРЕГИСТРИРОВАННЫЕ_ЛИЦА: string
  ПОРЯДОК_ПЕРЕДАЧИ_КЛЮЧЕЙ: string
  АВАНС: string

  // ── Управление недвижимостью ──
  ПЕРЕЧЕНЬ_УСЛУГ_УПРАВЛЕНИЯ: string
  УСЛУГА_УПРАВЛЕНИЯ_ДРУГОЕ: string
  ПЕРИОДИЧНОСТЬ_ОТЧЕТА: string

  // ── Субаренда ──
  СОГЛАСИЕ_СОБСТВЕННИКА: string
  ДОКУМЕНТ_СОГЛАСИЯ_СОБСТВЕННИКА: string

  // ── Обратная совместимость (старые шаблоны) ───────────────
  CLIENT_NAME: string
  CLIENT_PHONE: string
  CLIENT_PASSPORT: string
  CLIENT_ADDRESS: string
  PARTY2_NAME: string
  PARTY2_PHONE: string
  PARTY2_PASSPORT: string
  PROPERTY_ADDRESS: string
  PROPERTY_TITLE: string
  PROPERTY_AREA: string
  PROPERTY_FLOOR: string
  PROPERTY_ROOMS: string
  CONTRACT_NUMBER: string
  CONTRACT_DATE: string
  CONTRACT_TYPE: string
  START_DATE: string
  END_DATE: string
  PRICE: string
  PRICE_WORDS: string
  DEPOSIT: string
  DEPOSIT_WORDS: string
  AGENCY_NAME: string
  MANAGER_NAME: string
  DATE_DAY: string
  DATE_MONTH: string
  DATE_YEAR: string
  CITY: string
}

// Числа прописью
function numberToWords(n: number): string {
  const units = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять',
    'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
    'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']

  if (n === 0) return 'ноль'
  if (n < 0) return 'минус ' + numberToWords(-n)

  let result = ''
  const th = Math.floor(n / 1000)
  const rem = n % 1000

  if (th > 0) {
    const thWords = ['одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
    if (th <= 9) result += thWords[th - 1] + ' '
    result += th === 1 ? 'тысяча ' : th < 5 ? 'тысячи ' : 'тысяч '
  }

  if (rem > 0) {
    const h = Math.floor(rem / 100)
    const t = Math.floor((rem % 100) / 10)
    const u = rem % 10
    if (h > 0) result += hundreds[h] + ' '
    if (t === 1) {
      result += units[10 + u] + ' '
    } else {
      if (t > 0) result += tens[t] + ' '
      if (u > 0) result += units[u] + ' '
    }
  }

  return result.trim() + ' рублей'
}

// Формат даты на русском
function formatDateRu(dateStr: string) {
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  const d = new Date(dateStr)
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: months[d.getMonth()],
    year: String(d.getFullYear()),
    full: `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} г.`,
  }
}

// Собрать паспортные данные контакта в строку "серия номер"
function buildPassport(contact: Record<string, string> | null): string {
  if (!contact) return '_______________'
  // Если есть структурированные поля
  if (contact.passport_series && contact.passport_number) {
    return `${contact.passport_series} ${contact.passport_number}`
  }
  // Иначе legacy поле passport
  return contact.passport || '_______________'
}

// Адрес регистрации контакта
function buildAddress(contact: Record<string, string> | null): string {
  if (!contact) return '_______________'
  const parts = [contact.region, contact.city, contact.street, contact.house_number, contact.apartment]
    .filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : '_______________'
}

const agencyServiceLabels: Record<string, string> = {
  search_property: 'поиск объекта недвижимости',
  search_tenant_buyer: 'поиск арендатора/покупателя',
  showings: 'организация показов объекта',
  legal_support: 'юридическое сопровождение сделки',
  advertising: 'рекламное продвижение объекта',
  full_support: 'полное сопровождение сделки',
}

const rewardModelLabels: Record<string, string> = {
  fixed: 'фиксированная сумма',
  percent: 'процент от суммы сделки',
  fixed_percent: 'фиксированная сумма и процент от суммы сделки',
}

const paymentTermsLabels: Record<string, string> = {
  on_signing: 'в день подписания настоящего договора',
  on_completion: 'по факту оказания услуги',
  installments: 'поэтапно, согласно графику платежей',
}

const propertyManagementServiceLabels: Record<string, string> = {
  tenant_search: 'поиск арендаторов',
  rent_collection: 'сбор арендных платежей',
  maintenance: 'организация технического обслуживания объекта',
  reporting: 'предоставление отчётности собственнику',
  utility_payments: 'оплата коммунальных услуг',
  inspections: 'периодические осмотры объекта',
}

const reportFrequencyLabels: Record<string, string> = {
  weekly: 'еженедельно',
  monthly: 'ежемесячно',
  quarterly: 'ежеквартально',
}

const paymentMethodLabels: Record<string, string> = {
  cash: 'наличный расчёт',
  bank_transfer: 'безналичный банковский перевод',
  mortgage: 'с использованием ипотечных кредитных средств',
  maternal_capital: 'с использованием средств материнского (семейного) капитала',
}

const registrationExpensesPayerLabels: Record<string, string> = {
  buyer: 'Покупатель',
  seller: 'Продавец',
  both: 'Стороны в равных долях',
}

const basisLabels: Record<string, string> = {
  charter: 'Устава',
  power_of_attorney: 'Доверенности',
  other: 'иного документа',
}

// "действующего на основании Доверенности № 12 от 01.03.2026"
function buildBasis(rep: Record<string, string> | null): string {
  if (!rep) return '_______________'
  const label = basisLabels[rep.basis_type] ?? 'Устава'
  return rep.basis_details ? `${label} ${rep.basis_details}` : label
}

export async function buildContractVariables(
  contractId: string,
  injectedClient?: SupabaseClient
): Promise<ContractVariables> {
  const supabase = injectedClient ?? (await createClient())

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select(`
      *,
      client:contacts!contracts_client_contact_id_fkey(
        full_name, phone, passport, passport_series, passport_number,
        passport_issued_by, region, city, street, house_number, apartment,
        client_type, company_name, inn, kpp, ogrn, legal_address
      ),
      owner:contacts!contracts_owner_contact_id_fkey(
        full_name, phone, passport, passport_series, passport_number,
        passport_issued_by, region, city, street, house_number, apartment,
        client_type, company_name, inn, kpp, ogrn, legal_address
      ),
      owner_representative:contact_representatives!contracts_owner_representative_id_fkey(
        full_name, position, basis_type, basis_details
      ),
      client_representative:contact_representatives!contracts_client_representative_id_fkey(
        full_name, position, basis_type, basis_details
      ),
      property:properties(title, address, area, rooms, floor, ownership_basis),
      manager:users(full_name)
    `)
    .eq('id', contractId)
    .single()

  if (contractError) throw new Error(`Не удалось загрузить договор: ${contractError.message}`)
  if (!contract) throw new Error('Договор не найден')

  // base_contract — self-referencing FK (contracts.base_contract_id -> contracts.id).
  // PostgREST ненадёжно резолвит embed для self-join даже с явным hint'ом на
  // constraint — получаем отдельным запросом вместо embed (см. contracts/[id]/page.tsx).
  let baseContract: Record<string, string> | null = null
  if (contract.base_contract_id) {
    const { data } = await supabase
      .from('contracts')
      .select('contract_number, start_date, created_at')
      .eq('id', contract.base_contract_id)
      .maybeSingle()
    baseContract = data
  }

  let company: Record<string, string> | null = null
  if (contract.company_profile_id) {
    const { data } = await supabase.from('company_settings').select('*').eq('id', contract.company_profile_id).maybeSingle()
    company = data
  }
  if (!company) {
    const { data } = await supabase.from('company_settings').select('*').eq('is_default', true).maybeSingle()
    company = data
  }
  if (!company) {
    const { data } = await supabase.from('company_settings').select('*').order('created_at', { ascending: true }).limit(1).maybeSingle()
    company = data
  }

  const client = contract.client as Record<string, string> | null
  const owner = contract.owner as Record<string, string> | null
  const ownerRep = contract.owner_representative as Record<string, string> | null
  const clientRep = contract.client_representative as Record<string, string> | null
  const property = contract.property as Record<string, string | number> | null
  const manager = contract.manager as { full_name?: string } | null

  const today = formatDateRu(new Date().toISOString())
  const startDate = contract.start_date ? formatDateRu(contract.start_date) : today
  const endDate = contract.end_date ? formatDateRu(contract.end_date) : { full: '—', day: '', month: '', year: '' }

  const price = Number(contract.amount) || 0
  const deposit = Number(contract.deposit) || 0

  // Вычисляем количество месяцев между датами
  let monthsCount = '___'
  if (contract.start_date && contract.end_date) {
    const s = new Date(contract.start_date)
    const e = new Date(contract.end_date)
    const diff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
    if (diff > 0) monthsCount = String(diff)
  }

  // Поля, специфичные для найма жилого помещения — см. RentApartmentDataSchema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const td = (contract.contract_type_data ?? {}) as Record<string, any>

  const cohabitantsText = Array.isArray(td.cohabitants) && td.cohabitants.length > 0
    ? td.cohabitants.map((c: { full_name?: string; passport?: string }) =>
        `${c.full_name || '_______________'}${c.passport ? `, паспорт ${c.passport}` : ''}`).join('; ')
    : '_______________'

  const inventoryText = Array.isArray(td.inventory_items) && td.inventory_items.length > 0
    ? td.inventory_items.map((it: { name?: string; qty?: number; unit_price?: number; condition?: string }, idx: number) => {
        const parts = [it.name || '—']
        if (it.qty) parts.push(`${it.qty} шт.`)
        if (it.unit_price) parts.push(`${it.unit_price.toLocaleString('ru-RU')} ₽`)
        if (it.condition) parts.push(it.condition)
        return `${idx + 1}. ${parts.join(', ')}`
      }).join('\n')
    : '_______________'

  // ── Агентские услуги ──
  const agencyServicesText = Array.isArray(td.services) && td.services.length > 0
    ? (td.services as string[]).map(s => agencyServiceLabels[s] || s).join(', ')
    : '_______________'
  const rewardModelText = td.reward_model ? (rewardModelLabels[td.reward_model as string] || '_______________') : '_______________'
  const paymentTermsText = td.payment_terms ? (paymentTermsLabels[td.payment_terms as string] || '_______________') : '_______________'

  // ── Управление недвижимостью ──
  const managementServicesText = Array.isArray(td.services) && td.services.length > 0
    ? (td.services as string[]).map(s => propertyManagementServiceLabels[s] || s).join(', ')
    : '_______________'

  // ── Купля-продажа ──
  const advanceAmount = Number(td.advance_amount) || 0

  const handoverDate = td.handover_date ? formatDateRu(td.handover_date) : today
  const returnDate = td.return_date ? formatDateRu(td.return_date) : null

  const legalFormLabels: Record<string, string> = { individual: 'Физическое лицо', ip: 'Индивидуальный предприниматель', ooo: 'Общество с ограниченной ответственностью' }
  const companyLegalForm = company?.legal_form || 'ip'

  const executorSignatory =
    companyLegalForm === 'ooo' ? (company?.signatory_name || '_______________') : (company?.name || '_______________')
  const executorPosition =
    companyLegalForm === 'ooo' ? (company?.signatory_position || 'Генеральный директор')
      : companyLegalForm === 'ip' ? 'Индивидуальный предприниматель'
        : ''
  const executorBasis =
    companyLegalForm === 'ooo' ? (company?.signatory_basis || 'Устава')
      : companyLegalForm === 'ip' ? (company?.signatory_basis || 'Свидетельства о государственной регистрации ИП')
        : 'паспорта'
  const executorPassport =
    company?.passport_series && company?.passport_number ? `${company.passport_series} ${company.passport_number}` : '_______________'
  const executorPassportIssued = company?.passport_issued_by
    ? `${company.passport_issued_by}${company.passport_issued_date ? `, ${formatDateRu(company.passport_issued_date).full}` : ''}${company.passport_department_code ? `, код подразделения ${company.passport_department_code}` : ''}`
    : '_______________'

  return {
    // ── Арендодатель ──
    ФИО_АРЕНДОДАТЕЛЯ: owner?.full_name || '_______________',
    СЕРИЯ_НОМЕР_ПАСПОРТА_АРЕНДОДАТЕЛЯ: buildPassport(owner),
    ОРГАН_ВЫДАЧИ_ПАСПОРТА_АРЕНДОДАТЕЛЯ: owner?.passport_issued_by || '_______________',
    АДРЕС_РЕГИСТРАЦИИ_АРЕНДОДАТЕЛЯ: buildAddress(owner),
    ТЕЛЕФОН_АРЕНДОДАТЕЛЯ: owner?.phone || '_______________',
    НАЗВАНИЕ_ОРГАНИЗАЦИИ_АРЕНДОДАТЕЛЯ: owner?.company_name || '_______________',
    ИНН_АРЕНДОДАТЕЛЯ: owner?.inn || '_______________',
    КПП_АРЕНДОДАТЕЛЯ: owner?.kpp || '_______________',
    ОГРН_АРЕНДОДАТЕЛЯ: owner?.ogrn || '_______________',
    ЮР_АДРЕС_АРЕНДОДАТЕЛЯ: owner?.legal_address || '_______________',
    ФИО_ПРЕДСТАВИТЕЛЯ_АРЕНДОДАТЕЛЯ: ownerRep?.full_name || '_______________',
    ДОЛЖНОСТЬ_ПРЕДСТАВИТЕЛЯ_АРЕНДОДАТЕЛЯ: ownerRep?.position || '_______________',
    ОСНОВАНИЕ_ПРЕДСТАВИТЕЛЯ_АРЕНДОДАТЕЛЯ: buildBasis(ownerRep),

    // ── Арендатор ──
    ФИО_АРЕНДАТОРА: client?.full_name || '_______________',
    СЕРИЯ_НОМЕР_ПАСПОРТА_АРЕНДАТОРА: buildPassport(client),
    ОРГАН_ВЫДАЧИ_ПАСПОРТА_АРЕНДАТОРА: client?.passport_issued_by || '_______________',
    АДРЕС_РЕГИСТРАЦИИ_АРЕНДАТОРА: buildAddress(client),
    ТЕЛЕФОН_АРЕНДАТОРА: client?.phone || '_______________',
    НАЗВАНИЕ_ОРГАНИЗАЦИИ_АРЕНДАТОРА: client?.company_name || '_______________',
    ИНН_АРЕНДАТОРА: client?.inn || '_______________',
    КПП_АРЕНДАТОРА: client?.kpp || '_______________',
    ОГРН_АРЕНДАТОРА: client?.ogrn || '_______________',
    ЮР_АДРЕС_АРЕНДАТОРА: client?.legal_address || '_______________',
    ФИО_ПРЕДСТАВИТЕЛЯ_АРЕНДАТОРА: clientRep?.full_name || '_______________',
    ДОЛЖНОСТЬ_ПРЕДСТАВИТЕЛЯ_АРЕНДАТОРА: clientRep?.position || '_______________',
    ОСНОВАНИЕ_ПРЕДСТАВИТЕЛЯ_АРЕНДАТОРА: buildBasis(clientRep),

    // ── Объект ──
    АДРЕС_ЖИЛОГО_ПОМЕЩЕНИЯ: (property?.address as string) || '_______________',
    ПЛОЩАДЬ: property?.area ? String(property.area) : '___',
    ДОКУМЕНТ_ПРАВА_СОБСТВЕННОСТИ: (property?.ownership_basis as string) || '_______________',

    // ── Проживающие ──
    'ФИО_И_ПАСПОРТ_ПРОЖИВАЮЩИХ': cohabitantsText,
    'КОЛ-ВО_ДЕТЕЙ': td.children_count != null ? String(td.children_count) : '0',

    // ── Животные ──
    'ЖИВОТНЫЕ_ЗАПРЕЩ_РАЗРЕШ': td.pets_allowed ? 'разрешено' : 'запрещено',
    ЖИВОТНЫЕ_ВИД: td.pets_species || '___',
    'ЖИВОТНЫЕ_КОЛ-ВО': td.pets_count != null ? String(td.pets_count) : '___',

    // ── Сроки ──
    'КОЛ-ВО_МЕСЯЦЕВ': monthsCount,
    ДЕНЬ_НАЧАЛА: startDate.day,
    МЕСЯЦ_НАЧАЛА: startDate.month,
    ГОД_НАЧАЛА: startDate.year,
    СРОК_УВЕДОМЛЕНИЯ_О_НЕПРОДЛЕНИИ: td.renewal_notice_months != null ? String(td.renewal_notice_months) : '1',
    СРОК_УВЕДОМЛЕНИЯ_О_РАСТОРЖЕНИИ: td.termination_notice_days != null ? String(td.termination_notice_days) : '30',
    НЕУСТОЙКА_ЗА_ДЕНЬ: td.late_return_penalty_per_day != null ? String(td.late_return_penalty_per_day) : '1000',
    СРОК_УВЕДОМЛЕНИЯ_О_ПРОВЕРКЕ: td.landlord_access_notice_days != null ? String(td.landlord_access_notice_days) : '1',

    // ── Финансы ──
    РАЗМЕР_АРЕНДНОЙ_ПЛАТЫ: price > 0 ? price.toLocaleString('ru-RU') : '_______________',
    'ВХОДИТ_ИЛИ_НЕ_ВХОДИТ': td.utilities_included_in_rent ? 'входит' : 'не входит',
    ПЕРЕЧЕНЬ_КОММУНАЛЬНЫХ_УСЛУГ: td.utilities_paid_by_tenant || 'электроэнергия, холодная и горячая вода',
    'КТО_ОПЛАЧИВАЕТ_ИНТЕРНЕТ_КОНСЬЕРЖ': td.concierge_internet_payer === 'landlord' ? 'Арендодатель' : 'Арендатор',
    РАЗМЕР_ОБЕСПЕЧИТЕЛЬНОГО_ПЛАТЕЖА: deposit > 0 ? deposit.toLocaleString('ru-RU') : '0',

    // ── Дата договора ──
    ДЕНЬ: today.day,
    МЕСЯЦ: today.month,
    ГОД: today.year,
    'КОЛ-ВО_ЭКЗЕМПЛЯРОВ': td.copies_count != null ? String(td.copies_count) : '2',

    // ── Акт передачи ──
    ДЕНЬ_ДОГОВОРА: today.day,
    МЕСЯЦ_ДОГОВОРА: today.month,
    ГОД_ДОГОВОРА: today.year,
    ДЕНЬ_АКТА: handoverDate.day,
    МЕСЯЦ_АКТА: handoverDate.month,
    ГОД_АКТА: handoverDate.year,
    'КОЛ-ВО_КЛЮЧЕЙ': td.handover_keys_count != null ? String(td.handover_keys_count) : '2',
    'СЧЕТЧИК_ЭЛК-ВО': td.electricity_meter_reading || '___',
    СЧЕТЧИК_ГВС: td.hot_water_meter_reading || '___',
    СЧЕТЧИК_ХВС: td.cold_water_meter_reading || '___',
    ОПИСЬ_ИМУЩЕСТВА: inventoryText,

    // ── Акт возврата ──
    ДЕНЬ_ВОЗВРАТА: returnDate?.day ?? '___',
    МЕСЯЦ_ВОЗВРАТА: returnDate?.month ?? '___',
    ГОД_ВОЗВРАТА: returnDate?.year ?? '___',
    'КОЛ-ВО_КЛЮЧЕЙ_ВОЗВРАТ': td.return_keys_count != null ? String(td.return_keys_count) : '___',
    ПРЕТЕНЗИИ_ПРИ_ВОЗВРАТЕ: td.return_claims || 'Претензий не имеется',

    // ── Исполнитель (Агентство) ──
    ИСПОЛНИТЕЛЬ_НАЗВАНИЕ: company?.name || 'ИП HousePro',
    ИСПОЛНИТЕЛЬ_ФОРМА: legalFormLabels[companyLegalForm] || 'Индивидуальный предприниматель',
    ИСПОЛНИТЕЛЬ_ИНН: company?.inn || '_______________',
    ИСПОЛНИТЕЛЬ_ОГРН: company?.ogrn || '_______________',
    ИСПОЛНИТЕЛЬ_КПП: company?.kpp || '_______________',
    ИСПОЛНИТЕЛЬ_АДРЕС: company?.address || '_______________',
    ИСПОЛНИТЕЛЬ_БАНК: company?.bank_name || '_______________',
    ИСПОЛНИТЕЛЬ_РАСЧЕТНЫЙ_СЧЕТ: company?.bank_account || '_______________',
    ИСПОЛНИТЕЛЬ_КОРР_СЧЕТ: company?.corr_account || '_______________',
    ИСПОЛНИТЕЛЬ_БИК: company?.bik || '_______________',
    ИСПОЛНИТЕЛЬ_ТЕЛЕФОН: company?.phone || '_______________',
    ИСПОЛНИТЕЛЬ_ПОДПИСАНТ: executorSignatory,
    ИСПОЛНИТЕЛЬ_ДОЛЖНОСТЬ: executorPosition,
    ИСПОЛНИТЕЛЬ_ОСНОВАНИЕ: executorBasis,
    ИСПОЛНИТЕЛЬ_ПАСПОРТ: executorPassport,
    ИСПОЛНИТЕЛЬ_ПАСПОРТ_ВЫДАН: executorPassportIssued,

    // ── Договор-основание (субаренда) ──
    ОСНОВАНИЕ_НОМЕР_ДОГОВОРА: baseContract?.contract_number || '_______________',
    ОСНОВАНИЕ_ДАТА_ДОГОВОРА: baseContract?.start_date
      ? formatDateRu(baseContract.start_date).full
      : baseContract?.created_at
        ? formatDateRu(baseContract.created_at).full
        : '_______________',

    // ── Агентские услуги ──
    ПЕРЕЧЕНЬ_УСЛУГ: agencyServicesText,
    УСЛУГА_ДРУГОЕ: (td.service_other as string) || '',
    МОДЕЛЬ_ВОЗНАГРАЖДЕНИЯ: rewardModelText,
    ПРОЦЕНТ_ВОЗНАГРАЖДЕНИЯ: td.reward_percent != null && td.reward_percent !== '' ? String(td.reward_percent) : '___',
    УСЛОВИЯ_ОПЛАТЫ: paymentTermsText,

    // ── Аренда коммерческой недвижимости ──
    НАЗНАЧЕНИЕ_ИСПОЛЬЗОВАНИЯ: (td.usage_purpose as string) || '_______________',
    НДС_ВКЛЮЧЕН: td.vat_included ? 'включён' : 'не включён',
    КТО_ДЕЛАЕТ_РЕМОНТ: td.renovation_by === 'landlord' ? 'Арендодатель' : 'Арендатор',

    // ── Купля-продажа ──
    СПОСОБ_ОПЛАТЫ: td.payment_method ? (paymentMethodLabels[td.payment_method as string] || '_______________') : '_______________',
    РАСХОДЫ_НА_РЕГИСТРАЦИЮ_НЕСЕТ: td.registration_expenses_payer
      ? (registrationExpensesPayerLabels[td.registration_expenses_payer as string] || '_______________')
      : '_______________',
    ОБРЕМЕНЕНИЯ: (td.encumbrances as string) || 'не имеется',
    ЗАРЕГИСТРИРОВАННЫЕ_ЛИЦА: (td.registered_persons as string) || 'не имеется',
    ПОРЯДОК_ПЕРЕДАЧИ_КЛЮЧЕЙ: (td.key_transfer_order as string) || '_______________',
    АВАНС: advanceAmount > 0 ? advanceAmount.toLocaleString('ru-RU') : '0',

    // ── Управление недвижимостью ──
    ПЕРЕЧЕНЬ_УСЛУГ_УПРАВЛЕНИЯ: managementServicesText,
    УСЛУГА_УПРАВЛЕНИЯ_ДРУГОЕ: (td.service_other as string) || '',
    ПЕРИОДИЧНОСТЬ_ОТЧЕТА: td.report_frequency ? (reportFrequencyLabels[td.report_frequency as string] || '_______________') : '_______________',

    // ── Субаренда ──
    СОГЛАСИЕ_СОБСТВЕННИКА: td.owner_consent_given ? 'получено' : 'не получено',
    ДОКУМЕНТ_СОГЛАСИЯ_СОБСТВЕННИКА: (td.owner_consent_document as string) || '_______________',

    // ── Обратная совместимость ──
    CLIENT_NAME: client?.full_name || '_______________',
    CLIENT_PHONE: client?.phone || '_______________',
    CLIENT_PASSPORT: buildPassport(client),
    CLIENT_ADDRESS: buildAddress(client),
    PARTY2_NAME: client?.full_name || owner?.full_name || '_______________',
    PARTY2_PHONE: client?.phone || owner?.phone || '_______________',
    PARTY2_PASSPORT: client ? buildPassport(client) : buildPassport(owner),
    PROPERTY_ADDRESS: (property?.address as string) || '_______________',
    PROPERTY_TITLE: (property?.title as string) || '_______________',
    PROPERTY_AREA: property?.area ? `${property.area} кв.м.` : '___',
    PROPERTY_FLOOR: property?.floor ? String(property.floor) : '___',
    PROPERTY_ROOMS: property?.rooms ? String(property.rooms) : '___',
    CONTRACT_NUMBER: contract.contract_number || '_______________',
    CONTRACT_DATE: today.full,
    CONTRACT_TYPE: contract.contract_type || '',
    START_DATE: startDate.full,
    END_DATE: endDate.full,
    PRICE: price > 0 ? price.toLocaleString('ru-RU') : '0',
    PRICE_WORDS: price > 0 ? numberToWords(price) : 'ноль рублей',
    DEPOSIT: deposit > 0 ? deposit.toLocaleString('ru-RU') : '0',
    DEPOSIT_WORDS: deposit > 0 ? numberToWords(deposit) : 'ноль рублей',
    AGENCY_NAME: company?.name || 'ИП HousePro',
    MANAGER_NAME: manager?.full_name || '_______________',
    DATE_DAY: today.day,
    DATE_MONTH: today.month,
    DATE_YEAR: today.year,
    CITY: 'г. Москва',
  }
}

export async function generateDocxFromTemplate(
  templateBuffer: Buffer,
  variables: ContractVariables
): Promise<Buffer> {
  const zip = new PizZip(templateBuffer)

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    errorLogging: false,
    // Не падать при неизвестных тегах — оставлять их пустыми
    nullGetter: () => '___',
  })

  doc.render(variables)

  return doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  })
}

export async function uploadContractFile(
  contractId: string,
  buffer: Buffer,
  filename: string,
  contentType: string,
  injectedClient?: SupabaseClient
): Promise<string> {
  const supabase = injectedClient ?? (await createClient())

  const { data: versions } = await supabase
    .from('contract_versions')
    .select('version')
    .eq('contract_id', contractId)
    .order('version', { ascending: false })
    .limit(1)

  const nextVersion = versions && versions.length > 0 ? versions[0].version + 1 : 1
  const path = `contracts/${contractId}/v${nextVersion}/${filename}`

  const { error } = await supabase.storage
    .from('contracts')
    .upload(path, buffer, { contentType, upsert: true })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data: urlData } = await supabase.storage
    .from('contracts')
    .createSignedUrl(path, 60 * 60 * 24 * 365)

  return urlData?.signedUrl || path
}
