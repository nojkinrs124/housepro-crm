import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  enabled: process.env.NODE_ENV === 'production',

  beforeSend(event) {
    if (event.exception?.values?.[0]?.value?.includes('NEXT_REDIRECT')) return null
    if (event.exception?.values?.[0]?.value?.includes('NEXT_NOT_FOUND')) return null
    return event
  },
})
