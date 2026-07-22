import { createClient } from '@supabase/supabase-js'

// Ленивая инициализация service-role клиента (обходит RLS).
// no-store обязателен: этот клиент видит все org, кэш на уровне Next.js
// Data Cache мог бы отдать данные одной организации в ответ на запрос другой.
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) } }
  )
}
