import * as Sentry from '@sentry/nextjs'

/**
 * Выполняется один раз при старте сервера Next — до первого запроса.
 *
 * 1. Часовой пояс процесса. Без него `new Date()` и `toLocaleString` считают
 *    по поясу машины (UTC+7 у разработчика, UTC на Vercel), и одно и то же
 *    время показа выглядит по-разному в двух окружениях (сквозной проход
 *    17.09.2026, SH-1/TK-1/AC-2). Node перечитывает `TZ` при присваивании
 *    `process.env.TZ`, поэтому этого достаточно и для `next start`, и для
 *    serverless-функций Vercel.
 *
 * 2. Sentry на сервере и в edge: начиная с @sentry/nextjs 8 конфиги
 *    `sentry.server.config.ts` / `sentry.edge.config.ts` подхватываются только
 *    отсюда — без `instrumentation.ts` серверные ошибки в Sentry не попадали.
 */
export async function register() {
  const { APP_TZ } = await import('@/lib/timezone')
  process.env.TZ = APP_TZ

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
