import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, botRequesterLabel, hasScope } from '@/lib/api-auth'
import { MeterReadingsBatchSchema } from '@/lib/schemas/meters-api'
import { writeAuditLogServiceRole } from '@/lib/audit'
import { planReading, pickMeter } from '@/features/meters/services/reading-batch'
import { METER_KIND_LABELS, METER_KIND_UNITS } from '@/features/meters/config/meter-kinds'
import { todayIso } from '@/lib/timezone'
import {
  buildTelegramPreview,
  formatTelegramAuditLabel,
  logicalReadings,
  type PreviewMeter,
  type TelegramMessageRef,
} from '@/features/meters/services/telegram-readings'
import type { ReadingInsert } from '@/features/meters/types'

// Счётчики и показания объекта для Telegram-бота.
// GET  ?search=Соколовская 72 | ?property_id=… — объекты, их счётчики и последние показания.
// POST — пакет показаний на одну дату.
//   · source=telegram — строго: прибор ищется по контуру и виду, ничего не
//     заводится и тариф не меняется; dry_run:true отдаёт предпросмотр без записи;
//     повторная доставка апдейта распознаётся по (чат, сообщение, прибор);
//     исправление существующего показания — append-only, с причиной.
//   · без source — старое поведение: недостающий счётчик заводится сам (совместимость).
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) } }
  )
}

type Admin = ReturnType<typeof getSupabaseAdmin>

