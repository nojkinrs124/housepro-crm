'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FileRecord } from '@/types/database'
import { validateUploadedFile } from '@/lib/validate-file'
import { requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'

const BUCKET = 'documents'
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 МБ

export async function uploadFileAction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Не авторизован' }
  }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const file = formData.get('file') as File | null
  const clientId = (formData.get('client_id') as string) || null
  const propertyId = (formData.get('property_id') as string) || null
  const contractId = (formData.get('contract_id') as string) || null
  const dealId = (formData.get('deal_id') as string) || null

  if (!file || file.size === 0) {
    return { error: 'Файл не выбран' }
  }

  const entityId = clientId || propertyId || contractId || dealId
  if (!entityId) {
    return { error: 'Необходимо указать связанный объект (клиент, объект, договор или сделка)' }
  }

  const permError = await requirePermission(user.id, 'files', 'create')
  if (permError) return permError

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // Валидация: размер + расширение + magic bytes
  const validationError = validateUploadedFile(file, buffer, { maxSizeBytes: MAX_FILE_SIZE })
  if (validationError) return { error: validationError }

  const ext = file.name.split('.').pop()?.toLowerCase()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${entityId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return { error: `Ошибка загрузки: ${uploadError.message}` }
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath)

  const payload = {
    file_name: file.name,
    file_url: data.publicUrl,
    file_type: file.type || `application/${ext}`,
    uploaded_by: user.id,
    organization_id: orgId,
    ...(clientId && { client_id: clientId }),
    ...(propertyId && { property_id: propertyId }),
    ...(contractId && { contract_id: contractId }),
    ...(dealId && { deal_id: dealId }),
  }

  const { error: dbError } = await supabase.from('files').insert(payload)

  if (dbError) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    return { error: `Ошибка записи: ${dbError.message}` }
  }

  if (clientId) revalidatePath(`/contacts/${clientId}`)
  if (propertyId) revalidatePath(`/properties/${propertyId}`)
  if (contractId) revalidatePath(`/contracts/${contractId}`)
  if (dealId) revalidatePath(`/deals/${dealId}`)

  return { success: true }
}

export async function deleteFileAction(fileId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Не авторизован' }
  }

  const { data: file } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .single() as { data: FileRecord | null }

  if (!file) return { error: 'Файл не найден' }

  const permError = await requirePermission(user.id, 'files', 'delete')
  if (permError) return permError

  // Extract storage path from public URL
  // Pattern: .../storage/v1/object/public/[bucket]/[path]
  if (file.file_url) {
    const marker = `/storage/v1/object/public/${BUCKET}/`
    const parts = file.file_url.split(marker)
    if (parts[1]) {
      await supabase.storage.from(BUCKET).remove([parts[1]])
    }
  }

  const { error } = await supabase.from('files').delete().eq('id', fileId)
  if (error) return { error: error.message }

  if (file.client_id) revalidatePath(`/contacts/${file.client_id}`)
  if (file.property_id) revalidatePath(`/properties/${file.property_id}`)
  if (file.contract_id) revalidatePath(`/contracts/${file.contract_id}`)
  if (file.deal_id) revalidatePath(`/deals/${file.deal_id}`)

  return { success: true }
}
