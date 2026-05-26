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
