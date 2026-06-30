import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'read')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const limit  = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const offset = Number(searchParams.get('offset') ?? 0)

  const { data, error, count } = await supabaseAdmin
    .from('contacts')
    .select('id, full_name, phone, email, role, status, created_at', { count: 'exact' })
    .eq('organization_id', auth.orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, meta: { total: count, limit, offset } })
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope (write required)' }, { status: 403 })
  }

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
      organization_id: auth.orgId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
