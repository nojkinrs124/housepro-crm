import type { MetadataRoute } from 'next'
import { env } from '@/lib/env'

/**
 * Внутренние разделы CRM и так закрыты авторизацией в middleware.ts —
 * disallow здесь нужен для порядка: чтобы краулер не тратил бюджет на
 * страницы, которые всё равно отдадут редирект на /login.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.siteUrl.replace(/\/$/, '')

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/login',
          '/forgot-password',
          '/reset-password',
          '/settings',
          '/onboarding',
          '/api/',
          '/leads',
          '/deals',
          '/contacts',
          '/properties',
          '/contracts',
          '/payments',
          '/tasks',
          '/employees',
          '/accounting',
          '/analytics',
          '/showings',
          '/collections',
          '/search',
          '/calendar',
          '/c/',
          '/r/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
