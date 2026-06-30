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
  const status = searchParams.get('status')
  const dealType = searchParams.get('deal_type')

  let query = supabaseAdmin
    .from('properties')
    .select('id, title, address, deal_type, property_type, price, area_total, rooms, status, created_at', { count: 'exact' })
    .eq('organization_id', auth.orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status)   query = query.eq('status', status)
  if (dealType) query = query.eq('deal_type', dealType)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, meta: { total: count, limit, offset } })
}
