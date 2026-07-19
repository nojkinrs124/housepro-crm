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
 * Атомарный импорт из одного документа (например, скана договора аренды): создаёт
 * (или переиспользует существующих по телефону) собственника и арендатора, объект
 * недвижимости, и сделку — сразу связывая их всеми нужными внешними ключами.
 * Вся логика — в Postgres-функции import_rental_contract (одна транзакция), чтобы
 * не было ситуации "контакт создался, а сделка — нет" при частичном сбое.
 */
export async function POST(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.owner || !body?.tenant || !body?.property) {
    return NextResponse.json({ error: 'owner, tenant и property обязательны' }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin.rpc('import_rental_contract', {
    p_org_id: auth.orgId,
    p_owner: body.owner,
    p_tenant: body.tenant,
    p_property: body.property,
    p_deal: body.deal ?? {},
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
