import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'
import { DealStatusUpdateSchema } from '@/lib/schemas/accounting-api'
import { writeAuditLogServiceRole } from '@/lib/audit'
import { isStageOf, stagesOf } from '@/features/directions/config/directions'

// КРИТИЧНО: этот роут отдаёт данные, специфичные для конкретной организации/пользователя
// (RLS или ручная фильтрация по organization_id). Next.js по умолчанию может закэшировать
// GET Route Handler и отдать один и тот же ответ разным пользователям/организациям по
// одному URL — это утечка данных между тенантами. force-dynamic отключает это кэширование.
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // no-store: этот клиент на service role (обходит RLS) — кэширование его
    // ответов на уровне Next.js Data Cache means one org's data could be
    // served to another org's request on a matching URL. Недопустимо.
    { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) } }
  )
}

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'read')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { searchParams } = new URL(request.url)
  const limit  = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const offset = Number(searchParams.get('offset') ?? 0)
  const status = searchParams.get('status')

  let query = supabaseAdmin
    .from('deals')
    .select('id, deal_type, status, amount, commission, created_at', { count: 'exact' })
    .eq('organization_id', auth.orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, meta: { total: count, limit, offset } })
}

export async function PATCH(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const dealId = searchParams.get('id')
  if (!dealId) return NextResponse.json({ error: 'Query param "id" is required' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = DealStatusUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  // Читаем текущий статус для audit log и чтобы убедиться, что сделка принадлежит этой организации
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('deals')
    .select('id, status, deal_type')
    .eq('id', dealId)
    .eq('organization_id', auth.orgId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  // Стадия обязана принадлежать направлению сделки: у аренды, управления,
  // продажи и подбора разные воронки. Без этой проверки запрос доходил бы до
  // CHECK в базе и возвращал наружу 500 вместо внятной ошибки.
  if (!isStageOf(existing.deal_type, parsed.data.status)) {
    return NextResponse.json(
      {
        error: 'Stage does not belong to the deal direction',
        details: {
          direction: existing.deal_type,
          allowed: stagesOf(existing.deal_type).map(stage => stage.value),
        },
      },
      { status: 400 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('deals')
    .update({ status: parsed.data.status })
    .eq('id', dealId)
    .eq('organization_id', auth.orgId)
    .select('id, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLogServiceRole(supabaseAdmin, {
    orgId:       auth.orgId!,
    action:      'update',
    entityType:  'deal',
    entityId:    dealId,
    entityLabel: `Сделка: статус изменён через Telegram-бота`,
    changes:     { status: { old: existing.status, new: parsed.data.status } },
  })

  return NextResponse.json({ data })
}
