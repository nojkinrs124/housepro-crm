import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'

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
  const dealType = searchParams.get('deal_type')

  let query = supabaseAdmin
    .from('properties')
    .select('id, title, address, deal_type, property_type, price, area, rooms, status, created_at', { count: 'exact' })
    .eq('organization_id', auth.orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status)   query = query.eq('status', status)
  if (dealType) query = query.eq('deal_type', dealType)

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

  for (const field of ['title', 'property_type', 'deal_type', 'address']) {
    if (!body[field]?.toString().trim()) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('properties')
    .insert({
      title:         body.title.trim(),
      property_type: body.property_type,
      deal_type:     body.deal_type,
      address:       body.address.trim(),
      district:      body.district ?? null,
      price:         body.price ?? null,
      deposit:       body.deposit ?? null,
      area:          body.area ?? null,
      rooms:         body.rooms ?? null,
      floor:         body.floor ?? null,
      description:   body.description ?? null,
      owner_id:      body.owner_id ?? null,
      status:        body.status ?? 'available',
      organization_id: auth.orgId,
    })
    .select('id, title, address, deal_type, property_type, price, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('id')
  if (!propertyId) return NextResponse.json({ error: 'Query param "id" is required' }, { status: 400 })

  const body = await request.json()
  const supabaseAdmin = getSupabaseAdmin()

  // Разрешаем менять только эти поля отсюда (status — основной сценарий для бота,
  // остальные — на случай "поправь цену/описание"; полное редактирование остаётся на сайте)
  const allowedFields = ['status', 'price', 'deposit', 'description'] as const
  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('organization_id', auth.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('properties')
    .update(updates)
    .eq('id', propertyId)
    .eq('organization_id', auth.orgId)
    .select('id, title, status, price')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
