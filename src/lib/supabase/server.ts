import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { env } from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.supabaseUrl,
    env.supabaseAnonKey,
    {
      // КРИТИЧНО: без этого Next.js Data Cache может закэшировать ответ
      // PostgREST (в т.ч. RLS-отфильтрованные данные конкретного пользователя)
      // и отдавать его повторно — в т.ч. другому пользователю с другим
      // organization_id по тому же URL/id (утечка данных между организациями),
      // либо устаревший результат (напр. "404" после того как запись стала
      // доступна) навсегда застревает в кэше. cookies() делает страницу
      // динамической, но НЕ отключает кэш отдельных fetch() сам по себе —
      // это нужно явно.
      global: {
        fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}