interface MeterRow {
  id: string
  kind: string
  title: string | null
  contour: string | null
  serial_number: string | null
  unit: string
  tariff: number | null
}

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'read')) return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })

  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('property_id')
  const search = (searchParams.get('search') ?? '').trim()
  if (!propertyId && !search) {
    return NextResponse.json({ error: 'Нужен property_id или search' }, { status: 400 })
  }

  let pq = supabase
    .from('properties')
    .select('id, title, address')
    .eq('organization_id', auth.orgId)
    .limit(5)
  if (propertyId) pq = pq.eq('id', propertyId)
  else {
    // «Соколовская 72» должно найти «ул. Соколовская, д. 72, кв. 83»: ищем
    // каждое слово отдельно, а не всю фразу целиком.
    for (const word of search.split(/[\s,.]+/).filter(w => w.length > 0)) {
      const safe = word.replace(/[%_,()]/g, '')
      if (safe) pq = pq.or(`title.ilike.%${safe}%,address.ilike.%${safe}%`)
    }
  }
  const { data: properties, error } = await pq
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (properties ?? []).map(p => p.id)
  const { data: meters } = ids.length
    ? await supabase
        .from('utility_meters')
        .select('id, property_id, kind, title, contour, serial_number, unit, tariff')
        .in('property_id', ids)
        .eq('is_active', true)
    : { data: [] as Array<{ id: string; property_id: string; kind: string; title: string | null; contour: string | null; serial_number: string | null; unit: string; tariff: number | null }> }

  const meterIds = (meters ?? []).map(m => m.id)
  type ReadingOut = {
    id: string
    meter_id: string
    reading_date: string
    value: number
    consumption: number | null
    amount: number | null
    source: string
    corrects_reading_id: string | null
    correction_reason: string | null
  }
  const readingsRes = meterIds.length
    ? await supabase
        .from('meter_readings')
        .select('id, meter_id, reading_date, value, consumption, amount, source, corrects_reading_id, correction_reason')
        .in('meter_id', meterIds)
        .order('reading_date', { ascending: false })
        .limit(200)
    : { data: [] as ReadingOut[] }
  const readings = (readingsRes.data ?? []) as ReadingOut[]
  // Исправленным считается показание, на которое ссылается другое (append-only).
  // Бот по этому флагу понимает, какое показание ещё можно исправить, а какое
  // уже заменено и целью исправления быть не может.
  const supersededIds = new Set(
    readings.map(r => r.corrects_reading_id).filter((id): id is string => !!id),
  )

  const data = (properties ?? []).map(p => ({
    ...p,
    meters: (meters ?? [])
      .filter(m => m.property_id === p.id)
      .map(m => ({
        kind: m.kind,
        // Контур — по нему бот сопоставляет показание с прибором.
        contour: m.contour,
        title: m.title ?? METER_KIND_LABELS[m.kind],
        serial_number: m.serial_number,
        unit: m.unit,
        tariff: m.tariff,
        last_readings: readings
          .filter(r => r.meter_id === m.id)
          .slice(0, 12)
          .map(r => ({
            id: r.id,
            reading_date: r.reading_date,
            value: r.value,
            consumption: r.consumption,
            amount: r.amount,
            source: r.source,
            corrects_reading_id: r.corrects_reading_id,
            correction_reason: r.correction_reason,
            // false → показание действующее и его можно исправить.
            superseded: supersededIds.has(r.id),
          })),
      })),
  }))
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope (write required)' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = MeterReadingsBatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }
  const { property_id, readings } = parsed.data
  const readingDate = parsed.data.reading_date || todayIso()
  if (readingDate > todayIso()) {
    return NextResponse.json({ error: 'Дата показания в будущем' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: property } = await supabase
    .from('properties')
    .select('id, title')
    .eq('id', property_id)
    .eq('organization_id', auth.orgId)
    .maybeSingle()
  if (!property) return NextResponse.json({ error: 'Объект не найден' }, { status: 404 })

  const { data: meterRows } = await supabase
    .from('utility_meters')
    .select('id, kind, title, contour, serial_number, unit, tariff')
    .eq('property_id', property_id)
    .eq('is_active', true)
  const meters = (meterRows ?? []) as MeterRow[]

  // Telegram-путь: строгое сопоставление, предпросмотр, идемпотентность, правки.
  if (parsed.data.source === 'telegram' && parsed.data.telegram) {
    return handleTelegram({
      auth, supabase, property, readingDate, meters,
      readings, telegram: parsed.data.telegram,
      requester: botRequesterLabel(request),
      photos: parsed.data.photo_urls ?? [],
      correctionReason: parsed.data.correction_reason ?? null,
      dryRun: parsed.data.dry_run === true,
    })
  }

  // Старый путь (совместимость): недостающий счётчик заводится сам.
  return handleLegacy({ auth, supabase, property, property_id, readingDate, readings, existing: meters })
}

interface TelegramContext {
  auth: { orgId?: string }
  supabase: Admin
  property: { id: string; title: string }
  readingDate: string
  meters: MeterRow[]
  readings: Array<{ kind: string; contour?: string | null; serial_number?: string | null; value: number; tariff?: number | null; note?: string | null; correction_reason?: string | null; corrects_reading_id?: string | null }>
  telegram: { user_id?: number | null; username?: string | null; chat_id: number; thread_id?: number | null; message_id: number }
  requester: string | null
  photos: string[]
  /** Общая причина исправления на пакет (1–300 символов). */
  correctionReason: string | null
  dryRun: boolean
}

async function handleTelegram(ctx: TelegramContext) {
  const { auth, supabase, property, readingDate, meters, readings, telegram, requester, photos, correctionReason, dryRun } = ctx
  const orgId = auth.orgId!
  const ref: TelegramMessageRef = { chat_id: telegram.chat_id, message_id: telegram.message_id }
  const meterIds = meters.map(m => m.id)

  type ExistingRow = { meter_id: string; source_chat_id: number | null; source_message_id: number | null }
  type HistoryRow = { id: string; meter_id: string; reading_date: string; value: number; corrects_reading_id: string | null }

  // Повторная доставка того же сообщения — ищем уже принятые строки.
  const existingRes = meterIds.length
    ? await supabase
        .from('meter_readings')
        .select('meter_id, source_chat_id, source_message_id')
        .eq('source', 'telegram')
        .eq('source_chat_id', telegram.chat_id)
        .eq('source_message_id', telegram.message_id)
        .in('meter_id', meterIds)
    : { data: [] as ExistingRow[] }
  const existing = (existingRes.data ?? []) as ExistingRow[]

  // История для расчёта: действующие показания (исправленные исключены).
  const historyRes = meterIds.length
    ? await supabase
        .from('meter_readings')
        .select('id, meter_id, reading_date, value, corrects_reading_id')
        .in('meter_id', meterIds)
        .order('reading_date', { ascending: false })
    : { data: [] as HistoryRow[] }
  const historyRows = (historyRes.data ?? []) as HistoryRow[]

  const previewMeters: PreviewMeter[] = meters.map(m => ({
    id: m.id,
    kind: m.kind,
    title: m.title,
    contour: m.contour,
    serial_number: m.serial_number,
    unit: m.unit,
    tariff: m.tariff == null ? null : Number(m.tariff),
    history: logicalReadings(
      historyRows
        .filter(r => r.meter_id === m.id)
        .map(r => ({
          id: r.id,
          reading_date: r.reading_date,
          value: Number(r.value),
          corrects_reading_id: r.corrects_reading_id,
        })),
    ).sort((a, b) => b.reading_date.localeCompare(a.reading_date)),
  }))

  const planned = buildTelegramPreview(readings, previewMeters, readingDate, {
    ref,
    existing: existing ?? [],
    correctionReason,
  })

  if (dryRun) {
    // Ошибки строк отдаём отдельным списком: бот показывает их в карточке
    // подтверждения и не пишет ничего, пока человек не разберётся.
    const errors = planned.filter(l => l.error).map(l => `${l.label}: ${l.error}`)
    const warnings = planned.flatMap(l => l.warnings.map(w => `${l.label}: ${w}`))
    return NextResponse.json({
      data: { preview: true, property: property.title, reading_date: readingDate, planned, errors, warnings },
    })
  }

  const saved: string[] = []
  const warnings: string[] = []
  const errors: string[] = []
  const skipped: string[] = []
  let total = 0

  for (const line of planned) {
    if (line.duplicate) {
      skipped.push(`${line.label}: это сообщение уже принято`)
      continue
    }
    if (line.error || !line.meter_id) {
      errors.push(`${line.label}: ${line.error ?? 'счётчик не найден'}`)
      continue
    }

    const payload: ReadingInsert = {
      organization_id: orgId,
      meter_id: line.meter_id,
      reading_date: readingDate,
      value: line.value,
      consumption: line.consumption,
      amount: line.amount,
      source: 'telegram',
      note: line.correction ? `Исправление показания: ${line.correction.reason}` : 'Показание из Telegram',
      source_chat_id: telegram.chat_id,
      source_thread_id: telegram.thread_id ?? null,
      source_message_id: telegram.message_id,
      source_user_id: telegram.user_id ?? null,
      source_user_name: telegram.username ?? null,
      photo_urls: photos.length ? photos : null,
      corrects_reading_id: line.correction?.target_id ?? null,
      correction_reason: line.correction?.reason ?? null,
    }
    const { error: insErr } = await supabase.from('meter_readings').insert(payload)
    if (insErr) {
      // Гонка повторной доставки: уникальный индекс (чат, сообщение, прибор).
      if (/duplicate key|unique/i.test(insErr.message)) {
        skipped.push(`${line.label}: это сообщение уже принято`)
        continue
      }
      errors.push(`${line.label}: ${insErr.message}`)
      continue
    }

    total += line.amount ?? 0
    saved.push(
      line.consumption === null
        ? `${line.label}: ${line.value} — первое показание`
        : `${line.label}: ${line.value}, расход ${line.consumption} ${line.unit ?? ''}`.trimEnd() +
            (line.amount !== null ? ` = ${line.amount.toLocaleString('ru-RU')} ₽` : ' (тариф не задан)'),
    )
    warnings.push(...line.warnings.map(w => `${line.label}: ${w}`))
  }

  if (saved.length > 0) {
    await writeAuditLogServiceRole(supabase, {
      orgId,
      action: 'create',
      entityType: 'property',
      entityId: property.id,
      entityLabel: formatTelegramAuditLabel(property.title, readingDate, requester),
      changes: requester ? { requester: { old: null, new: requester } } : {},
    })
  }

  const status = errors.length > 0 && saved.length === 0 ? 400 : saved.length > 0 ? 201 : 200
  return NextResponse.json(
    {
      ...(status === 400 ? { error: errors.join('; ') } : {}),
      data: {
        property: property.title,
        reading_date: readingDate,
        planned,
        saved,
        skipped,
        total_utilities: Math.round(total * 100) / 100,
        warnings,
        errors,
      },
    },
    { status },
  )
}

interface LegacyContext {
  auth: { orgId?: string }
  supabase: Admin
  property: { id: string; title: string }
  property_id: string
  readingDate: string
  readings: Array<{ kind: string; title?: string | null; value: number; tariff?: number | null; note?: string | null }>
  existing: MeterRow[]
}

/** Совместимость: старый бот/менеджер. Недостающий счётчик заводится сам. */
async function handleLegacy(ctx: LegacyContext) {
  const { auth, supabase, property, property_id, readingDate, readings } = ctx
  const orgId = auth.orgId!
  const existing = [...ctx.existing]

  const lines: string[] = []
  const warnings: string[] = []
  const errors: string[] = []
  let total = 0

  for (const line of readings) {
    const kindLabel = METER_KIND_LABELS[line.kind] ?? line.kind
    const picked = pickMeter(existing, line.kind, line.title)
    if (picked && 'error' in picked) {
      errors.push(`${line.title || kindLabel}: ${picked.error}`)
      continue
    }
    let meter = picked
    const label = meter?.title || line.title || kindLabel

    if (!meter) {
      const { data: created, error } = await supabase
        .from('utility_meters')
        .insert({
          organization_id: orgId,
          property_id,
          kind: line.kind,
          title: line.title || null,
          unit: METER_KIND_UNITS[line.kind] || 'ед.',
          tariff: line.tariff ?? null,
        })
        .select('id, kind, title, contour, serial_number, unit, tariff')
        .single()
      if (error || !created) {
        errors.push(`${label}: не удалось завести счётчик`)
        continue
      }
      meter = created as MeterRow
      // Следующая строка пакета с тем же прибором должна его найти, а не завести второй.
      existing.push(created as MeterRow)
    } else if (line.tariff != null && Number(meter.tariff) !== line.tariff) {
      await supabase.from('utility_meters').update({ tariff: line.tariff }).eq('id', meter.id)
      meter = { ...meter, tariff: line.tariff }
    }

    const { data: history } = await supabase
      .from('meter_readings')
      .select('reading_date, value')
      .eq('meter_id', meter.id)
      .order('reading_date', { ascending: false })
      .limit(12)

    const plan = planReading(
      (history ?? []).map(r => ({ reading_date: r.reading_date, value: Number(r.value) })),
      readingDate,
      line.value,
      meter.tariff == null ? null : Number(meter.tariff),
    )
    if ('error' in plan) {
      errors.push(`${label}: ${plan.error}`)
      continue
    }

    const { error: insErr } = await supabase.from('meter_readings').insert({
      organization_id: orgId,
      meter_id: meter.id,
      reading_date: readingDate,
      value: line.value,
      consumption: plan.consumption,
      amount: plan.amount,
      source: 'manager',
      note: line.note ?? 'Telegram-бот',
    })
    if (insErr) {
      errors.push(`${label}: ${insErr.message}`)
      continue
    }

    total += plan.amount ?? 0
    lines.push(
      plan.consumption === null
        ? `${label}: ${line.value} — первое показание`
        : `${label}: ${line.value}, расход ${plan.consumption} ${meter.unit}` +
            (plan.amount !== null ? ` = ${plan.amount.toLocaleString('ru-RU')} ₽` : ' (тариф не задан)'),
    )
    warnings.push(...plan.warnings.map(w => `${label}: ${w}`))
  }

  if (lines.length > 0) {
    await writeAuditLogServiceRole(supabase, {
      orgId,
      action: 'create',
      entityType: 'property',
      entityId: property_id,
      entityLabel: `Показания счётчиков через Telegram-бота: ${property.title} (${readingDate})`,
    })
  }

  const status = lines.length === 0 ? 400 : 201
  return NextResponse.json(
    {
      ...(lines.length === 0 ? { error: errors.join('; ') || 'Ничего не сохранено' } : {}),
      data: {
        property: property.title,
        reading_date: readingDate,
        saved: lines,
        total_utilities: Math.round(total * 100) / 100,
        warnings,
        errors,
      },
    },
    { status },
  )
}
