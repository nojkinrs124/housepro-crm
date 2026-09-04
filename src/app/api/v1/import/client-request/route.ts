import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) } }
  )
}

/**
 * Заявка из документа (анкета, заявление, скан паспорта, заявка с сайта на бумаге):
 * одной транзакцией заводит контакт и лид. Контакт ищется по нормализованному
 * телефону — один и тот же документ, присланный дважды, не плодит карточки.
 * Логика в Postgres-функции import_client_request, как у rental-contract.
 */
export async function POST(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.contact?.full_name) {
    return NextResponse.json({ error: 'contact.full_name обязателен' }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin.rpc('import_client_request', {
    p_org_id: auth.orgId,
    p_contact: body.contact,
    p_lead: body.lead ?? {},
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
