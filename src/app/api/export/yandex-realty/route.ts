import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildRealtyFeed, type FeedProperty } from '@/features/properties/services/realty-feed.service'
import { getSiteUrl } from '@/lib/telegram/site-url'
import { FALLBACK_CONTACTS } from '@/features/site/config'

// Фид для Яндекс.Недвижимости (формат YRL).
//
// force-dynamic обязателен: роут отдаёт данные конкретной организации,
// а закэшированный ответ утёк бы другому арендатору (см. комментарий
// в /api/export/cian).
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  const [{ data: properties }, { data: company }] = await Promise.all([
    supabase
      .from('properties')
      .select(
        `id, title, description, address, district, property_type, deal_type, price, deposit,
         area, living_area, kitchen_area, rooms, floor, total_floors, year_built,
         latitude, longitude, metro, photo_urls, created_at, updated_at`
      )
      .eq('status', 'available')
      .order('created_at', { ascending: false }),
    supabase
      .from('company_settings')
      .select('name, phone, email')
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const xml = buildRealtyFeed((properties ?? []) as unknown as FeedProperty[], {
    city: FALLBACK_CONTACTS.city,
    agentPhone: company?.phone || FALLBACK_CONTACTS.phone,
    agentName: company?.name ?? null,
    agentEmail: company?.email ?? null,
    siteUrl: getSiteUrl(),
  })

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': 'attachment; filename="yandex-realty.xml"',
    },
  })
}
