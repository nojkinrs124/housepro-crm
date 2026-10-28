import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'
import { summarizeFinance, type FinanceSummaryRow } from '@/features/accounting/services/finance-summary'
import { todayIso } from '@/lib/timezone'

// Итоги по деньгам за период: реальная выручка агентства, транзит клиентов,
// расходы агентства, выплаты собственникам, дебиторка и разбивка по месяцам.
//
// Зачем отдельный эндпоинт (находка аудита бота 28.10.2026): потребители
// (Telegram-бот) брали `meta.summary` из /accounting/transactions — а тот
// считается по ОДНОЙ странице (limit 200) и не знает деления «выручка /
// транзит». На периоде в 200+ операций ответ «сколько заработали» молча
// занижался. Здесь строки вычитываются постранично ЦЕЛИКОМ и считаются тем же
// предикатом, что KPI «Доход» на /analytics (money-classification.ts).
//
// КРИТИЧНО: данные специфичны для организации; кэш на уровне Next.js вернул бы
// чужие цифры по совпавшему URL — force-dynamic и no-store, как в соседних v1.
export const dynamic = 'force-dynamic'

/** Размер страницы Supabase. Меньше лимита PostgREST (1000) с запасом. */
const PAGE_SIZE = 500
/** Предохранитель: 50 страниц × 500 = 25 000 строк, дальше даты надо сузить. */
const MAX_PAGES = 50

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) } }
  )
}

/** Первый день месяца, отстоящего на `monthsBack` назад (YYYY-MM-DD). */
function monthStartIso(monthsBack: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - monthsBack)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'read')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  // По умолчанию — 12 месяцев: типичный вопрос «сколько заработали в этом году».
  const dateFrom = searchParams.get('date_from') ?? monthStartIso(11)
  const dateTo = searchParams.get('date_to') ?? todayIso()

  const supabaseAdmin = getSupabaseAdmin()
  const rows: FinanceSummaryRow[] = []
  let truncated = false

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await supabaseAdmin
      .from('accounting_transactions')
      .select('type, amount, status, date, due_date, borne_by, category:accounting_categories(code)')
      .eq('organization_id', auth.orgId)
      .neq('status', 'cancelled')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    for (const t of data ?? []) {
      const category = Array.isArray(t.category) ? t.category[0] : t.category
      rows.push({
        type: t.type as 'income' | 'expense',
        amount: t.amount,
        status: t.status,
        date: t.date,
        due_date: t.due_date ?? null,
        categoryCode: category?.code ?? null,
        borneBy: (t.borne_by as 'agency' | 'owner' | null) ?? null,
      })
    }

    if ((data ?? []).length < PAGE_SIZE) break
    if (page === MAX_PAGES - 1) truncated = true
  }

  const summary = summarizeFinance(rows, { todayIso: todayIso() })

  return NextResponse.json({
    data: summary,
    meta: { date_from: dateFrom, date_to: dateTo, truncated },
  })
}
