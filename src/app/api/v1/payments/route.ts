import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'

// КРИТИЧНО: этот роут отдаёт данные, специфичные для конкретной организации/пользователя —
// force-dynamic отключает кэширование Route Handler (см. /api/v1/deals для того же комментария).
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) } }
  )
}

// Read-only роут (нет POST/PATCH) — платежи создаются автоматически при генерации договора,
// отметка "оплачено" в боте идёт напрямую через crm-menu.ts (не через API v1). Этот эндпоинт
// нужен, чтобы AI-диалог мог спросить "какие оплаты просрочены/ждут" без захода в меню.
export async function GET(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'read')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const offset = Number(searchParams.get('offset') ?? 0)
  const status = searchParams.get('status')

  let query = supabaseAdmin
    .from('payments')
    .select('id, amount, payment_type, payment_status, due_date, payment_date, contract_id, contracts(contract_number)', {
      count: 'exact',
    })
    .eq('organization_id', auth.orgId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('payment_status', status)
  else query = query.in('payment_status', ['pending', 'overdue', 'partial'])

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, meta: { total: count, limit, offset } })
}
