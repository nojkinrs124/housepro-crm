'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOrgId } from '@/lib/org'

function extractPropertyFields(formData: FormData) {
  return {
    title:             (formData.get('title') as string)?.trim(),
    address:           (formData.get('address') as string)?.trim(),
    property_type:     (formData.get('property_type') as string) || 'apartment',
    deal_type:         (formData.get('deal_type') as string) || 'rent',
    status:            (formData.get('status') as string) || 'available',
    description:       (formData.get('description') as string)?.trim() || null,
    // Financials
    price:             formData.get('price')         ? Number(formData.get('price'))         : null,
    deposit:           formData.get('deposit')        ? Number(formData.get('deposit'))        : null,
    management_fee:    formData.get('management_fee') ? Number(formData.get('management_fee')) : null,
    // Area
    area:              formData.get('area')           ? Number(formData.get('area'))           : null,
    living_area:       formData.get('living_area')    ? Number(formData.get('living_area'))    : null,
    kitchen_area:      formData.get('kitchen_area')   ? Number(formData.get('kitchen_area'))   : null,
    // Rooms / floors
    rooms:             formData.get('rooms')          ? Number(formData.get('rooms'))          : null,
    floor:             formData.get('floor')          ? Number(formData.get('floor'))          : null,
    total_floors:      formData.get('total_floors')   ? Number(formData.get('total_floors'))   : null,
    ceiling_height:    formData.get('ceiling_height') ? Number(formData.get('ceiling_height')) : null,
    // House
    house_type:        (formData.get('house_type') as string) || null,
    wall_material:     (formData.get('wall_material') as string) || null,
    year_built:        formData.get('year_built')     ? Number(formData.get('year_built'))     : null,
    has_elevator:      formData.get('has_elevator') === 'on',
    has_parking:       formData.get('has_parking')  === 'on',
    has_internet:      formData.get('has_internet') === 'on',
    has_tv:            formData.get('has_tv')       === 'on',
    // Infrastructure
    heating_type:      (formData.get('heating_type') as string) || null,
    water_supply_type: (formData.get('water_supply_type') as string) || null,
    // Coordinates
    district:          (formData.get('district') as string) || null,
    utilities_included:(formData.get('utilities_included') as string) || null,
    // Документ-основание права собственности (напр. "Выписка из ЕГРН №... от ...")
    // — подставляется в договоры найма/аренды по этому объекту.
    ownership_basis:   (formData.get('ownership_basis') as string)?.trim() || null,
  }
}

export async function createPropertyAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const fields = extractPropertyFields(formData)

  if (!fields.title?.trim() || !fields.address?.trim()) {
    return { error: 'Название и адрес обязательны' }
  }

  const { data: property, error } = await supabase.from('properties').insert({
    ...fields,
    manager_id: user.id,
    organization_id: orgId,
  }).select().single()

  if (error) return { error: error.message }

  revalidatePath('/properties')
  redirect(`/properties/${property.id}`)
}

export async function updatePropertyAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fields = extractPropertyFields(formData)

  if (!fields.title?.trim() || !fields.address?.trim()) {
    return { error: 'Название и адрес обязательны' }
  }

  const { error } = await supabase
    .from('properties')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/properties')
  revalidatePath(`/properties/${id}`)
  redirect(`/properties/${id}`)
}

export async function deletePropertyAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRole } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userRole || !['admin', 'manager'].includes(userRole.role)) {
    return { error: 'Недостаточно прав для удаления объекта' }
  }

  const { error } = await supabase.from('properties').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/properties')
  redirect('/properties')
}
