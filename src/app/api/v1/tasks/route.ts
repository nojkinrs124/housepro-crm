import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'
import { TaskCreateSchema, TaskStatusUpdateSchema } from '@/lib/schemas/tasks-api'
import { writeAuditLogServiceRole } from '@/lib/audit'
import { dispatchWebhook } from '@/lib/webhooks'

// КРИТИЧНО: этот роут отдаёт данные, специфичные для конкретной организации/пользователя
// (RLS или ручная фильтрация по organization_id). Next.js по умолчанию может закэшировать
// GET Route Handler и отдать один и тот же ответ разным пользователям/организациям по
// одному URL — это утечка данных между тенантами. force-dynamic отключает это кэширование.
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) } }
  )
}

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'read')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const offset = Number(searchParams.get('offset') ?? 0)
  const status = searchParams.get('status')
  // due_before — быстрый фильтр "что горит": передать сегодняшнюю дату, чтобы получить
  // всё просроченное + сегодняшнее одним запросом (используется list_tasks-инструментом бота).
  const dueBefore = searchParams.get('due_before')

  let query = supabaseAdmin
    .from('tasks')
    .select('id, title, description, priority, status, deadline, deal_id, lead_id, property_id, created_at', { count: 'exact' })
    .eq('organization_id', auth.orgId)
    .order('deadline', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  else query = query.in('status', ['todo', 'in_progress'])
  if (dueBefore) query = query.lte('deadline', dueBefore)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, meta: { total: count, limit, offset } })
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope (write required)' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = TaskCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert({
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      deadline: parsed.data.deadline,
      deal_id: parsed.data.deal_id,
      lead_id: parsed.data.lead_id,
      property_id: parsed.data.property_id,
      contract_id: parsed.data.contract_id,
      status: 'todo',
      organization_id: auth.orgId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLogServiceRole(supabaseAdmin, {
    orgId: auth.orgId!,
    action: 'create',
    entityType: 'task',
    entityId: data.id,
    entityLabel: `Задача создана через Telegram-бота: ${data.title}`,
  })
  dispatchWebhook(auth.orgId!, 'task.created', { id: data.id, title: data.title })

  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('id')
  if (!taskId) return NextResponse.json({ error: 'Query param "id" is required' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = TaskStatusUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('tasks')
    .select('id, title, status')
    .eq('id', taskId)
    .eq('organization_id', auth.orgId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update({ status: parsed.data.status })
    .eq('id', taskId)
    .eq('organization_id', auth.orgId)
    .select('id, title, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLogServiceRole(supabaseAdmin, {
    orgId: auth.orgId!,
    action: 'update',
    entityType: 'task',
    entityId: taskId,
    entityLabel: `Задача «${existing.title}»: статус изменён через Telegram-бота`,
    changes: { status: { old: existing.status, new: parsed.data.status } },
  })
  if (parsed.data.status === 'done') dispatchWebhook(auth.orgId!, 'task.completed', { id: taskId, title: existing.title })

  return NextResponse.json({ data })
}
