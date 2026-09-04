import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { clientIp } from '@/lib/utils'
import { addMinutes, buildCalendar, type CalendarEvent } from '@/lib/calendar/ics'
import { getSiteUrl } from '@/lib/telegram/site-url'

export const dynamic = 'force-dynamic'

// Подписной календарь сотрудника: показы и задачи с дедлайном.
//
// Роут публичный — авторизация здесь по секретному токену из ссылки, потому что
// Google Calendar и Apple Calendar ходят за фидом сервер-к-серверу и не умеют
// показывать форму входа. Токен отзывается в профиле, если ссылка утекла.
//
// Отдаём окно «месяц назад — полгода вперёд»: прошлое нужно, чтобы в календаре
// осталась история встреч, а бесконечный горизонт раздувает фид без пользы.

const PAST_DAYS = 30
const FUTURE_DAYS = 180
/** Задача без времени — ставим на 10:00, иначе календари рисуют её в полночь. */
const TASK_DEFAULT_HOUR = 10

const SHOWING_STATUS: Record<string, CalendarEvent['status']> = {
  planned: 'CONFIRMED',
  completed: 'CONFIRMED',
  cancelled: 'CANCELLED',
  no_show: 'CANCELLED',
}

interface ShowingRow {
  id: string
  scheduled_at: string
  duration_min: number | null
  status: string
  feedback: string | null
  next_step: string | null
  properties: { title: string | null; address: string | null } | null
  contacts: { full_name: string | null; phone: string | null } | null
}

interface TaskRow {
  id: string
  title: string
  description: string | null
  deadline: string | null
  status: string
  priority: string
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params

  if (!token || token.length < 16) {
    return new Response('Not found', { status: 404 })
  }

  // Единственная защита фида — секретность токена, значит его будут перебирать.
  // Календарь опрашивает подписку раз в несколько часов, так что живому клиенту
  // тридцати запросов в минуту хватает с большим запасом.
  const rl = await rateLimit(`ical:${clientIp(request)}`, { limit: 30, windowSeconds: 60 })
  if (!rl.success) return new Response('Too many requests', { status: 429 })

  // Календари ходят сюда без авторизации; на любой сбой отвечаем 404,
  // а не 500 — иначе подписка в Google Calendar показывает ошибку сервера.
  let supabase
  let user = null
  try {
    supabase = getSupabaseAdmin()
    const result = await supabase
      .from('users')
      .select('id, full_name, organization_id')
      .eq('ical_token', token)
      .maybeSingle()
    user = result.data
  } catch (e) {
    console.error('[ical] не удалось проверить токен:', e)
  }

  if (!user || !supabase) return new Response('Not found', { status: 404 })

  const from = new Date()
  from.setDate(from.getDate() - PAST_DAYS)
  const to = new Date()
  to.setDate(to.getDate() + FUTURE_DAYS)

  const [{ data: showings }, { data: tasks }] = await Promise.all([
    supabase
      .from('showings')
      .select(
        `id, scheduled_at, duration_min, status, feedback, next_step,
         properties:property_id ( title, address ),
         contacts:contact_id ( full_name, phone )`
      )
      .eq('agent_id', user.id)
      .gte('scheduled_at', from.toISOString())
      .lte('scheduled_at', to.toISOString())
      .limit(500),
    supabase
      .from('tasks')
      .select('id, title, description, deadline, status, priority')
      .eq('assigned_to', user.id)
      .not('deadline', 'is', null)
      .gte('deadline', from.toISOString())
      .lte('deadline', to.toISOString())
      .neq('status', 'cancelled')
      .limit(500),
  ])

  const siteUrl = getSiteUrl()
  const events: CalendarEvent[] = []

  for (const row of (showings ?? []) as unknown as ShowingRow[]) {
    const start = new Date(row.scheduled_at)
    if (Number.isNaN(start.getTime())) continue

    const property = row.properties
    const contact = row.contacts
    const description = [
      contact?.full_name ? `Клиент: ${contact.full_name}` : null,
      contact?.phone ? `Телефон: ${contact.phone}` : null,
      row.next_step ? `Следующий шаг: ${row.next_step}` : null,
      row.feedback ? `Отзыв: ${row.feedback}` : null,
      `${siteUrl}/showings/${row.id}`,
    ]
      .filter(Boolean)
      .join('\n')

    events.push({
      uid: `showing-${row.id}@housepro`,
      start,
      end: addMinutes(start, row.duration_min ?? 30),
      summary: `Показ: ${property?.title ?? property?.address ?? 'объект'}`,
      location: property?.address ?? null,
      description,
      url: `${siteUrl}/showings/${row.id}`,
      status: SHOWING_STATUS[row.status] ?? 'CONFIRMED',
      reminderMinutes: 60,
    })
  }

  for (const row of (tasks ?? []) as TaskRow[]) {
    if (!row.deadline) continue
    const raw = new Date(row.deadline)
    if (Number.isNaN(raw.getTime())) continue

    // Дедлайн часто хранится датой без времени — не ставим такие задачи в полночь.
    const start = new Date(raw)
    if (start.getUTCHours() === 0 && start.getUTCMinutes() === 0) {
      start.setUTCHours(TASK_DEFAULT_HOUR, 0, 0, 0)
    }

    events.push({
      uid: `task-${row.id}@housepro`,
      start,
      end: addMinutes(start, 30),
      summary: `Задача: ${row.title}`,
      description: [row.description, `${siteUrl}/tasks/${row.id}`].filter(Boolean).join('\n'),
      url: `${siteUrl}/tasks/${row.id}`,
      status: row.status === 'done' ? 'CONFIRMED' : 'TENTATIVE',
      reminderMinutes: row.priority === 'high' ? 120 : 0,
    })
  }

  const body = buildCalendar(events, `HousePro — ${user.full_name || 'календарь'}`)

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="housepro.ics"',
      // Календари опрашивают фид часто; короткий кэш снимает нагрузку,
      // но не даёт расписанию заметно устареть.
      'Cache-Control': 'private, max-age=300',
    },
  })
}
