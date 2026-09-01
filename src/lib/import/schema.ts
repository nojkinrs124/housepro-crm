// Описание полей, доступных для импорта, и автосопоставление колонок файла.
//
// Файл чистый (без БД и React): его используют и Server Action, и клиентский
// мастер импорта для предпросмотра — как payment-schedule.service.ts.

import { normalizePhone } from '@/lib/utils'
import { excelSerialToISO } from './xlsx-reader'

export type ImportEntity = 'contacts' | 'properties' | 'leads'

export type ImportFieldType = 'text' | 'number' | 'date' | 'phone' | 'email' | 'enum'

export interface ImportField {
  /** Имя колонки в таблице БД. */
  key: string
  label: string
  type: ImportFieldType
  required?: boolean
  /** Варианты заголовков в файле клиента — по ним колонка подхватывается сама. */
  aliases: string[]
  /** Для type='enum': человекочитаемое значение → значение в БД. */
  enumValues?: Record<string, string>
  /** Значение по умолчанию, если колонка не сопоставлена. */
  fallback?: string
}

export const ENTITY_LABELS: Record<ImportEntity, string> = {
  contacts: 'Контакты',
  properties: 'Объекты',
  leads: 'Лиды',
}

const DEAL_TYPES: Record<string, string> = {
  аренда: 'rent',
  'найм': 'rent',
  продажа: 'sale',
  управление: 'management',
  субаренда: 'subrent',
  коммерция: 'commercial',
}

const PROPERTY_TYPES: Record<string, string> = {
  квартира: 'apartment',
  дом: 'house',
  коммерция: 'commercial',
  'коммерческая недвижимость': 'commercial',
  офис: 'office',
  склад: 'warehouse',
  участок: 'land',
  земля: 'land',
}

