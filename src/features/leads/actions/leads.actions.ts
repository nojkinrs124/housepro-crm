'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionContext, requireOrgId } from '@/lib/org'
import { dispatchWebhook } from '@/lib/webhooks'
import { requirePermission } from '@/lib/permissions'
import { normalizePhone } from '@/lib/utils'
import { notifyNewLead } from '@/lib/telegram/notify-lead'
import { emailLeadAssigned } from '@/lib/email/send'
import { LEAD_STATUS_LABELS, LEAD_STATUS_VALUES } from '@/features/leads/config/lead-statuses'
import { contactRoleForLead } from '@/features/leads/config/lead-deal-types'
import { friendlyDbError } from '@/lib/errors'
import { localDateTimeToIso } from '@/lib/timezone'

const VALID_STATUSES = LEAD_STATUS_VALUES


type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Текст предупреждения, если телефон уже есть у лида или контакта организации.
 * Null — дублей нет. Ищем по нормализованному номеру, как он хранится.
 */
async function findDuplicateByPhone(supabase: Supabase, phone: string | null): Promise<string | null> {
  if (!phone) return null
  const [{ data: leads }, { data: contacts }] = await Promise.all([
    supabase.from('leads').select('id, full_name, status').eq('phone', phone).limit(1),
    supabase.from('contacts').select('id, full_name').eq('phone', phone).is('merged_into', null).limit(1),
  ])
  const lead = leads?.[0]
  if (lead) {
    return `Лид с телефоном ${phone} уже есть: «${lead.full_name || 'без имени'}» (${LEAD_STATUS_LABELS[lead.status] ?? lead.status}). Откройте его в списке лидов — или отметьте «Это повторное обращение», чтобы завести новый.`
  }
  const contact = contacts?.[0]
  if (contact) {
    return `Контакт с телефоном ${phone} уже есть: «${contact.full_name || 'без имени'}». Создайте сделку с карточки контакта — или отметьте «Это повторное обращение», чтобы завести новый лид.`
  }
  return null
}

function extractLeadFields(formData: FormData, userId?: string) {
  return {
    full_name:       (formData.get('full_name')  as string)?.trim() || null,
    phone:           normalizePhone(formData.get('phone') as string),
    email:           (formData.get('email')       as string)?.trim() || null,
    telegram:        (formData.get('telegram')    as string)?.trim() || null,
    whatsapp:        (formData.get('whatsapp')    as string)?.trim() || null,
    source:          (formData.get('source')      as string) || null,
    comment:         (formData.get('comment')     as string)?.trim() || null,
    deal_type:       (formData.get('deal_type')   as string) || null,
    property_type:   (formData.get('property_type') as string) || null,
    rooms:           formData.get('rooms')      ? Number(formData.get('rooms'))      : null,
    budget_min:      formData.get('budget_min') ? Number(formData.get('budget_min')) : null,
    budget_max:      formData.get('budget_max') ? Number(formData.get('budget_max')) : null,
    area_min:        formData.get('area_min')   ? Number(formData.get('area_min'))   : null,
    area_max:        formData.get('area_max')   ? Number(formData.get('area_max'))   : null,
    district:        (formData.get('district')    as string)?.trim() || null,
    next_contact_at: localDateTimeToIso(formData.get('next_contact_at') as string),
    assigned_to:     (formData.get('assigned_to') as string) || userId || null,
  }
}

export async function createLeadAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const fields = extractLeadFields(formData, user.id)

  const permError = await requirePermission(user.id, 'leads', 'create')
  if (permError) return permError

  // Подсказка под полем обещает предупредить о дубле — держим слово: второй
  // лид с тем же телефоном не создаём молча (проход 17.09.2026, L-2).
  const duplicate = await findDuplicateByPhone(supabase, fields.phone)
  if (duplicate && formData.get('allow_duplicate') !== 'on') return { error: duplicate }

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({ ...fields, status: 'new', organization_id: orgId })
    .select()
    .single()

  if (error) return { error: friendlyDbError(error, { entity: 'лид' }) }

  dispatchWebhook(orgId, 'lead.created', {
    id: lead.id, full_name: lead.full_name, phone: lead.phone, source: lead.source,
  })

  // Ждём отправку — сам notifyNewLead не бросает исключений при сбое Telegram,
  // а await страхует от обрыва serverless-функции до вылета запроса (в отличие
  // от dispatchWebhook выше, здесь нет внешнего ретрая, если функция не успеет).
  await notifyNewLead(orgId, {
    id: lead.id, full_name: lead.full_name, phone: lead.phone, source: lead.source,
  })

  // Второй канал: письмо тому, на кого лид назначен. Telegram выше уходит в общий
  // чат агентства, письмо — персонально ответственному.
  await emailLeadAssigned(orgId, lead, user.id)

  revalidatePath('/leads')
  redirect(`/leads/${lead.id}`)
}

