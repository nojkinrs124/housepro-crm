import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { normalizePhone, clientIp } from '@/lib/utils'
import { notifyNewLead } from '@/lib/telegram/notify-lead'
import { consentFields } from '@/lib/consent'
import type { Json } from '@/types/supabase'
import {
  DISTRICTS,
  ROOMS_NUMBER,
  ROOMS_OPTIONS,
  TARIFF_IDS,
  USLUGI_LEAD_SOURCES,
} from '@/features/site/uslugi/config'
import { calculateIncome } from '@/features/site/uslugi/calc'
import { describeLeadContext, type UslugiLeadContext } from '@/features/site/uslugi/lead-context'

/**
 * Приём заявок с публичного сайта «ХаусПро».
 *
 * Почему Route Handler, а не anon-policy на `leads`: INSERT-политика для роли
 * anon открыла бы запись в таблицу с персональными данными кому угодно с
 * ANON_KEY (он публичен по определению) — вплоть до массового залива мусора и
 * подбора существующих organization_id. Здесь вставка идёт service-role
 * клиентом (bypass RLS) после валидации, honeypot и rate limit по IP.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PUBLIC_LEAD_SOURCES = ['website', ...Object.values(USLUGI_LEAD_SOURCES)] as const

const LeadRequestSchema = z.object({
  name: z.string().trim().min(2, 'Укажите имя').max(120, 'Слишком длинное имя'),
  phone: z
    .string()
    .trim()
    .min(6, 'Укажите телефон')
    .max(30, 'Некорректный телефон')
    .refine(v => normalizePhone(v) !== null, { message: 'Некорректный телефон' }),
  email: z
    .string()
    .trim()
    .max(160)
    .email('Некорректный email')
    .optional()
    .or(z.literal('')),
  message: z.string().trim().max(2000, 'Сообщение слишком длинное').optional().or(z.literal('')),
  property_id: z
    .string()
    .trim()
    .refine(v => v === '' || UUID_RE.test(v), { message: 'Некорректный объект' })
    .optional()
    .or(z.literal('')),
  /**
   * Honeypot: настоящий человек это поле не видит и не заполняет.
   * Схема его НЕ отклоняет намеренно — заполненный honeypot обрабатывается
   * ниже как «молчаливый успех». Если бы zod возвращал здесь 400, бот сразу
   * понял бы, какое поле его выдало, и перестал бы его заполнять.
   */
  company: z.string().max(200).optional().or(z.literal('')),
  /**
   * Согласие на обработку ПДн (152-ФЗ). Обязательное: без него заявку
   * принимать нельзя — именно эта отметка вместе с временем и версией
   * политики доказывает, что человек согласие давал.
   */
  consent: z.literal(true, { message: 'Нужно согласие на обработку персональных данных' }),
  /**
   * Источник лида — только из allowlist. Значение с сайта не доверяем
   * вслепую: иначе форму можно использовать, чтобы писать в CRM любые метки.
   */
  source: z.enum(PUBLIC_LEAD_SOURCES).optional(),
  /** Путь страницы, с которой ушла заявка — для metadata */
  page: z.string().trim().max(120).optional().or(z.literal('')),
  /**
   * Контекст со страниц раздела «Услуги»: тариф, район, комнатность, ставка.
   * Суммы калькулятора сюда не принимаем — пересчитываем из ставки на сервере.
   */
  context: z
    .object({
      intent: z.enum(['tariff', 'calculator', 'document_sample', 'sticky_bar', 'hero']).optional(),
      tariffId: z.enum(TARIFF_IDS as [string, ...string[]]).optional(),
      district: z.enum(DISTRICTS).optional(),
      rooms: z.enum(ROOMS_OPTIONS.map(o => o.key) as [string, ...string[]]).optional(),
      rate: z.number().int().min(0).max(10_000_000).optional(),
      documentId: z.string().trim().max(60).optional(),
    })
    .strict()
    .optional(),
})

/**
 * Собирает из контекста страницы: комментарий (текст для агента), колонки
 * лида (район/комнаты/ставка — их показывают доска и карточка лида) и
 * структурный metadata для аналитики. Суммы считаются здесь заново.
 */
