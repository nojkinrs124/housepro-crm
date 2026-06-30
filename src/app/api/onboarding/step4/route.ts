import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId, full_name, phone, userId } = await request.json()
  if (!full_name?.trim()) return NextResponse.json({ success: true })

  const { error } = await supabase.from('leads').insert({
    full_name: full_name.trim(),
    phone: phone?.trim() || null,
    status: 'new',
    assigned_to: userId,
    organization_id: orgId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
