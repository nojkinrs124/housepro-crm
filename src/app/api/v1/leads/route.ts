import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'
import { dispatchWebhook } from '@/lib/webhooks'
import { normalizePhone } from '@/lib/utils'

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
    .from('leads')
    .select('id, full_name, phone, email, status, source, deal_type, budget_min, budget_max, created_at', { count: 'exact' })
    .eq('organization_id', auth.orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, meta: { total: count, limit, offset } })
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope (write required)' }, { status: 403 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  const body = await request.json()
  if (!body.full_name?.trim() && !body.phone?.trim()) {
    return NextResponse.json({ error: 'full_name or phone is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .insert({
      full_name:  body.full_name  ?? null,
      phone:      normalizePhone(body.phone),
      email:      body.email      ?? null,
      source:     body.source     ?? 'api',
      comment:    body.comment    ?? null,
      deal_type:  body.deal_type  ?? null,
      status: 'new',
      organization_id: auth.orgId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  dispatchWebhook(auth.orgId!, 'lead.created', { id: data.id, full_name: data.full_name, source: data.source })

  return NextResponse.json({ data }, { status: 201 })
}
