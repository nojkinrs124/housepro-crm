'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { validateUploadedFile } from '@/lib/validate-file'

const LOGO_BUCKET = 'company-logos'
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'svg']

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' as const }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Только администратор может изменять данные компании' as const }
  }
  return { supabase }
}

function readProfileValues(formData: FormData) {
  return {
    legal_form:   (formData.get('legal_form') as string) || 'ip',
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
    signatory_name:     (formData.get('signatory_name') as string)?.trim() || null,
    signatory_position: (formData.get('signatory_position') as string)?.trim() || null,
    signatory_basis:    (formData.get('signatory_basis') as string)?.trim() || null,
    passport_series:          (formData.get('passport_series') as string)?.trim() || null,
    passport_number:          (formData.get('passport_number') as string)?.trim() || null,
    passport_issued_date:     (formData.get('passport_issued_date') as string)?.trim() || null,
    passport_issued_by:       (formData.get('passport_issued_by') as string)?.trim() || null,
    passport_department_code: (formData.get('passport_department_code') as string)?.trim() || null,
  }
}

function validateProfileValues(values: ReturnType<typeof readProfileValues>) {
  if (!values.name) return 'Укажите название / ФИО'
  if (values.inn && !/^\d{10}(\d{2})?$/.test(values.inn)) {
    return 'ИНН должен содержать 10 или 12 цифр'
  }
  if (values.ogrn && !/^\d{13}(\d{2})?$/.test(values.ogrn)) {
    return 'ОГРН/ОГРНИП должен содержать 13 или 15 цифр'
  }
  return null
}

export async function createCompanyProfileAction(_prevState: unknown, formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  const values = readProfileValues(formData)
  const validationError = validateProfileValues(values)
  if (validationError) return { error: validationError }

  const { count } = await supabase
    .from('company_settings')
    .select('id', { count: 'exact', head: true })

  const makeDefault = formData.get('is_default') === 'on' || !count

  if (makeDefault) {
    await supabase.from('company_settings').update({ is_default: false }).eq('is_default', true)
  }

  const { data: created, error } = await supabase
    .from('company_settings')
    .insert({ ...values, is_default: makeDefault })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/settings/company')
  redirect(`/settings/company/${created.id}/edit?created=1`)
}

export async function updateCompanyProfileAction(id: string, _prevState: unknown, formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  const values = readProfileValues(formData)
  const validationError = validateProfileValues(values)
  if (validationError) return { error: validationError }

  const { error } = await supabase
    .from('company_settings')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/settings/company')
  return { success: true }
}

export async function deleteCompanyProfileAction(id: string) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  const { count: usedCount } = await supabase
    .from('contracts')
    .select('id', { count: 'exact', head: true })
    .eq('company_profile_id', id)

  if (usedCount) {
    return { error: `Профиль используется в ${usedCount} договоре(ах) — удаление невозможно` }
  }

  const { data: deleted } = await supabase
    .from('company_settings')
    .delete()
    .eq('id', id)
    .select('is_default')
    .single()

  if (deleted?.is_default) {
    const { data: next } = await supabase
      .from('company_settings')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (next) {
      await supabase.from('company_settings').update({ is_default: true }).eq('id', next.id)
    }
  }

  revalidatePath('/settings/company')
  return { success: true }
}

export async function setDefaultCompanyProfileAction(id: string) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  await supabase.from('company_settings').update({ is_default: false }).eq('is_default', true)
  const { error } = await supabase.from('company_settings').update({ is_default: true }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/settings/company')
  return { success: true }
}

export async function uploadLogoAction(id: string, formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) return { error: 'Файл не выбран' }

  const MAX_SIZE = 2 * 1024 * 1024 // 2MB

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

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

  const path = `logo/${id}.${ext}`

  await supabase.storage.createBucket(LOGO_BUCKET, { public: true }).catch(() => {})

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
  const logoUrl = `${data.publicUrl}?t=${Date.now()}`

  await supabase.from('company_settings').update({ logo_url: logoUrl, updated_at: new Date().toISOString() }).eq('id', id)

  revalidatePath('/settings/company')
  return { success: true, url: logoUrl }
}

export async function removeLogoAction(id: string) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase } = auth

  await supabase
    .from('company_settings')
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/settings/company')
  return { success: true }
}
