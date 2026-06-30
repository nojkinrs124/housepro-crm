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
  supabaseUrl:             requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey:         requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  stripeSecretKey:         requireEnv('STRIPE_SECRET_KEY'),
  stripeWebhookSecret:     requireEnv('STRIPE_WEBHOOK_SECRET'),
  stripePublishableKey:    requireEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
  siteUrl:                 process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const

export type Env = typeof env
