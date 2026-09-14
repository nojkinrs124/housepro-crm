import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { rateLimit } from '@/lib/rate-limit'
import { env } from '@/lib/env'
import { LISTING_SYSTEM_PROMPT, buildUserPrompt } from '@/lib/ai/listing/prompt'

// Генерация объявления по объекту через OpenRouter — стрим чистого текста.
//
// Ответ OpenRouter (SSE) разбираем здесь и отдаём клиенту только дельты
// текста как text/plain — клиенту не нужно знать формат SSE. Ключ OpenRouter
// живёт только на сервере, поэтому браузер ходит через этот роут, а не напрямую.
// Стрим держится дольше обычного запроса — отсюда maxDuration и nodejs runtime.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BodySchema = z.object({
  propertyId: z.string().uuid('Некорректный идентификатор объекта'),
  rawInput: z.string().max(8000, 'Вводные слишком длинные — не больше 8000 символов'),
})

// Отдельная переменная для модели объявлений: можно переопределить в Vercel,
// не трогая модель бота. Читается напрямую с дефолтом — в env.ts через
// requireEnv() не добавлять (уронит все страницы, если переменной нет).
function getListingModel(): string {
  return process.env.OPENROUTER_LISTING_MODEL ?? process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-5'
}

// Одной строкой-литералом: из конкатенации PostgREST-типы не выводят колонки,
// а здесь важно, чтобы tsc поймал расхождение со схемой.
const LISTING_PROPERTY_COLUMNS = 'title, property_type, deal_type, address, district, metro, rooms, area, living_area, kitchen_area, floor, total_floors, ceiling_height, house_type, wall_material, year_built, has_elevator, has_parking, has_internet, has_tv, heating_type, water_supply_type, price, deposit, utilities_included, land_area, video_url, description'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const permError = await requirePermission(user.id, 'properties', 'update')
  if (permError) return NextResponse.json(permError, { status: 403 })

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return NextResponse.json({ error: 'Организация не найдена' }, { status: 403 })

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'Генерация не настроена: нет ключа OpenRouter' }, { status: 503 })
  }

  // 10 генераций за 10 минут: каждая — платный вызов модели на ~3000 символов.
  const rl = await rateLimit(`ai-listing:${user.id}`, { limit: 10, windowSeconds: 600 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Слишком много генераций — подождите несколько минут' }, { status: 429 })
  }

  const json = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { propertyId, rawInput } = parsed.data

  // Параметрам объекта с клиента не доверяем — читаем из БД с проверкой организации.
  const { data: property } = await supabase
    .from('properties')
    .select(LISTING_PROPERTY_COLUMNS)
    .eq('id', propertyId)
    .eq('organization_id', orgId)
    .single()
  if (!property) return NextResponse.json({ error: 'Объект не найден' }, { status: 404 })

  const model = getListingModel()

  // Обрыв клиента (закрыли модалку, «Стоп») должен остановить и запрос к модели:
  // иначе платим за хвост генерации, который никто не прочитает. Свой контроллер —
  // потому что cancel() стрима и request.signal срабатывают в разных случаях.
  const upstreamAbort = new AbortController()
  request.signal.addEventListener('abort', () => upstreamAbort.abort())

  let upstream: Response
  try {
    upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': env.siteUrl,
        'X-Title': 'HousePro CRM',
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.7,
        messages: [
          { role: 'system', content: LISTING_SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(property, rawInput) },
        ],
      }),
      signal: upstreamAbort.signal,
    })
  } catch (e) {
    if (request.signal.aborted) return new Response(null, { status: 499 })
    Sentry.captureException(e)
    console.error('[ai/listing] OpenRouter недоступен:', e)
    return NextResponse.json({ error: 'Сервис генерации недоступен' }, { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    Sentry.captureMessage(`[ai/listing] OpenRouter ${upstream.status}: ${detail.slice(0, 500)}`)
    console.error('[ai/listing] OpenRouter', upstream.status, detail.slice(0, 500))
    return NextResponse.json(
      { error: upstream.status === 429 ? 'Модель перегружена — попробуйте позже' : 'Ошибка генерации' },
      { status: 502 },
    )
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') { controller.close(); return }
            try {
              const delta = JSON.parse(data).choices?.[0]?.delta?.content
              if (typeof delta === 'string' && delta) controller.enqueue(encoder.encode(delta))
            } catch {
              // keep-alive-комментарии и битые чанки OpenRouter — пропускаем
            }
          }
        }
        controller.close()
      } catch (e) {
        if (!upstreamAbort.signal.aborted) {
          Sentry.captureException(e)
          console.error('[ai/listing] обрыв стрима:', e)
        }
        controller.error(e)
      }
    },
    cancel() {
      upstreamAbort.abort()
      reader.cancel().catch(() => {})
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Listing-Model': model,
    },
  })
}
