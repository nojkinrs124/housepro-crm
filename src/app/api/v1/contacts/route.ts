import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'
import { likeFilterValue } from '@/lib/utils'

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
  const search = searchParams.get('search') // ищет по phone, full_name, telegram — для get_client tool бота

  let query = supabaseAdmin
    .from('contacts')
    .select('id, full_name, phone, email, telegram, role, status, created_at', { count: 'exact' })
    .eq('organization_id', auth.orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    const like = likeFilterValue(search)
    query = query.or(`phone.ilike.${like},full_name.ilike.${like},telegram.ilike.${like}`)
  }

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
  if (!body.full_name?.trim()) {
    return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({
      full_name: body.full_name.trim(),
      phone:     body.phone   ?? null,
      email:     body.email   ?? null,
      role:      body.role    ?? 'client',
      status:    body.status  ?? 'new',
      passport_series:          body.passport_series ?? null,
      passport_number:          body.passport_number ?? null,
      passport_issued_date:     body.passport_issued_date ?? null,
      passport_issued_by:       body.passport_issued_by ?? null,
      passport_department_code: body.passport_department_code ?? null,
      birth_date: body.birth_date ?? null,
      country: body.country ?? null,
      region:  body.region  ?? null,
      city:    body.city    ?? null,
      street:  body.street  ?? null,
      house_number: body.house_number ?? null,
      building:     body.building ?? null,
      apartment:    body.apartment ?? null,
      organization_id: auth.orgId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
