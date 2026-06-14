import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Процент трейсов для мониторинга производительности
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Процент сессий для Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Не логируем в dev
  enabled: process.env.NODE_ENV === 'production',

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],

  beforeSend(event) {
    // Не отправляем ошибки навигации (NEXT_REDIRECT, NEXT_NOT_FOUND)
    if (event.exception?.values?.[0]?.value?.includes('NEXT_REDIRECT')) return null
    if (event.exception?.values?.[0]?.value?.includes('NEXT_NOT_FOUND')) return null
    return event
  },
})
