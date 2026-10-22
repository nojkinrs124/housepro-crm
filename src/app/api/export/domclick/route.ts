import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveFeedAccess } from '@/lib/export-feed'
import { buildRealtyFeed, type FeedProperty } from '@/features/properties/services/realty-feed.service'
import { getSiteUrl } from '@/lib/telegram/site-url'
import { FALLBACK_CONTACTS } from '@/features/site/config'

// Фид для Домклика.
//
// Домклик принимает фид в формате Яндекс.Недвижимости, поэтому генератор тот же,
// что и у /api/export/yandex-realty — отдельный роут нужен, чтобы у площадки был
// свой постоянный адрес: адреса фидов вбиваются в личных кабинетах руками и
// потом живут годами, склеивать их в один нельзя.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const access = await resolveFeedAccess(request, 'domclick')
  if (!access.ok) return new NextResponse(access.message, { status: access.status })
  const supabase = getSupabaseAdmin()

  const [{ data: properties }, { data: company }] = await Promise.all([
    supabase
      .from('properties')
      .select(
        `id, title, description, address, district, property_type, deal_type, price, deposit,
         area, living_area, kitchen_area, rooms, floor, total_floors, year_built,
         latitude, longitude, metro, photo_urls, created_at, updated_at`
      )
      .eq('organization_id', access.orgId)
      .eq('status', 'available')
      .order('created_at', { ascending: false }),
    supabase
      .from('company_settings')
      .select('name, phone, email')
      .eq('organization_id', access.orgId)
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
      'Content-Disposition': 'attachment; filename="domclick.xml"',
    },
  })
}