export const IMPORT_FIELDS: Record<ImportEntity, ImportField[]> = {
  contacts: [
    { key: 'full_name', label: 'ФИО / Название', type: 'text', required: true,
      aliases: ['фио', 'имя', 'наименование', 'название', 'клиент', 'контакт', 'name', 'full_name'] },
    { key: 'phone', label: 'Телефон', type: 'phone',
      aliases: ['телефон', 'моб', 'мобильный', 'тел', 'phone', 'номер'] },
    { key: 'email', label: 'Email', type: 'email', aliases: ['email', 'почта', 'e-mail', 'мейл'] },
    { key: 'role', label: 'Роль', type: 'enum', fallback: 'client',
      aliases: ['роль', 'тип', 'role'],
      enumValues: { клиент: 'client', арендатор: 'client', собственник: 'owner', владелец: 'owner', оба: 'both' } },
    { key: 'status', label: 'Статус', type: 'enum', fallback: 'new',
      aliases: ['статус', 'status'],
      enumValues: { новый: 'new', активный: 'active', vip: 'vip', вип: 'vip', неактивный: 'inactive' } },
    { key: 'telegram', label: 'Telegram', type: 'text', aliases: ['telegram', 'телеграм', 'тг'] },
    { key: 'whatsapp', label: 'WhatsApp', type: 'text', aliases: ['whatsapp', 'вотсап', 'ватсап'] },
    { key: 'company_name', label: 'Организация', type: 'text',
      aliases: ['организация', 'компания', 'юрлицо', 'company'] },
    { key: 'inn', label: 'ИНН', type: 'text', aliases: ['инн', 'inn'] },
    { key: 'kpp', label: 'КПП', type: 'text', aliases: ['кпп', 'kpp'] },
    { key: 'ogrn', label: 'ОГРН', type: 'text', aliases: ['огрн', 'ogrn'] },
    { key: 'legal_address', label: 'Юридический адрес', type: 'text',
      aliases: ['юридический адрес', 'юр адрес', 'юр. адрес'] },
    { key: 'notes', label: 'Комментарий', type: 'text',
      aliases: ['комментарий', 'примечание', 'заметки', 'notes', 'note'] },
  ],

  properties: [
    { key: 'title', label: 'Название', type: 'text', required: true,
      aliases: ['название', 'заголовок', 'объект', 'title'] },
    { key: 'address', label: 'Адрес', type: 'text', required: true,
      aliases: ['адрес', 'address', 'местоположение'] },
    { key: 'property_type', label: 'Тип объекта', type: 'enum', fallback: 'apartment',
      aliases: ['тип объекта', 'тип недвижимости', 'property_type', 'тип'],
      enumValues: PROPERTY_TYPES },
    { key: 'deal_type', label: 'Тип сделки', type: 'enum', fallback: 'rent',
      aliases: ['тип сделки', 'операция', 'deal_type', 'сделка'],
      enumValues: DEAL_TYPES },
    { key: 'price', label: 'Цена', type: 'number', aliases: ['цена', 'стоимость', 'price', 'аренда'] },
    { key: 'deposit', label: 'Депозит', type: 'number', aliases: ['депозит', 'залог', 'deposit'] },
    { key: 'area', label: 'Площадь', type: 'number', aliases: ['площадь', 'кв м', 'area', 'общая площадь'] },
    { key: 'rooms', label: 'Комнат', type: 'number', aliases: ['комнат', 'комнаты', 'rooms', 'кол-во комнат'] },
    { key: 'floor', label: 'Этаж', type: 'number', aliases: ['этаж', 'floor'] },
    { key: 'total_floors', label: 'Этажей в доме', type: 'number',
      aliases: ['этажей', 'этажность', 'всего этажей', 'total_floors'] },
    { key: 'district', label: 'Район', type: 'text', aliases: ['район', 'district', 'округ'] },
    { key: 'description', label: 'Описание', type: 'text', aliases: ['описание', 'description', 'комментарий'] },
    { key: 'cadastral_number', label: 'Кадастровый номер', type: 'text',
      aliases: ['кадастровый номер', 'кадастровый', 'кн'] },
  ],

  leads: [
    { key: 'full_name', label: 'Имя', type: 'text', required: true,
      aliases: ['имя', 'фио', 'клиент', 'name', 'контакт'] },
    { key: 'phone', label: 'Телефон', type: 'phone', aliases: ['телефон', 'тел', 'phone', 'номер'] },
    { key: 'email', label: 'Email', type: 'email', aliases: ['email', 'почта', 'e-mail'] },
    { key: 'source', label: 'Источник', type: 'text', aliases: ['источник', 'source', 'откуда'] },
    { key: 'comment', label: 'Комментарий', type: 'text',
      aliases: ['комментарий', 'заметка', 'примечание', 'запрос', 'comment'] },
    { key: 'budget_min', label: 'Бюджет от', type: 'number', aliases: ['бюджет от', 'бюджет мин', 'budget_min'] },
    { key: 'budget_max', label: 'Бюджет до', type: 'number',
      aliases: ['бюджет до', 'бюджет макс', 'бюджет', 'budget_max'] },
    { key: 'district', label: 'Район', type: 'text', aliases: ['район', 'district'] },
    { key: 'deal_type', label: 'Тип сделки', type: 'enum',
      aliases: ['тип сделки', 'операция', 'deal_type'], enumValues: DEAL_TYPES },
    { key: 'property_type', label: 'Тип объекта', type: 'enum',
      aliases: ['тип объекта', 'property_type'], enumValues: PROPERTY_TYPES },
  ],
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim()
}

/**
 * Сопоставляет колонки файла с полями сущности.
 * Возвращает { поле → индекс колонки }; несопоставленные поля отсутствуют в объекте.
 */
