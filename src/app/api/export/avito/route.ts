import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('status', 'available')
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const esc = (v: any) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  const catMap: Record<string,string> = { apartment:'Квартиры', house:'Дома и дачи', commercial:'Коммерческая недвижимость', office:'Коммерческая недвижимость', warehouse:'Коммерческая недвижимость', land:'Земельные участки' }
  const opMap:  Record<string,string> = { rent:'Сдам', sale:'Продам', subrent:'Сдам', management:'Сдам' }
  const ptMap:  Record<string,string> = { apartment:'Вторичка', house:'Дом', commercial:'Офис', office:'Офис', warehouse:'Склад', land:'Участок' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ads = (properties ?? []).map((p: any) => [
    `  <Ad>`,
    `    <Id>${esc(p.id)}</Id>`,
    `    <DateBegin>${p.created_at?.slice(0,10)}</DateBegin>`,
    `    <Category>${esc(catMap[p.property_type] ?? 'Квартиры')}</Category>`,
    `    <OperationType>${esc(opMap[p.deal_type] ?? 'Сдам')}</OperationType>`,
    `    <Title>${esc(p.title)}</Title>`,
    `    <Description>${esc(p.description ?? p.title)}</Description>`,
    `    <Price>${p.price ?? 0}</Price>`,
    `    <Address>${esc(p.address)}</Address>`,
    p.area          && `    <Square>${p.area}</Square>`,
    p.rooms         && `    <Rooms>${p.rooms}</Rooms>`,
    p.floor         && `    <Floor>${p.floor}</Floor>`,
    p.total_floors  && `    <Floors>${p.total_floors}</Floors>`,
    p.property_type && `    <PropertyType>${esc(ptMap[p.property_type] ?? p.property_type)}</PropertyType>`,
    p.year_built    && `    <YearOfConstruction>${p.year_built}</YearOfConstruction>`,
    p.ceiling_height && `    <Ceiling>${p.ceiling_height}</Ceiling>`,
    p.living_area   && `    <LivingSpace>${p.living_area}</LivingSpace>`,
    p.kitchen_area  && `    <KitchenSpace>${p.kitchen_area}</KitchenSpace>`,
    `  </Ad>`,
  ].filter(Boolean).join('\n')).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Ads target="Avito.ru" formatVersion="3">\n${ads}\n</Ads>`
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Disposition': 'attachment; filename="avito.xml"' },
  })
}
