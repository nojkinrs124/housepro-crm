// Браузерный клиент Supabase.
//
// ⚠️ ПЕРЕД ИСПОЛЬЗОВАНИЕМ: он читает NEXT_PUBLIC_SUPABASE_URL и
// NEXT_PUBLIC_SUPABASE_ANON_KEY, а они вшиваются в бандл НА СБОРКЕ. Если их нет
// в окружении сборки (в проде на Vercel их сейчас нет — см. задачу в разделе
// «Задачи»), createBrowserClient падает с «Your project's URL and API key are
// required». Причём падает по-разному: вызов при рендере роняет всю страницу,
// вызов внутри обработчика — молча, и операция просто не выполняется.
//
// 02.09.2026 по этой причине из проекта убраны все его использования: Kanban-доски
// лидов, сделок и задач и блок 2FA переведены на server actions. Они и надёжнее —
// серверный клиент берёт ключи в рантайме, а экшены попутно проверяют права роли,
// чего прямой запрос из браузера не делал (там работала только RLS).
//
// Если понадобится realtime-подписка или что-то, что действительно нельзя сделать
// на сервере, — сначала убедиться, что обе переменные заданы в Vercel.

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { env } from '@/lib/env'

export function createClient() {
  return createBrowserClient<Database>(
    env.supabaseUrl,
    env.supabaseAnonKey
  )
}
