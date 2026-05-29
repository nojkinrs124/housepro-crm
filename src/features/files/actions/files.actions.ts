'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const BUCKET = 'files'

export async function uploadFileAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const file = formData.get('file') as File | null
  const clientId = (formData.get('client_id') as string) || null
  const propertyId = (formData.get('property_id') as string) || null
  const contractId = (formData.get('contract_id') as string) || null

  if (!file || file.size === 0) {
    return { error: 'Файл не выбран' }
  }

  if (file.size > 20 * 1024 * 1024) {
    return { error: 'Файл слишком большой (максимум 20 МБ)' }
  }

  const entityId = clientId || propertyId || contractId
  const ext = file.name.split('.').pop()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${entityId}/${Date.now()}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return { error: `Ошибка загрузки: ${uploadError.message}` }
  }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath)

  // Build insert payload without null fields to satisfy strict TS types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    file_name: file.name,
    file_url: publicUrl,
    file_type: file.type || `application/${ext}`,
    uploaded_by: user?.id ?? undefined,
  }
  if (clientId) payload.client_id = clientId
  if (propertyId) payload.property_id = propertyId
  if (contractId) payload.contract_id = contractId

  const { error: dbError } = await supabase.from('files').insert(payload)

  if (dbError) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    return { error: `Ошибка записи: ${dbError.message}` }
  }

  if (clientId) revalidatePath(`/clients/${clientId}`)
  if (propertyId) revalidatePath(`/properties/${propertyId}`)
  if (contractId) revalidatePath(`/contracts/${contractId}`)

  return { success: true }
}

export async function deleteFileAction(fileId: string) {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: file } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .single() as { data: any }

  if (!file) return { error: 'Файл не найден' }

  // Extract storage path from public URL
  // Pattern: .../storage/v1/object/public/files/[path]
  if (file.file_url) {
    const marker = `/storage/v1/object/public/${BUCKET}/`
    const parts = file.file_url.split(marker)
    if (parts[1]) {
      await supabase.storage.from(BUCKET).remove([parts[1]])
    }
  }

  const { error } = await supabase.from('files').delete().eq('id', fileId)
  if (error) return { error: error.message }

  if (file.client_id) revalidatePath(`/clients/${file.client_id}`)
  if (file.property_id) revalidatePath(`/properties/${file.property_id}`)
  if (file.contract_id) revalidatePath(`/contracts/${file.contract_id}`)

  return { success: true }
}
