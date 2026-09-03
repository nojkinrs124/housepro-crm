import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// КРИТИЧНО: этот роут отдаёт данные, специфичные для конкретной организации/пользователя
// (RLS или ручная фильтрация по organization_id). Next.js по умолчанию может закэшировать
// GET Route Handler и отдать один и тот же ответ разным пользователям/организациям по
// одному URL — это утечка данных между тенантами. force-dynamic отключает это кэширование.
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('status', 'available')
    .order('created_at', { ascending: false })

  const esc = (v: unknown) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  const catMap: Record<string,string> = { apartment:'flatRent', house:'houseRent', commercial:'officeRent', office:'officeRent', warehouse:'warehouseRent', land:'landRent' }
  const catSaleMap: Record<string,string> = { apartment:'flatSale', house:'houseSale', commercial:'officeSale', office:'officeSale', warehouse:'warehouseSale', land:'landSale' }

  const offers = (properties ?? []).map(p => {
    const isRent = p.deal_type === 'rent' || p.deal_type === 'subrent' || p.deal_type === 'management'
    const cat = isRent ? (catMap[p.property_type] ?? 'flatRent') : (catSaleMap[p.property_type] ?? 'flatSale')
    return [
      `  <object>`,
      `    <ExternalId>${esc(p.id)}</ExternalId>`,
      `    <ObjectType>${esc(cat)}</ObjectType>`,
      `    <Description>${esc(p.description ?? p.title)}</Description>`,
      `    <Address>${esc(p.address)}</Address>`,
      `    <bargainTerms><price>${p.price ?? 0}</price></bargainTerms>`,
      p.area && `    <totalArea>${p.area}</totalArea>`,
      p.rooms && `    <roomsCount>${p.rooms}</roomsCount>`,
      p.floor && `    <floorNumber>${p.floor}</floorNumber>`,
      p.total_floors && `    <floorsCount>${p.total_floors}</floorsCount>`,
      p.living_area && `    <livingArea>${p.living_area}</livingArea>`,
      p.kitchen_area && `    <kitchenArea>${p.kitchen_area}</kitchenArea>`,
      p.year_built && `    <buildYear>${p.year_built}</buildYear>`,
      `  </object>`,
    ].filter(Boolean).join('\n')
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<feed version="1">\n${offers}\n</feed>`
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': 'attachment; filename="cian.xml"' },
  })
}
