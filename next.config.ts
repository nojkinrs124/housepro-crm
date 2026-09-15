import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
  experimental: {
    // Фото объектов уходят через Server Action по одному файлу; лимит по
    // умолчанию 1 МБ режет любой снимок с телефона (2–8 МБ) ещё до нашего
    // кода — «Body exceeded 1 MB limit». Экшен сам ограничивает файл 10 МБ,
    // здесь запас на multipart-обвязку.
    serverActions: { bodySizeLimit: '12mb' },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Фото объектов в Yandex Object Storage (src/lib/storage/photo-storage.ts)
      {
        protocol: 'https',
        hostname: 'storage.yandexcloud.net',
      },
    ],
  },
}

export default withSentryConfig(nextConfig, {
  // Sentry org/project — задать в env или CI
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Не показываем логи Sentry при билде
  silent: !process.env.CI,

  // Загружаем source maps только в CI/production
  widenClientFileUpload: true,
  disableLogger: true,

  // Не блокируем билд если Sentry недоступен
  telemetry: false,
})
