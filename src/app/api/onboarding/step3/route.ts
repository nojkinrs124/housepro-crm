import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId, title, address, property_type, userId } = await request.json()
  if (!title?.trim()) return NextResponse.json({ success: true })

  const { error } = await supabase.from('properties').insert({
    title: title.trim(),
    address: address?.trim() || null,
    property_type: property_type || 'apartment',
    status: 'available',
    deal_type: 'sale',
    manager_id: userId,
    organization_id: orgId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
