'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function uploadTemplateAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const name = (formData.get('name') as string)?.trim()
  const template_type = formData.get('template_type') as string
  const file = formData.get('file') as File | null

  if (!name || !template_type) return { error: 'Заполните все поля' }
  if (!file || file.size === 0) return { error: 'Выберите файл' }
  if (!file.name.endsWith('.docx')) return { error: 'Только DOCX файлы' }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const path = `templates/${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const { error: uploadError } = await supabase.storage
    .from('document-templates')
    .upload(path, buffer, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: false })

  if (uploadError) {
    // Try to create bucket if it doesn't exist
    return { error: `Ошибка загрузки: ${uploadError.message}` }
  }

  const { data: urlData } = await supabase.storage
    .from('document-templates')
    .createSignedUrl(path, 60 * 60 * 24 * 365)

  const { error: dbError } = await supabase.from('document_templates').insert({
    name,
    template_type,
    file_url: urlData?.signedUrl ?? path,
    storage_path: path,
    created_by: user.id,
  })

  if (dbError) return { error: dbError.message }

  revalidatePath('/settings/templates')
  return { success: true }
}

export async function deleteTemplateAction(templateId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  await supabase.from('document_templates').delete().eq('id', templateId)
  revalidatePath('/settings/templates')
  return { success: true }
}
