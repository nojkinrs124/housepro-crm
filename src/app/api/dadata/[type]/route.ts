import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimitSearch } from '@/lib/rate-limit'
import {
  DadataError,
  isDadataConfigured,
  suggestAddress,
  suggestBank,
  suggestParty,
} from '@/lib/dadata/client'

export const dynamic = 'force-dynamic'

// Прокси к DaData для клиентских компонентов.
//
// Ходить в suggestions.dadata.ru прямо из браузера нельзя: это раскрыло бы
// API-ключ агентства всем, кто откроет devtools. Роут закрыт обычной сессией
// CRM и тем же rate-limit'ом, что и глобальный поиск — подсказки дёргаются
// на каждое нажатие клавиши, и без лимита один пользователь легко выест
// дневную квоту тарифа.

const HANDLERS = {
  party: suggestParty,
  address: suggestAddress,
  bank: suggestBank,
} as const

type SupportedType = keyof typeof HANDLERS

export async function GET(request: Request, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params
  if (!(type in HANDLERS)) {
    return NextResponse.json({ error: 'Неизвестный тип подсказок' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  if (!isDadataConfigured()) {
    // Не ошибка: подсказки — необязательное улучшение. Поле должно продолжать
    // работать как обычный текстовый ввод, поэтому отдаём пустой список и флаг.
    return NextResponse.json({ suggestions: [], configured: false })
  }

  const rl = await rateLimitSearch(user.id)
  if (!rl.success) {
    return NextResponse.json({ error: 'Слишком много запросов' }, { status: 429 })
  }

  const q = new URL(request.url).searchParams.get('q') ?? ''
  if (q.trim().length < 3) return NextResponse.json({ suggestions: [], configured: true })

  try {
    const suggestions = await HANDLERS[type as SupportedType](q)
    return NextResponse.json({ suggestions, configured: true })
  } catch (e) {
    const message = e instanceof DadataError ? e.message : 'Сервис подсказок недоступен'
    console.error('[dadata] ошибка запроса:', e)
    return NextResponse.json({ error: message, suggestions: [] }, { status: 502 })
  }
}
