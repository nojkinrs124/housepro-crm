import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'
import { toPaymentStatus } from '@/features/accounting/utils/money-classification'
import { todayIso } from '@/lib/timezone'

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

type Row = {
  id: string
  amount: number | null
  status: string
  date: string | null
  due_date: string | null
  contract_id: string | null
  category: { code: string | null } | { code: string | null }[] | null
  contract: { contract_number: string | null } | { contract_number: string | null }[] | null
}

const one = <T,>(v: T | T[] | null): T | null => Array.isArray(v) ? v[0] ?? null : v

// Read-only роут (нет POST/PATCH) — платежи создаются автоматически при генерации договора,
// отметка "оплачено" в боте идёт напрямую через crm-menu.ts (не через API v1). Этот эндпоинт
// нужен, чтобы AI-диалог мог спросить "какие оплаты просрочены/ждут" без захода в меню.
//
// Источник — accounting_transactions: таблица payments заморожена с июня 2026
// (0 открытых строк), этот роут молча отдавал пустоту (docs/SIMPLIFY-AUDIT.md, B4.5).
// payment_status здесь не хранится, а вычисляется по той же логике, что и на
// /analytics и /accounting — money-classification.ts.
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
  const requestedStatus = searchParams.get('status')

  const { data, error } = await supabaseAdmin
    .from('accounting_transactions')
    .select('id, amount, status, date, due_date, contract_id, category:accounting_categories(code), contract:contracts(contract_number)')
    .eq('organization_id', auth.orgId)
    .eq('type', 'income')
    .in('status', ['planned', 'completed'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(1000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = todayIso()
  const shaped = ((data ?? []) as unknown as Row[]).map(r => {
    const contract = one(r.contract)
    const category = one(r.category)
    return {
      id: r.id,
      amount: r.amount,
      payment_type: category?.code ?? null,
      payment_status: toPaymentStatus(r.status, r.due_date, today),
      due_date: r.due_date,
      payment_date: r.status === 'completed' ? r.date : null,
      contract_id: r.contract_id,
      contracts: contract ? { contract_number: contract.contract_number } : null,
    }
  })

  const filtered = requestedStatus
    ? shaped.filter(p => p.payment_status === requestedStatus)
    : shaped.filter(p => p.payment_status === 'pending' || p.payment_status === 'overdue')

  const page = filtered.slice(offset, offset + limit)

  return NextResponse.json({ data: page, meta: { total: filtered.length, limit, offset } })
}
