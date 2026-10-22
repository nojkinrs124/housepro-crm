import { NextResponse } from 'next/server'
import type { TelegramUpdate } from '@/lib/telegram/api'
import { routeTelegramUpdate } from '@/lib/telegram/webhook/router'

// Node runtime (по умолчанию) — ОБЯЗАТЕЛЬНО, не ставить `export const runtime = 'edge'`.
// pizzip/docxtemplater — Node-only, в Edge runtime не заработают.
export const dynamic = 'force-dynamic'
// По умолчанию Vercel режет serverless-функцию на 15с — этого уже впритык хватало на
// генерацию изображений/DOCX, а market_research (веб-поиск через OpenRouter ":online",
// см. market-research.ts) может занимать 20-40с. Поднимаем потолок явно, а не полагаемся
// на дефолт, который на Hobby-плане конфигурируется максимум до 60с.
export const maxDuration = 60

/**
 * Тонкий диспетчер: проверка секрета Telegram → разбор тела → вся логика в
 * `lib/telegram/webhook/*`. Разбит на модули фазой 2 аудита 22.10.2026 —
 * раньше здесь было 1321 строка и ~30 функций, правка бота была страшной.
 * Поведение не менялось: idempotency/context/router/handlers/dialog — те же
 * функции, что раньше жили прямо в этом файле.
 */
export async function POST(request: Request) {
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
  if (!process.env.TELEGRAM_BOT_SECRET || secret !== process.env.TELEGRAM_BOT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  // Telegram повторяет update, если не получил 200 за ~60 с — долгий ход модели
  // заканчивался вторым таким же подтверждением. routeTelegramUpdate закрывает
  // это идемпотентностью claimed→done/failed (аудит P0-7).
  const result = await routeTelegramUpdate(update)
  return NextResponse.json(result)
}
