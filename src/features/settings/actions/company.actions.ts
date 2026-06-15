'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { validateUploadedFile } from '@/lib/validate-file'

const LOGO_BUCKET = 'company-logos'
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'svg']

export async function updateCompanyAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Только администратор может изменять данные компании' }
  }

  const values = {
    name:         (formData.get('name') as string)?.trim() || null,
    inn:          (formData.get('inn') as string)?.trim() || null,
    ogrn:         (formData.get('ogrn') as string)?.trim() || null,
    kpp:          (formData.get('kpp') as string)?.trim() || null,
    address:      (formData.get('address') as string)?.trim() || null,
    phone:        (formData.get('phone') as string)?.trim() || null,
    email:        (formData.get('email') as string)?.trim() || null,
    website:      (formData.get('website') as string)?.trim() || null,
    description:  (formData.get('description') as string)?.trim() || null,
    bank_name:    (formData.get('bank_name') as string)?.trim() || null,
    bank_account: (formData.get('bank_account') as string)?.trim() || null,
    bik:          (formData.get('bik') as string)?.trim() || null,
    corr_account: (formData.get('corr_account') as string)?.trim() || null,
    updated_at:   new Date().toISOString(),
  }

  // INN validation
  if (values.inn && !/^\d{10}(\d{2})?$/.test(values.inn)) {
    return { error: 'ИНН должен содержать 10 или 12 цифр' }
  }

  // OGRN validation
  if (values.ogrn && !/^\d{13}(\d{2})?$/.test(values.ogrn)) {
    return { error: 'ОГРН должен содержать 13 или 15 цифр' }
  }

  const { data: existing } = await supabase
    .from('company_settings')
    .select('id')
    .limit(1)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('company_settings')
      .update(values)
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('company_settings')
      .insert(values)
    if (error) return { error: error.message }
  }

  revalidatePath('/settings/company')
  return { success: true }
}

export async function uploadLogoAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Только администратор может изменять логотип' }
  }

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) return { error: 'Файл не выбран' }

  const MAX_SIZE = 2 * 1024 * 1024 // 2MB

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // SVG doesn't have magic bytes — skip magic check for SVG
  if (file.type !== 'image/svg+xml') {
    const validationError = validateUploadedFile(file, buffer, {
      allowedMimeTypes: ALLOWED_IMAGE_TYPES.filter(t => t !== 'image/svg+xml'),
      maxSizeBytes: MAX_SIZE,
    })
    if (validationError) return { error: validationError }
  } else if (file.size > MAX_SIZE) {
    return { error: 'Файл слишком большой. Максимум 2 МБ' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    return { error: 'Недопустимое расширение файла' }
  }

  const path = `logo/logo.${ext}`

  // Ensure bucket exists (will fail silently if already exists)
  await supabase.storage.createBucket(LOGO_BUCKET, { public: true }).catch(() => {})

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
  const logoUrl = `${data.publicUrl}?t=${Date.now()}`

  const { data: existing } = await supabase
    .from('company_settings')
    .select('id')
    .limit(1)
    .single()

  if (existing) {
    await supabase.from('company_settings').update({ logo_url: logoUrl, updated_at: new Date().toISOString() }).eq('id', existing.id)
  } else {
    await supabase.from('company_settings').insert({ logo_url: logoUrl })
  }

  revalidatePath('/settings/company')
  return { success: true, url: logoUrl }
}

export async function removeLogoAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const { data: existing } = await supabase
    .from('company_settings')
    .select('id')
    .limit(1)
    .single()

  if (existing) {
    await supabase
      .from('company_settings')
      .update({ logo_url: null, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  }

  revalidatePath('/settings/company')
  return { success: true }
}
