import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
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
