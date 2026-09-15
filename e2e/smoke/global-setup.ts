/**
 * Предохранитель + seed перед смоуком.
 *
 * Первым делом проверяем, что Supabase — не боевой проект. Это важнее самих
 * тестов: смоук создаёт договоры и платежи, и прогон по проду недопустим.
 * Потом наполняем изолированную базу минимумом (организация, админ, профиль
 * компании) — seed идемпотентен.
 */
import { assertIsolatedSupabase, seed } from '../seed'

export default async function globalSetup(): Promise<void> {
  assertIsolatedSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL)

  const base = process.env.E2E_BASE_URL ?? ''
  if (/housepro24\.vercel\.app|vercel\.app/.test(base)) {
    throw new Error(`ОСТАНОВ: E2E_BASE_URL=${base} — смоук не ходит на прод.`)
  }

  const r = await seed()
  console.log(`[smoke] seed ok: org=${r.orgId} user=${r.email}`)
}
