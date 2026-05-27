import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { createClient } from '@/lib/supabase/server'

export interface ContractVariables {
  // Клиент
  CLIENT_NAME: string
  CLIENT_PHONE: string
  CLIENT_PASSPORT: string
  CLIENT_ADDRESS: string

  // Объект
  PROPERTY_ADDRESS: string
  PROPERTY_TITLE: string
  PROPERTY_AREA: string
  PROPERTY_FLOOR: string
  PROPERTY_ROOMS: string

  // Договор
  CONTRACT_NUMBER: string
  CONTRACT_DATE: string
  CONTRACT_TYPE: string
  START_DATE: string
  END_DATE: string

  // Финансы
  PRICE: string
  PRICE_WORDS: string
  DEPOSIT: string
  DEPOSIT_WORDS: string

  // Агентство
  AGENCY_NAME: string
  MANAGER_NAME: string

  // Дата
  DATE_DAY: string
  DATE_MONTH: string
  DATE_YEAR: string
  CITY: string
}

// Числа прописью (упрощённая версия)
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

export async function buildContractVariables(contractId: string): Promise<ContractVariables> {
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select(`
      *,
      client:clients(*),
      property:properties(*),
      manager:users(full_name)
    `)
    .eq('id', contractId)
    .single()

  if (!contract) throw new Error('Договор не найден')

  const client = contract.client as Record<string, string> | null
  const property = contract.property as Record<string, string | number> | null
  const manager = contract.manager as { full_name?: string } | null

  const today = formatDateRu(new Date().toISOString())
  const startDate = contract.start_date ? formatDateRu(contract.start_date) : today
  const endDate = contract.end_date ? formatDateRu(contract.end_date) : { full: '—', day: '', month: '', year: '' }

  const price = Number(contract.amount) || 0
  const deposit = Number(contract.deposit) || 0

  return {
    CLIENT_NAME: client?.full_name || '_______________',
    CLIENT_PHONE: client?.phone || '_______________',
    CLIENT_PASSPORT: client?.passport || '_______________',
    CLIENT_ADDRESS: '_______________',

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

    PRICE: price > 0 ? `${price.toLocaleString('ru-RU')}` : '0',
    PRICE_WORDS: price > 0 ? numberToWords(price) : 'ноль рублей',
    DEPOSIT: deposit > 0 ? `${deposit.toLocaleString('ru-RU')}` : '0',
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
  })

  doc.render(variables)

  const output = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  })

  return output
}

export async function uploadContractFile(
  contractId: string,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const supabase = await createClient()

  // Получаем текущую версию
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

  // Signed URL на 1 год
  const { data: urlData } = await supabase.storage
    .from('contracts')
    .createSignedUrl(path, 60 * 60 * 24 * 365)

  return urlData?.signedUrl || path
}