function buildLeadContext(
  ctx: UslugiLeadContext | undefined,
  page: string | undefined,
  source: string,
  message: string | undefined
) {
  const contextLines = ctx ? describeLeadContext(ctx) : []
  const commentParts = [message?.trim() || null]
  if (contextLines.length) commentParts.push(['— Со страницы сайта —', ...contextLines].join('\n'))
  const comment = commentParts.filter(Boolean).join('\n\n') || null

  const isRentPage = source === USLUGI_LEAD_SOURCES.sdatKvartiru || source === USLUGI_LEAD_SOURCES.snyat

  const metadata: Json | null =
    ctx || page
      ? {
          page: page || null,
          intent: ctx?.intent ?? null,
          tariffId: ctx?.tariffId ?? null,
          district: ctx?.district ?? null,
          rooms: ctx?.rooms ?? null,
          rate: ctx?.rate ?? null,
          documentId: ctx?.documentId ?? null,
          calc: ctx?.rate ? (calculateIncome(ctx.rate) as unknown as Json) : null,
        }
      : null

  return {
    comment,
    metadata,
    district: ctx?.district ?? null,
    rooms: ctx?.rooms ? ROOMS_NUMBER[ctx.rooms] : null,
    budget_min: ctx?.rate && ctx.rate > 0 ? ctx.rate : null,
    deal_type: isRentPage ? 'rent' : source === USLUGI_LEAD_SOURCES.prodat ? 'sale' : null,
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export async function POST(request: Request) {
  // Тот же graceful-подход, что и в rate-limit.ts: локально без service-role
  // ключа роут отвечает понятной 503, а не роняет билд и не падает 500.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const ip = clientIp(request)
  const rl = await rateLimit(`public-lead:${ip}`, { limit: 5, windowSeconds: 60 })
  if (!rl.success) {
    return json(
      { error: 'Слишком много заявок подряд. Попробуйте через минуту или позвоните нам.' },
      429
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Некорректный запрос' }, 400)
  }

  const parsed = LeadRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? 'Проверьте заполнение формы' }, 400)
  }

  const { name, phone, email, message, property_id, company, source, page, context } = parsed.data

  // Honeypot заполнен — это бот. Отвечаем как при успехе, чтобы не подсказывать.
  if (company) return json({ ok: true }, 200)

  if (!serviceKey || !supabaseUrl) {
    console.error('[public/leads] SUPABASE_SERVICE_ROLE_KEY не задан — приём заявок отключён')
    return json({ error: 'Форма временно недоступна. Позвоните нам, пожалуйста.' }, 503)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const propertyId = property_id && property_id !== '' ? property_id : null

  // organization_id заявки. Если заявка по конкретному объекту — берём
  // организацию этого объекта; иначе — единственную организацию в системе.
  // ВАЖНО: когда появится настоящий мульти-тенант (у каждого агентства свой
  // поддомен/домен), «первая организация» перестанет быть корректной —
  // организацию нужно будет определять по хосту запроса.
  let organizationId: string | null = null
  let resolvedPropertyId: string | null = null

  if (propertyId) {
    const { data: property } = await supabase
      .from('properties')
      .select('organization_id, site_publish')
      .eq('id', propertyId)
      .maybeSingle()

    // Заявку можно привязать только к объекту, который реально опубликован на
    // сайте — иначе форму можно использовать как оракул существования объектов.
    if (property?.site_publish) {
      organizationId = property.organization_id as string
      resolvedPropertyId = propertyId
    }
  }

  if (!organizationId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    organizationId = (org?.id as string | undefined) ?? null
  }

  if (!organizationId) {
    console.error('[public/leads] не найдена организация для заявки с сайта')
    return json({ error: 'Не удалось отправить заявку. Позвоните нам, пожалуйста.' }, 500)
  }

  const normalizedPhone = normalizePhone(phone)
  const leadSource = source ?? 'website'
  const fromPage = buildLeadContext(
    context as UslugiLeadContext | undefined,
    page || undefined,
    leadSource,
    message
  )

  const { data: insertedLead, error } = await supabase
    .from('leads')
    .insert({
      organization_id: organizationId,
      full_name: name,
      phone: normalizedPhone,
      email: email || null,
      comment: fromPage.comment,
      district: fromPage.district,
      rooms: fromPage.rooms,
      budget_min: fromPage.budget_min,
      deal_type: fromPage.deal_type,
      metadata: fromPage.metadata,
      property_id: resolvedPropertyId,
      source: leadSource,
      status: 'new',
      // Отметка согласия: время + версия политики, с которой согласился человек.
      ...consentFields('site_form'),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[public/leads] insert failed:', error.message)
    return json({ error: 'Не удалось отправить заявку. Позвоните нам, пожалуйста.' }, 500)
  }

  // Не должно блокировать ответ посетителю сайта надолго и не должно ронять
  // заявку при сбое Telegram — notifyNewLead сама гасит любые исключения.
  await notifyNewLead(organizationId, {
    id: insertedLead.id, full_name: name, phone: normalizedPhone, source: leadSource,
  })

  return json({ ok: true }, 201)
}
