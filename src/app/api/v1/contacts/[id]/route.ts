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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'read')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('id', id)
    .eq('organization_id', auth.orgId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope (write required)' }, { status: 403 })
  }

  const body = await request.json()
  const allowedFields = [
    'full_name', 'phone', 'email', 'role', 'status', 'comment', 'source',
    'passport_series', 'passport_number', 'passport_issued_date',
    'passport_issued_by', 'passport_department_code', 'birth_date',
    'country', 'region', 'city', 'street', 'house_number', 'building', 'apartment',
  ]
  const updates: Record<string, unknown> = {}
  for (const f of allowedFields) {
    if (f in body) updates[f] = body[f]
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', auth.orgId)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: error ? 500 : 404 })
  return NextResponse.json({ data })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope (write required)' }, { status: 403 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { error } = await supabaseAdmin
    .from('contacts')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
