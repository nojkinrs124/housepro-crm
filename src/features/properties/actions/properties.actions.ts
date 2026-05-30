'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createPropertyAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const values = {
    title: formData.get('title') as string,
    address: formData.get('address') as string,
    property_type: formData.get('property_type') as string || 'apartment',
    deal_type: formData.get('deal_type') as string || 'rent',
    price: formData.get('price') ? Number(formData.get('price')) : null,
    area: formData.get('area') ? Number(formData.get('area')) : null,
    rooms: formData.get('rooms') ? Number(formData.get('rooms')) : null,
    description: formData.get('description') as string || null,
    status: 'available' as const,
    manager_id: user.id,
  }

  if (!values.title?.trim() || !values.address?.trim()) {
    return { error: 'Название и адрес обязательны' }
  }

  const { error } = await supabase.from('properties').insert(values)
  if (error) return { error: error.message }

  revalidatePath('/properties')
  redirect('/properties')
}

export async function updatePropertyAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const values = {
    title: formData.get('title') as string,
    address: formData.get('address') as string,
    property_type: formData.get('property_type') as string,
    deal_type: formData.get('deal_type') as string,
    district: formData.get('district') as string || null,
    price: formData.get('price') ? Number(formData.get('price')) : null,
    deposit: formData.get('deposit') ? Number(formData.get('deposit')) : null,
    area: formData.get('area') ? Number(formData.get('area')) : null,
    rooms: formData.get('rooms') ? Number(formData.get('rooms')) : null,
    floor: formData.get('floor') ? Number(formData.get('floor')) : null,
    description: formData.get('description') as string || null,
    status: formData.get('status') as string,
  }

  if (!values.title?.trim() || !values.address?.trim()) {
    return { error: 'Название и адрес обязательны' }
  }

  const { error } = await supabase
    .from('properties')
    .update(values)
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

  // Проверяем права доступа
  const { data: userRole } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userRole || !['admin', 'manager'].includes(userRole.role)) {
    return { error: 'Недостаточно прав для удаления объекта' }
  }

  const { error } = await supabase.from('properties').delete().eq('id', id)
  
  if (error) {
    return { error: error.message }
  }

  revalidatePath('/properties')
  redirect('/properties')
}