export function autoMapColumns(headers: string[], entity: ImportEntity): Record<string, number> {
  const normalized = headers.map(normalizeHeader)
  const mapping: Record<string, number> = {}
  const used = new Set<number>()

  for (const field of IMPORT_FIELDS[entity]) {
    const candidates = [field.label, field.key, ...field.aliases].map(normalizeHeader)

    // Сначала точное совпадение — оно надёжнее вхождения подстроки
    // («бюджет» не должен перехватить колонку «бюджет до»).
    let index = normalized.findIndex((h, i) => !used.has(i) && h !== '' && candidates.includes(h))
    if (index === -1) {
      index = normalized.findIndex(
        (h, i) => !used.has(i) && h !== '' && candidates.some((c) => c.length > 2 && h.includes(c))
      )
    }

    if (index !== -1) {
      mapping[field.key] = index
      used.add(index)
    }
  }

  return mapping
}

function parseNumberCell(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(/\s/g, '').replace(',', '.')
  if (cleaned === '') return null
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseDateCell(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  // Excel отдаёт даты числом — переводим по серийному номеру.
  if (/^\d+(\.\d+)?$/.test(trimmed)) return excelSerialToISO(Number.parseFloat(trimmed))

  const ru = trimmed.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/)
  if (ru) {
    const [, d, m, y] = ru
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

function parseEnumCell(raw: string, field: ImportField): string | null {
  const key = raw.trim().toLowerCase().replace(/ё/g, 'е')
  if (key === '') return null
  const values = field.enumValues ?? {}
  if (values[key]) return values[key]
  // Значение может быть уже в «системном» виде (rent, apartment) — пропускаем как есть.
  const known = new Set(Object.values(values))
  return known.has(key) ? key : null
}

export interface ParsedRow {
  values: Record<string, string | number | null>
  /** Проблемы, из-за которых строку нельзя импортировать. */
  errors: string[]
  /** Замечания, не блокирующие импорт (значение не распознано и пропущено). */
  warnings: string[]
}

/** Превращает строку файла в объект под вставку в БД. */
export function parseImportRow(
  row: string[],
  mapping: Record<string, number>,
  entity: ImportEntity
): ParsedRow {
  const values: Record<string, string | number | null> = {}
  const errors: string[] = []
  const warnings: string[] = []

  for (const field of IMPORT_FIELDS[entity]) {
    const index = mapping[field.key]
    const raw = index === undefined ? '' : (row[index] ?? '').trim()

    if (raw === '') {
      if (field.required) errors.push(`Не заполнено обязательное поле «${field.label}»`)
      else if (field.fallback) values[field.key] = field.fallback
      continue
    }

    switch (field.type) {
      case 'number': {
        const n = parseNumberCell(raw)
        if (n === null) warnings.push(`«${field.label}»: «${raw}» — не число, пропущено`)
        else values[field.key] = n
        break
      }
      case 'date': {
        const d = parseDateCell(raw)
        if (d === null) warnings.push(`«${field.label}»: «${raw}» — не дата, пропущено`)
        else values[field.key] = d
        break
      }
      case 'phone': {
        const phone = normalizePhone(raw)
        if (phone === null) warnings.push(`«${field.label}»: «${raw}» — не похоже на телефон`)
        else values[field.key] = phone
        break
      }
      case 'email': {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw)) {
          warnings.push(`«${field.label}»: «${raw}» — некорректный адрес, пропущен`)
        } else {
          values[field.key] = raw.toLowerCase()
        }
        break
      }
      case 'enum': {
        const parsed = parseEnumCell(raw, field)
        if (parsed === null) {
          warnings.push(`«${field.label}»: «${raw}» — неизвестное значение`)
          if (field.fallback) values[field.key] = field.fallback
        } else {
          values[field.key] = parsed
        }
        break
      }
      default:
        values[field.key] = raw
    }
  }

  return { values, errors, warnings }
}

/** Строка выглядит заголовком, если хотя бы половина ячеек совпала с алиасами полей. */
export function looksLikeHeaderRow(row: string[], entity: ImportEntity): boolean {
  const mapping = autoMapColumns(row, entity)
  const filled = row.filter((c) => c.trim() !== '').length
  return filled > 0 && Object.keys(mapping).length >= Math.max(1, Math.ceil(filled / 2))
}
