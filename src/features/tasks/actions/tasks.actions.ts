'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createTaskAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const values = {
    title: formData.get('title') as string,
    description: formData.get('description') as string || null,
    priority: formData.get('priority') as string || 'medium',
    deadline: formData.get('deadline') as string || null,
    status: 'todo' as const,
    created_by: user.id,
    assigned_to: user.id,
  }

  if (!values.title?.trim()) return { error: 'Название обязательно' }

  const { error } = await supabase.from('tasks').insert(values)
  if (error) return { error: error.message }

  revalidatePath('/tasks')
  redirect('/tasks')
}

export async function updateTaskStatusAction(id: string, status: string) {
  const supabase = await createClient()
  await supabase.from('tasks').update({ status }).eq('id', id)
  revalidatePath('/tasks')
}

export async function deleteTaskAction(id: string) {
  const supabase = await createClient()
  await supabase.from('tasks').delete().eq('id', id)
  revalidatePath('/tasks')
  redirect('/tasks')
}
