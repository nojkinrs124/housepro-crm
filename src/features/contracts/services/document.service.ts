'use server'

import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { createClient } from '@/lib/supabase/server'

export interface ContractVariables {
  // ── Арендодатель (Сторона 1) ──────────────────────────────
  ФИО_АРЕНДОДАТЕЛЯ: string
  СЕРИЯ_НОМЕР_ПАСПОРТА_АРЕНДОДАТЕЛЯ: string
  ОРГАН_ВЫДАЧИ_ПАСПОРТА_АРЕНДОДАТЕЛЯ: string
  АДРЕС_РЕГИСТРАЦИИ_АРЕНДОДАТЕЛЯ: string
  ТЕЛЕФОН_АРЕНДОДАТЕЛЯ: string

  // ── Арендатор (Сторона 2) ─────────────────────────────────
  ФИО_АРЕНДАТОРА: string
  СЕРИЯ_НОМЕР_ПАСПОРТА_АРЕНДАТОРА: string
  ОРГАН_ВЫДАЧИ_ПАСПОРТА_АРЕНДАТОРА: string
  АДРЕС_РЕГИСТРАЦИИ_АРЕНДАТОРА: string
  ТЕЛЕФОН_АРЕНДАТОРА: string

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
  'КОЛ-ВО_КЛЮЧЕЙ': string
  'СЧЕТЧИК_ЭЛК-ВО': string
  СЧЕТЧИК_ГВС: string
  СЧЕТЧИК_ХВС: string

  // ── Обратная совместимость (старые шаблоны) ───────────────
  CLIENT_NAME: string
  CLIENT_PHONE: string
  CLIENT_PASSPORT: string
  CLIENT_ADDRESS: string
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

export async function buildContractVariables(contractId: string): Promise<ContractVariables> {
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select(`
      *,
      client:contacts!contracts_client_contact_id_fkey(
        full_name, phone, passport, passport_series, passport_number,
        passport_issued_by, region, city, street, house_number, apartment
      ),
      owner:contacts!contracts_owner_contact_id_fkey(
        full_name, phone, passport, passport_series, passport_number,
        passport_issued_by, region, city, street, house_number, apartment
      ),
      property:properties(title, address, area, rooms, floor),
      manager:users(full_name)
    `)
    .eq('id', contractId)
    .single()

  if (!contract) throw new Error('Договор не найден')

  const client = contract.client as Record<string, string> | null
  const owner = contract.owner as Record<string, string> | null
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

  return {
    // ── Арендодатель ──
    ФИО_АРЕНДОДАТЕЛЯ: owner?.full_name || '_______________',
    СЕРИЯ_НОМЕР_ПАСПОРТА_АРЕНДОДАТЕЛЯ: buildPassport(owner),
    ОРГАН_ВЫДАЧИ_ПАСПОРТА_АРЕНДОДАТЕЛЯ: owner?.passport_issued_by || '_______________',
    АДРЕС_РЕГИСТРАЦИИ_АРЕНДОДАТЕЛЯ: buildAddress(owner),
    ТЕЛЕФОН_АРЕНДОДАТЕЛЯ: owner?.phone || '_______________',

    // ── Арендатор ──
    ФИО_АРЕНДАТОРА: client?.full_name || '_______________',
    СЕРИЯ_НОМЕР_ПАСПОРТА_АРЕНДАТОРА: buildPassport(client),
    ОРГАН_ВЫДАЧИ_ПАСПОРТА_АРЕНДАТОРА: client?.passport_issued_by || '_______________',
    АДРЕС_РЕГИСТРАЦИИ_АРЕНДАТОРА: buildAddress(client),
    ТЕЛЕФОН_АРЕНДАТОРА: client?.phone || '_______________',

    // ── Объект ──
    АДРЕС_ЖИЛОГО_ПОМЕЩЕНИЯ: (property?.address as string) || '_______________',
    ПЛОЩАДЬ: property?.area ? String(property.area) : '___',
    ДОКУМЕНТ_ПРАВА_СОБСТВЕННОСТИ: '_______________',

    // ── Проживающие ──
    'ФИО_И_ПАСПОРТ_ПРОЖИВАЮЩИХ': '_______________',
    'КОЛ-ВО_ДЕТЕЙ': '___',

    // ── Животные ──
    'ЖИВОТНЫЕ_ЗАПРЕЩ_РАЗРЕШ': 'запрещено',
    ЖИВОТНЫЕ_ВИД: '___',
    'ЖИВОТНЫЕ_КОЛ-ВО': '___',

    // ── Сроки ──
    'КОЛ-ВО_МЕСЯЦЕВ': monthsCount,
    ДЕНЬ_НАЧАЛА: startDate.day,
    МЕСЯЦ_НАЧАЛА: startDate.month,
    ГОД_НАЧАЛА: startDate.year,
    СРОК_УВЕДОМЛЕНИЯ_О_НЕПРОДЛЕНИИ: '1',
    СРОК_УВЕДОМЛЕНИЯ_О_РАСТОРЖЕНИИ: '30',
    НЕУСТОЙКА_ЗА_ДЕНЬ: '1000',
    СРОК_УВЕДОМЛЕНИЯ_О_ПРОВЕРКЕ: '1',

    // ── Финансы ──
    РАЗМЕР_АРЕНДНОЙ_ПЛАТЫ: price > 0 ? price.toLocaleString('ru-RU') : '_______________',
    'ВХОДИТ_ИЛИ_НЕ_ВХОДИТ': 'не входит',
    ПЕРЕЧЕНЬ_КОММУНАЛЬНЫХ_УСЛУГ: 'электроэнергия, холодная и горячая вода',
    'КТО_ОПЛАЧИВАЕТ_ИНТЕРНЕТ_КОНСЬЕРЖ': 'Арендатор',
    РАЗМЕР_ОБЕСПЕЧИТЕЛЬНОГО_ПЛАТЕЖА: deposit > 0 ? deposit.toLocaleString('ru-RU') : '0',

    // ── Дата договора ──
    ДЕНЬ: today.day,
    МЕСЯЦ: today.month,
    ГОД: today.year,
    'КОЛ-ВО_ЭКЗЕМПЛЯРОВ': '2',

    // ── Акт передачи ──
    ДЕНЬ_ДОГОВОРА: today.day,
    МЕСЯЦ_ДОГОВОРА: today.month,
    ГОД_ДОГОВОРА: today.year,
    ДЕНЬ_АКТА: today.day,
    МЕСЯЦ_АКТА: today.month,
    'КОЛ-ВО_КЛЮЧЕЙ': '2',
    'СЧЕТЧИК_ЭЛК-ВО': '___',
    СЧЕТЧИК_ГВС: '___',
    СЧЕТЧИК_ХВС: '___',

    // ── Обратная совместимость ──
    CLIENT_NAME: client?.full_name || '_______________',
    CLIENT_PHONE: client?.phone || '_______________',
    CLIENT_PASSPORT: buildPassport(client),
    CLIENT_ADDRESS: buildAddress(client),
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
    AGENCY_NAME: 'ИП HousePro',
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
  contentType: string
): Promise<string> {
  const supabase = await createClient()

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
