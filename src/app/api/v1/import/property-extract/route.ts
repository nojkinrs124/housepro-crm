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
 * Выписка ЕГРН или свидетельство о праве собственности: одной транзакцией заводит
 * объект и, если в документе есть раздел о правах, — правообладателя как контакт
 * с ролью owner, сразу связывая их через properties.owner_id.
 * Повторная загрузка той же выписки не создаёт дубль: объект ищется по
 * кадастровому номеру, пустые поля дополняются, заполненные не затираются.
 */
export async function POST(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.property?.address) {
    return NextResponse.json({ error: 'property.address обязателен' }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin.rpc('import_property_extract', {
    p_org_id: auth.orgId,
    p_property: body.property,
    p_owner: body.owner ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
