'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { readTable } from '@/lib/import/xlsx-reader'
import {
  autoMapColumns,
  IMPORT_FIELDS,
  looksLikeHeaderRow,
  parseImportRow,
  type ImportEntity,
} from '@/lib/import/schema'

/** Предохранители: импорт идёт одним запросом, гигантский файл не должен его подвесить. */
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 5000
const PREVIEW_ROWS = 8
const INSERT_CHUNK = 200

const VALID_ENTITIES: ImportEntity[] = ['contacts', 'properties', 'leads']

export interface ParseFileResult {
  error?: string
  sheetName?: string
  headers?: string[]
  /** Строки данных без заголовка. */
  rows?: string[][]
  totalRows?: number
  truncated?: boolean
  mapping?: Record<string, number>
}

/**
 * Разбирает загруженный файл и предлагает сопоставление колонок.
 *
 * Файл нигде не сохраняется: разобранные строки возвращаются клиенту, он же
 * присылает их обратно в runImportAction. Так не нужен ни бакет для временных
 * файлов, ни его уборка — цена в том, что таблица дважды проходит по сети,
 * что для 5000 строк несущественно.
 */
export async function parseImportFileAction(
  entity: ImportEntity,
  _prevState: unknown,
  formData: FormData
): Promise<ParseFileResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  if (!VALID_ENTITIES.includes(entity)) return { error: 'Неизвестный тип импорта' }

  const rl = await rateLimitMutation(user.id, 'import_parse')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Выберите файл' }
  if (file.size > MAX_FILE_BYTES) return { error: 'Файл больше 10 МБ — разбейте его на части' }

  let sheet
  try {
    sheet = readTable(file.name, Buffer.from(await file.arrayBuffer()))
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Не удалось прочитать файл' }
  }

  if (sheet.rows.length === 0) return { error: 'Файл пустой' }

  // Первая непустая строка обычно заголовок — но если совпадений с полями нет,
  // считаем, что заголовков в файле не было, и подписываем колонки как «Колонка N».
  const first = sheet.rows[0]
  const hasHeader = looksLikeHeaderRow(first, entity)
  const headers = hasHeader ? first : first.map((_, i) => `Колонка ${i + 1}`)
  const dataRows = hasHeader ? sheet.rows.slice(1) : sheet.rows

  const nonEmpty = dataRows.filter((r) => r.some((c) => c.trim() !== ''))
  const truncated = nonEmpty.length > MAX_ROWS

  return {
    sheetName: sheet.sheetName,
    headers,
    rows: nonEmpty.slice(0, MAX_ROWS),
    totalRows: nonEmpty.length,
    truncated,
    mapping: autoMapColumns(headers, entity),
  }
}

export interface RunImportResult {
  error?: string
  success?: boolean
  inserted?: number
  skippedDuplicates?: number
  failed?: { line: number; reason: string }[]
}

const PERMISSION_RESOURCE: Record<ImportEntity, 'contacts' | 'properties' | 'leads'> = {
  contacts: 'contacts',
  properties: 'properties',
  leads: 'leads',
}

/** Ключ дедупликации: чем реально отличается «та же самая» запись. */
function dedupeKey(entity: ImportEntity, values: Record<string, unknown>): string | null {
  if (entity === 'properties') {
    const address = String(values.address ?? '').trim().toLowerCase()
    return address === '' ? null : address
  }
  const phone = String(values.phone ?? '').trim()
  return phone === '' ? null : phone
}

export async function runImportAction(
  entity: ImportEntity,
  mapping: Record<string, number>,
  rows: string[][],
  options?: { skipDuplicates?: boolean }
): Promise<RunImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  if (!VALID_ENTITIES.includes(entity)) return { error: 'Неизвестный тип импорта' }
  if (!Array.isArray(rows) || rows.length === 0) return { error: 'Нет строк для импорта' }
  if (rows.length > MAX_ROWS) return { error: `За один раз можно импортировать не больше ${MAX_ROWS} строк` }

  const rl = await rateLimitMutation(user.id, 'import_run')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, PERMISSION_RESOURCE[entity], 'create')
  if (permError) return permError

  // Обязательные поля должны быть сопоставлены — иначе импорт развалится построчно.
  const missingRequired = IMPORT_FIELDS[entity]
    .filter((f) => f.required && mapping[f.key] === undefined)
    .map((f) => f.label)
  if (missingRequired.length > 0) {
    return { error: `Не сопоставлены обязательные поля: ${missingRequired.join(', ')}` }
  }

  const skipDuplicates = options?.skipDuplicates ?? true

  // Существующие ключи организации — один запрос вместо проверки на каждую строку.
  const existingKeys = new Set<string>()
  if (skipDuplicates) {
    const column = entity === 'properties' ? 'address' : 'phone'
    const { data: existing } = await supabase
      .from(entity)
      .select(column)
      .eq('organization_id', orgId)
      .limit(10_000)

    for (const record of existing ?? []) {
      const value = (record as Record<string, string | null>)[column]
      if (value) existingKeys.add(value.trim().toLowerCase())
    }
  }

  const failed: { line: number; reason: string }[] = []
  const payload: Record<string, unknown>[] = []
  let skippedDuplicates = 0

  rows.forEach((row, index) => {
    const parsed = parseImportRow(row, mapping, entity)
    if (parsed.errors.length > 0) {
      failed.push({ line: index + 1, reason: parsed.errors[0] })
      return
    }

    const key = dedupeKey(entity, parsed.values)
    if (skipDuplicates && key && existingKeys.has(key.toLowerCase())) {
      skippedDuplicates += 1
      return
    }
    if (key) existingKeys.add(key.toLowerCase())

    payload.push({
      ...parsed.values,
      organization_id: orgId,
      ...(entity === 'leads' ? { status: 'new', assigned_to: user.id } : {}),
      ...(entity === 'properties' ? { status: 'available', manager_id: user.id } : {}),
    })
  })

  if (payload.length === 0) {
    return {
      error:
        skippedDuplicates > 0
          ? `Все ${skippedDuplicates} строк уже есть в базе — новых записей нет`
          : 'Не удалось разобрать ни одной строки',
      failed: failed.slice(0, 20),
      skippedDuplicates,
    }
  }

  // Вставка партиями: одна транзакция на 5000 строк упирается в лимиты PostgREST.
  let inserted = 0
  for (let i = 0; i < payload.length; i += INSERT_CHUNK) {
    const chunk = payload.slice(i, i + INSERT_CHUNK)
    const { error } = await supabase.from(entity).insert(chunk)
    if (error) {
      failed.push({ line: i + 1, reason: error.message })
      // Не прерываем: остальные партии могут пройти, а частичный импорт
      // лучше полного отката — пользователь видит, сколько реально загрузилось.
      continue
    }
    inserted += chunk.length
  }

  await writeAuditLog({
    userId: user.id,
    orgId,
    action: 'create',
    entityType: entity,
    entityId: orgId,
    entityLabel: `Импорт из файла: ${entity}`,
    changes: {
      import: { old: null, new: `${inserted} записей, пропущено дублей ${skippedDuplicates}` },
    },
  })

  revalidatePath(`/${entity}`)

  return {
    success: inserted > 0,
    inserted,
    skippedDuplicates,
    failed: failed.slice(0, 20),
  }
}
