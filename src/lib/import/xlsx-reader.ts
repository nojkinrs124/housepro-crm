// Чтение .xlsx без новых зависимостей.
//
// xlsx — это zip с XML внутри, а pizzip в проекте уже есть (им пользуется
// генерация договоров через docxtemplater). Поэтому вместо тяжёлой библиотеки
// парсинга таблиц читаем ровно то, что нужно импорту: значения ячеек первого
// листа в виде строк.
//
// Сознательные ограничения: не поддерживаем формулы (берём закэшированное
// значение), стили и объединённые ячейки. Для «таблица из выгрузки клиента»
// этого достаточно, а полноценный движок Excel в CRM не нужен.

import PizZip from 'pizzip'

export interface SheetData {
  /** Строки листа; первая обычно — заголовки. */
  rows: string[][]
  sheetName: string
}

/** Excel хранит даты числом дней от 30.12.1899 (с исторической багой 1900 года). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)

export function excelSerialToISO(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0 || serial > 60_000) return null
  const ms = EXCEL_EPOCH_MS + Math.round(serial) * 86_400_000
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

/** Собирает текст всех <t> внутри фрагмента — у строки могут быть форматные куски <r>. */
function textOf(fragment: string): string {
  const parts = [...fragment.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1])
  return decodeXmlEntities(parts.join(''))
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return []
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
}

/** "BC12" → 54 (0-индексный номер колонки). */
function columnIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '')
  let index = 0
  for (const ch of letters) {
    index = index * 26 + (ch.charCodeAt(0) - 64)
  }
  return index - 1
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = []

  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = []

    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1]
      const body = cellMatch[2]
      const refMatch = attrs.match(/r="([A-Z]+\d+)"/)
      const typeMatch = attrs.match(/t="([^"]+)"/)
      const index = refMatch ? columnIndex(refMatch[1]) : cells.length

      let value = ''
      if (typeMatch?.[1] === 's') {
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        value = v ? shared[Number(v)] ?? '' : ''
      } else if (typeMatch?.[1] === 'inlineStr') {
        value = textOf(body)
      } else {
        value = decodeXmlEntities(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '')
      }

      // Пропуски колонок в xlsx не кодируются пустыми <c> — восстанавливаем по r.
      while (cells.length < index) cells.push('')
      cells[index] = value.trim()
    }

    rows.push(cells)
  }

  return rows
}

/** Пустые «хвостовые» строки Excel добавляет щедро — они только мешают предпросмотру. */
function dropTrailingEmptyRows(rows: string[][]): string[][] {
  let end = rows.length
  while (end > 0 && rows[end - 1].every((c) => c === '')) end -= 1
  return rows.slice(0, end)
}

export function readXlsx(buffer: Buffer | ArrayBuffer): SheetData {
  const bytes = buffer instanceof Buffer ? buffer : Buffer.from(new Uint8Array(buffer))
  const zip = new PizZip(bytes)

  const sharedXml = zip.file('xl/sharedStrings.xml')?.asText() ?? null
  const shared = parseSharedStrings(sharedXml)

  // Порядок листов задаётся в workbook.xml, но имя файла листа с ним не совпадает
  // напрямую — для импорта достаточно первого листа по имени файла.
  const sheetFiles = zip
    .file(/xl\/worksheets\/sheet\d+\.xml/)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  if (sheetFiles.length === 0) throw new Error('В файле не найдено ни одного листа')

  const workbookXml = zip.file('xl/workbook.xml')?.asText() ?? ''
  const firstSheetName = workbookXml.match(/<sheet[^>]*name="([^"]*)"/)?.[1] ?? 'Лист 1'

  const rows = dropTrailingEmptyRows(parseSheet(sheetFiles[0].asText(), shared))
  return { rows, sheetName: decodeXmlEntities(firstSheetName) }
}

/** Определяет разделитель CSV по первой строке: ; преобладает в русских выгрузках. */
function detectDelimiter(line: string): string {
  const counts: Record<string, number> = {
    ';': (line.match(/;/g) ?? []).length,
    ',': (line.match(/,/g) ?? []).length,
    '\t': (line.match(/\t/g) ?? []).length,
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] ?? ';'
}

export function readCsv(text: string): SheetData {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = detectDelimiter(firstLine)

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i]

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field.trim())
      field = ''
    } else if (ch === '\n') {
      row.push(field.trim())
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field.trim())
    rows.push(row)
  }

  return { rows: dropTrailingEmptyRows(rows), sheetName: 'CSV' }
}

/** Единая точка входа: определяет формат по имени файла. */
export function readTable(filename: string, buffer: Buffer): SheetData {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) return readXlsx(buffer)
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
    return readCsv(buffer.toString('utf-8'))
  }
  throw new Error('Поддерживаются файлы .xlsx, .csv и .tsv')
}
