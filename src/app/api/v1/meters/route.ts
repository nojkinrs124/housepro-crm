import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'
import { MeterReadingsBatchSchema } from '@/lib/schemas/meters-api'
import { writeAuditLogServiceRole } from '@/lib/audit'
import { planReading, pickMeter } from '@/features/meters/services/reading-batch'
import { METER_KIND_LABELS, METER_KIND_UNITS } from '@/features/meters/config/meter-kinds'
import { todayIso } from '@/lib/timezone'

// Счётчики и показания объекта для Telegram-бота.
// GET  ?search=Соколовская 72 | ?property_id=… — объекты, их счётчики и последние показания.
// POST — пакет показаний на одну дату; недостающий счётчик заводится сам.
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) } }
  )
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
        .select('id, property_id, kind, title, unit, tariff')
        .in('property_id', ids)
        .eq('is_active', true)
    : { data: [] as Array<{ id: string; property_id: string; kind: string; title: string | null; unit: string; tariff: number | null }> }

  const meterIds = (meters ?? []).map(m => m.id)
  const { data: readings } = meterIds.length
    ? await supabase
        .from('meter_readings')
        .select('meter_id, reading_date, value, consumption, amount')
        .in('meter_id', meterIds)
        .order('reading_date', { ascending: false })
        .limit(100)
    : { data: [] as Array<{ meter_id: string; reading_date: string; value: number; consumption: number | null; amount: number | null }> }

  const data = (properties ?? []).map(p => ({
    ...p,
    meters: (meters ?? [])
      .filter(m => m.property_id === p.id)
      .map(m => ({
        kind: m.kind,
        title: m.title ?? METER_KIND_LABELS[m.kind],
        unit: m.unit,
        tariff: m.tariff,
        last_readings: (readings ?? []).filter(r => r.meter_id === m.id).slice(0, 3),
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

  const { data: existing } = await supabase
    .from('utility_meters')
    .select('id, kind, title, tariff, unit')
    .eq('property_id', property_id)
    .eq('is_active', true)

  const lines: string[] = []
  const warnings: string[] = []
  const errors: string[] = []
  let total = 0

  for (const line of readings) {
    const kindLabel = METER_KIND_LABELS[line.kind] ?? line.kind
    const picked = pickMeter(existing ?? [], line.kind, line.title)
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
          organization_id: auth.orgId,
          property_id,
          kind: line.kind,
          title: line.title || null,
          unit: METER_KIND_UNITS[line.kind] || 'ед.',
          tariff: line.tariff ?? null,
        })
        .select('id, kind, title, tariff, unit')
        .single()
      if (error || !created) {
        errors.push(`${label}: не удалось завести счётчик`)
        continue
      }
      meter = created
      // Следующая строка пакета с тем же прибором должна его найти, а не завести второй.
      ;(existing ?? []).push(created)
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
      organization_id: auth.orgId,
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
      orgId: auth.orgId!,
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
