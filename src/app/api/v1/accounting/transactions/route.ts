import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'
import { TransactionCreateSchema } from '@/lib/schemas/accounting-api'
import { writeAuditLogServiceRole } from '@/lib/audit'

// КРИТИЧНО: этот роут отдаёт данные, специфичные для конкретной организации/пользователя.
// Next.js по умолчанию может закэшировать GET Route Handler и отдать один и тот же ответ
// разным организациям по одному URL — это утечка данных между тенантами.
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // no-store: этот клиент на service role (обходит RLS) — кэширование его
    // ответов на уровне Next.js Data Cache недопустимо (утечка между организациями).
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
  const limit      = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const offset     = Number(searchParams.get('offset') ?? 0)
  const type       = searchParams.get('type')       // income | expense
  const categoryId = searchParams.get('category_id')
  const dateFrom   = searchParams.get('date_from')   // YYYY-MM-DD
  const dateTo     = searchParams.get('date_to')

  let query = supabaseAdmin
    .from('accounting_transactions')
    .select(
      'id, type, amount, category_id, date, description, status, payment_method, deal_id, contract_id, contact_id, created_at',
      { count: 'exact' }
    )
    .eq('organization_id', auth.orgId)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) query = query.eq('type', type)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo) query = query.lte('date', dateTo)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Сводка — удобно для finance-summary-сценариев бота без второго запроса
  const income  = (data ?? []).filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = (data ?? []).filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  return NextResponse.json({
    data,
    meta: { total: count, limit, offset, summary: { income, expense, profit: income - expense } },
  })
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = TransactionCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('accounting_transactions')
    .insert({
      organization_id: auth.orgId,
      type:             parsed.data.type,
      amount:           parsed.data.amount,
      category_id:      parsed.data.category_id,
      description:      parsed.data.description ?? null,
      date:             parsed.data.date,
      status:           parsed.data.status,
      payment_method:   parsed.data.payment_method ?? null,
      contract_id:      parsed.data.contract_id,
      deal_id:          parsed.data.deal_id,
      contact_id:       parsed.data.contact_id,
    })
    .select('id, type, amount, category_id, date, description, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLogServiceRole(supabaseAdmin, {
    orgId:       auth.orgId!,
    action:      'create',
    entityType:  'accounting_transaction',
    entityId:    data.id,
    entityLabel: `${parsed.data.type === 'income' ? 'Доход' : 'Расход'}: ${parsed.data.amount} (через Telegram-бота)`,
    changes:     { amount: { old: null, new: parsed.data.amount }, type: { old: null, new: parsed.data.type } },
  })

  return NextResponse.json({ data }, { status: 201 })
}
