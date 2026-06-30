/**
 * Централизованная валидация переменных окружения.
 * Падает при старте с понятной ошибкой вместо криптичного runtime-краша.
 */

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value || value.trim() === "") {
    // During build/SSG, env vars may not be present — only throw at runtime
    if (process.env.NODE_ENV === "production" && typeof window === "undefined" && !process.env.NEXT_PHASE) {
      throw new Error(
        `[HousePro CRM] Missing required environment variable: "${key}"` +
        `
Copy .env.local.example to .env.local and fill in the value.`
      )
    }
    return ""
  }
  return value.trim()
}

export const env = {
  supabaseUrl:     requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  // Stripe — опционально, читается напрямую из process.env в billing/webhook роутах.
  // НЕ добавлять сюда через requireEnv(): это поломает ВСЕ страницы (env.ts
  // импортируется в supabase/server.ts, который используется почти везде),
  // если Stripe ключи ещё не настроены в окружении.
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const

export type Env = typeof env
