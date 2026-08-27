'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function deleteClientAction(id: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Проверяем права доступа (только admin может удалить)
  const { data: userRole } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userRole?.role !== 'admin') {
    return { error: 'Только администраторы могут удалять клиентов' }
  }

  const { error } = await supabase.from('clients').delete().eq('id', id)
  
  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clients')
  redirect('/clients')
}
