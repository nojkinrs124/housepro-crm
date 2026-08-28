import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Property } from '@/types/database'

// Публичный роут — его опрашивает робот Авито (Автозагрузка), без авторизации.
// Изоляция по организации обеспечивается не middleware/RLS-политикой на properties,
// а SECURITY DEFINER функцией get_avito_feed_properties(token): она сама находит
// организацию по feed_token и возвращает только её объекты с avito_publish=true.
// См. миграцию create_avito_integration.
export const dynamic = 'force-dynamic'

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const catMap: Record<string, string> = {
  apartment: 'Квартиры', house: 'Дома и дачи', commercial: 'Коммерческая недвижимость',
  office: 'Коммерческая недвижимость', warehouse: 'Коммерческая недвижимость', land: 'Земельные участки',
}
const opMap: Record<string, string> = { rent: 'Сдам', sale: 'Продам', subrent: 'Сдам', management: 'Сдам' }
const ptMap: Record<string, string> = {
  apartment: 'Вторичка', house: 'Дом', commercial: 'Офис', office: 'Офис', warehouse: 'Склад', land: 'Участок',
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const supabase = await createClient()

  const [{ data: properties, error }, { data: contactPhone }] = await Promise.all([
    supabase.rpc('get_avito_feed_properties', { p_token: token }),
    supabase.rpc('get_avito_feed_contact_phone', { p_token: token }),
  ])

  if (error) {
    return new NextResponse('Internal error', { status: 500 })
  }

  const phone = (contactPhone as string | null) ?? null

  const ads = ((properties ?? []) as Property[]).map((p) => [
    `  <Ad>`,
    `    <Id>${esc(p.id)}</Id>`,
    `    <DateBegin>${p.created_at?.slice(0, 10)}</DateBegin>`,
    `    <Category>${esc(catMap[p.property_type] ?? 'Квартиры')}</Category>`,
    `    <OperationType>${esc(opMap[p.deal_type] ?? 'Сдам')}</OperationType>`,
    `    <Title>${esc(p.title)}</Title>`,
    `    <Description>${esc(p.description ?? p.title)}</Description>`,
    `    <Price>${p.price ?? 0}</Price>`,
    `    <Address>${esc(p.address)}</Address>`,
    phone && `    <ContactPhone>${esc(phone)}</ContactPhone>`,
    // != null (не truthy-проверка) — иначе валидные нулевые значения (студия: 0 комнат,
    // цокольный/первый этаж: 0) молча выпадали бы из фида
    p.area != null && `    <Square>${p.area}</Square>`,
    p.rooms != null && `    <Rooms>${p.rooms}</Rooms>`,
    p.floor != null && `    <Floor>${p.floor}</Floor>`,
    p.total_floors != null && `    <Floors>${p.total_floors}</Floors>`,
    p.property_type && `    <PropertyType>${esc(ptMap[p.property_type] ?? p.property_type)}</PropertyType>`,
    p.year_built != null && `    <YearOfConstruction>${p.year_built}</YearOfConstruction>`,
    p.ceiling_height != null && `    <Ceiling>${p.ceiling_height}</Ceiling>`,
    p.living_area != null && `    <LivingSpace>${p.living_area}</LivingSpace>`,
    p.kitchen_area != null && `    <KitchenSpace>${p.kitchen_area}</KitchenSpace>`,
    (p.photo_urls?.length ?? 0) > 0 && [
      `    <Images>`,
      ...p.photo_urls!.map((url) => `      <Image url="${esc(url)}"/>`),
      `    </Images>`,
    ].join('\n'),
    `  </Ad>`,
  ].filter(Boolean).join('\n')).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Ads target="Avito.ru" formatVersion="3">\n${ads}\n</Ads>`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
