'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimitMutation } from '@/lib/rate-limit'
import { isValidEmail } from '@/lib/email/provider'
import { sendShowingScheduledEmail } from '@/lib/email/send'
import { addMinutes, buildSingleEventIcs } from '@/lib/calendar/ics'

interface ShowingRow {
  id: string
  scheduled_at: string
  duration_min: number | null
  organization_id: string
  properties: { title: string | null; address: string | null } | null
  contacts: { full_name: string | null; email: string | null } | null
  leads: { full_name: string | null; email: string | null } | null
  users: { full_name: string | null; phone: string | null } | null
}

/**
 * Отправляет клиенту подтверждение показа письмом с вложением .ics.
 *
 * Вложение важнее текста: клиент добавляет показ в календарь одним нажатием
 * и получает напоминание сам — это заметно снижает долю «забыл и не пришёл».
 */
export async function sendShowingInviteAction(showingId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const rl = await rateLimitMutation(user.id, 'showing_invite')
  if (!rl.success) return { error: 'Слишком много запросов. Подождите минуту.' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const permError = await requirePermission(user.id, 'showings', 'read')
  if (permError) return permError

  const { data, error } = await supabase
    .from('showings')
    .select(
      `id, scheduled_at, duration_min, organization_id,
       properties:property_id ( title, address ),
       contacts:contact_id ( full_name, email ),
       leads:lead_id ( full_name, email ),
       users:agent_id ( full_name, phone )`
    )
    .eq('id', showingId)
    .single()

  if (error || !data) return { error: 'Показ не найден' }
  const showing = data as unknown as ShowingRow

  const explicit = (formData.get('email') as string)?.trim()
  const to = explicit || showing.contacts?.email || showing.leads?.email || ''
  if (!isValidEmail(to)) {
    return { error: 'Укажите email получателя — в карточке клиента адрес не заполнен' }
  }

  const start = new Date(showing.scheduled_at)
  if (Number.isNaN(start.getTime())) return { error: 'У показа некорректная дата' }

  const address = showing.properties?.address ?? null
  const ics = buildSingleEventIcs({
    uid: `showing-${showing.id}@housepro`,
    start,
    end: addMinutes(start, showing.duration_min ?? 30),
    summary: `Показ: ${showing.properties?.title ?? address ?? 'объект'}`,
    location: address,
    description: showing.users?.full_name ? `Агент: ${showing.users.full_name}` : null,
    reminderMinutes: 120,
  })

  const result = await sendShowingScheduledEmail({
    orgId,
    to,
    showingId: showing.id,
    scheduledAt: showing.scheduled_at,
    address,
    agentName: showing.users?.full_name ?? null,
    agentPhone: showing.users?.phone ?? null,
    icsContent: ics,
  })

  if (!result.ok) return { error: result.error ?? 'Не удалось отправить письмо' }
  if (result.skipped) {
    return { error: 'Почта не настроена: задайте RESEND_API_KEY или UNISENDER_API_KEY в окружении' }
  }

  return { success: true, message: `Приглашение отправлено на ${to}` }
}
