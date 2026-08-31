import type { MetadataRoute } from 'next'
import { env } from '@/lib/env'
import { fetchPublishedPropertyIds } from '@/features/site/lib/properties'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl.replace(/\/$/, '')
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/catalog`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/uslugi`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/o-kompanii`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/kontakty`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ]

  const properties = await fetchPublishedPropertyIds()

  return [
    ...staticPages,
    ...properties.map(p => ({
      url: `${base}/catalog/${p.id}`,
      lastModified: p.created_at ? new Date(p.created_at) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
