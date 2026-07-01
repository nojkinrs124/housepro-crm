import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// КРИТИЧНО: этот роут отдаёт данные, специфичные для конкретной организации/пользователя
// (RLS или ручная фильтрация по organization_id). Next.js по умолчанию может закэшировать
// GET Route Handler и отдать один и тот же ответ разным пользователям/организациям по
// одному URL — это утечка данных между тенантами. force-dynamic отключает это кэширование.
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId, company_type, inn } = await request.json()

  await supabase.from('company_settings')
    .upsert(
      { company_type, inn: inn?.trim() || null, organization_id: orgId, is_default: true },
      { onConflict: 'organization_id', ignoreDuplicates: false }
    )

  return NextResponse.json({ success: true })
}
