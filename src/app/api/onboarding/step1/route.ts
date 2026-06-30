import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId, name, phone } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })

  const { error } = await supabase
    .from('organizations')
    .update({ name: name.trim() })
    .eq('id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Save phone to company_settings if provided
  if (phone?.trim()) {
    await supabase.from('company_settings').upsert(
      { name: name.trim(), phone: phone.trim(), organization_id: orgId, is_default: true },
      { onConflict: 'organization_id', ignoreDuplicates: false }
    )
  }

  return NextResponse.json({ success: true })
}
