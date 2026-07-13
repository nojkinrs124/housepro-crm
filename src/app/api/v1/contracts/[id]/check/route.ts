import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'
import { buildContractVariables, type ContractVariables } from '@/features/contracts/services/document.service'

// Node runtime по умолчанию — не менять на edge.
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) } }
  )
}

const RISK_PROMPT = `Ты — юрист, специализирующийся на договорах в сфере аренды и продажи недвижимости в РФ.
Тебе дан набор данных заполненного договора (переменные шаблона). Проверь на:
- пропущенные обязательные данные (паспорт, адрес, суммы прописью и т.д. — помечены "___" или "—")
- несоответствие дат (окончание раньше начала и т.п.)
- отсутствие суммы залога/арендной платы там, где она ожидается
- явные логические противоречия
Ответь кратко, по-русски, списком найденных рисков. Если рисков нет — так и напиши одной фразой.`

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'read')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const { id } = await params
  const supabaseAdmin = getSupabaseAdmin()

  const { data: contract } = await supabaseAdmin
    .from('contracts')
    .select('id')
    .eq('id', id)
    .eq('organization_id', auth.orgId)
    .maybeSingle()

  if (!contract) return NextResponse.json({ error: 'Договор не найден' }, { status: 404 })

  let variables: ContractVariables
  try {
    variables = await buildContractVariables(id, supabaseAdmin)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка построения данных договора' }, { status: 500 })
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-5',
      messages: [
        { role: 'system', content: RISK_PROMPT },
        { role: 'user', content: JSON.stringify(variables) },
      ],
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: `OpenRouter error: ${await res.text()}` }, { status: 502 })
  }

  const completion = await res.json()
  const analysis = completion.choices?.[0]?.message?.content ?? 'Не удалось получить анализ.'

  return NextResponse.json({ data: { analysis } })
}