export async function updateLeadAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const fields = extractLeadFields(formData)

  const permError = await requirePermission(user.id, 'leads', 'update')
  if (permError) return permError

  // Конвертированный лид — история: правки в нём не попадут в контакт и
  // создадут расхождение (проход 17.09.2026, L-11).
  const { data: current } = await supabase.from('leads').select('status, contact_id').eq('id', id).maybeSingle()
  if (current?.status === 'converted') {
    return { error: current.contact_id
      ? 'Лид уже переведён в контакт — редактируйте карточку контакта, лид остаётся историей обращения'
      : 'Лид уже переведён в контакт — редактируйте карточку контакта' }
  }

  const { error } = await supabase
    .from('leads')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: friendlyDbError(error, { entity: 'лид' }) }

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
  redirect(`/leads/${id}`)
}

/**
 * Общая форма ответа перетаскивания на Kanban-доске: клиенту нужно знать
 * только, откатывать ли оптимистичное перемещение карточки.
 */
export interface StatusUpdateResult {
  error?: string
  success?: boolean
}

export async function updateLeadStatusAction(
  id: string,
  status: string
): Promise<StatusUpdateResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }
  if (!VALID_STATUSES.includes(status)) return { error: `Недопустимый статус: ${status}` }

  const permError = await requirePermission(user.id, 'leads', 'update')
  if (permError) return permError

  // «Конвертирован» ставится только настоящей конвертацией («В контакты») и
  // обратно не снимается: иначе лид выглядит клиентом без контакта или
  // конвертируется второй раз (проход 17.09.2026, L-3/L-9).
  if (status === 'converted') {
    return { error: 'Статус «Конвертирован» ставится кнопкой «В контакты» — так создаётся контакт' }
  }
  const { data: current } = await supabase.from('leads').select('status').eq('id', id).maybeSingle()
  if (current?.status === 'converted') {
    return { error: 'Лид уже переведён в контакт — дальше работа идёт в карточке контакта' }
  }

  const { error } = await supabase
    .from('leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: friendlyDbError(error, { entity: 'лид' }) }

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
  return { success: true }
}

export async function addLeadActivityAction(formData: FormData) {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const lead_id = formData.get('lead_id') as string
  const type    = formData.get('type') as string
  const content = (formData.get('content') as string)?.trim() || null
  const result  = (formData.get('result')  as string)?.trim() || null
  const scheduled_at = localDateTimeToIso(formData.get('scheduled_at') as string)

  if (!lead_id || !type) return { error: 'Некорректные данные' }

  const permError = await requirePermission(user.id, 'leads', 'update')
  if (permError) return permError

  const { error } = await supabase.from('lead_activities').insert({
    lead_id, user_id: user.id, type, content, result, scheduled_at,
    organization_id: orgId,
  })

  if (error) return { error: friendlyDbError(error, { entity: 'лид' }) }

  if (scheduled_at) {
    await supabase.from('leads').update({
      next_contact_at: scheduled_at,
      updated_at: new Date().toISOString(),
    }).eq('id', lead_id)
  }

  revalidatePath(`/leads/${lead_id}`)
  return { success: true }
}

export async function convertLeadToClient(id: string) {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const { data: lead } = await supabase.from('leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Лид не найден' }

  const permError = await requirePermission(user.id, 'leads', 'update')
  if (permError) return permError

  const l = lead

  // Повторная конвертация невозможна: контакт уже есть — идём в него.
  if (l.status === 'converted' && l.contact_id) redirect(`/contacts/${l.contact_id}`)

  // Роль — по тому, чего хотел лид: «сдать/продать» — собственник,
  // «снять/купить» — клиент (проход 17.09.2026, L-9: всегда был клиент, и
  // собственник не попадал в список при создании объекта).
  const role = contactRoleForLead(l.deal_type)

  // Телефон уже есть у контакта — используем его, а не создаём дубль (L-10).
  const { data: existing } = l.phone
    ? await supabase.from('contacts').select('id, role').eq('phone', l.phone).is('merged_into', null).limit(1)
    : { data: null }

  let contactId: string
  if (existing?.[0]) {
    contactId = existing[0].id
    if (existing[0].role !== role && existing[0].role !== 'both') {
      await supabase.from('contacts').update({ role: 'both', updated_at: new Date().toISOString() }).eq('id', contactId)
    }
  } else {
    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        full_name: l.full_name || 'Без имени',
        phone:     l.phone    || null,
        email:     l.email    || null,
        telegram:  l.telegram || null,
        whatsapp:  l.whatsapp || null,
        source:    l.source   || null,
        comment:   l.comment  || null,
        role,
        status: 'new',
        organization_id: orgId,
      })
      .select('id')
      .single()
    if (error) return { error: friendlyDbError(error, { entity: 'лид' }) }
    contactId = contact.id
  }

  await supabase
    .from('leads')
    .update({ status: 'converted', contact_id: contactId, updated_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
  revalidatePath('/contacts')
  redirect(`/contacts/${contactId}`)
}

export async function deleteLeadAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const permError = await requirePermission(user.id, 'leads', 'delete')
  if (permError) return permError

  // Результат раньше не проверялся — при отказе RLS всё равно шёл redirect.
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return { error: friendlyDbError(error, { entity: 'лид', verb: 'удалить' }) }

  revalidatePath('/leads')
  redirect('/leads')
}
