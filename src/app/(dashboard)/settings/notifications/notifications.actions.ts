'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markNotificationReadAction(notificationId: string) {
  const supabase = await createClient()
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
  revalidatePath('/settings/notifications')
}

export async function markAllNotificationsReadAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)
  revalidatePath('/settings/notifications')
}
