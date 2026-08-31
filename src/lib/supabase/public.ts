import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { env } from '@/lib/env'

/**
 * Клиент Supabase для публичного маркетингового сайта.
 *
 * Отличия от `@/lib/supabase/server`:
 *  1. НЕ читает cookies — значит, запрос всегда уходит под ролью `anon`,
 *     даже если страницу открыл залогиненный сотрудник CRM. Это гарантия,
 *     что публичная страница физически не может показать больше, чем
 *     разрешает anon-политика RLS (см. миграцию anon_select_published_properties).
 *  2. Ответы PostgREST кэшируются на `revalidate` секунд — публичный каталог
 *     читают анонимы, персональных данных в ответе нет, поэтому кэш безопасен
 *     (в отличие от серверного клиента CRM, где кэш = утечка между организациями).
 */
export function createPublicClient(revalidateSeconds = 60) {
  return createSupabaseClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (url, options = {}) =>
        fetch(url, { ...options, next: { revalidate: revalidateSeconds } }),
    },
  })
}
