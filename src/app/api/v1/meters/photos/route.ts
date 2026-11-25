import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { authenticateApiKey, hasScope } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { photoExtension, validateReadingPhoto } from '@/features/meters/services/photo-upload'

// Загрузка фотографии показания из Telegram в публичный бакет `files`.
// Бот шлёт multipart с полем `file`; в ответе — публичная ссылка, которую он
// затем кладёт в `photo_urls` пакета показаний.
export const dynamic = 'force-dynamic'

const BUCKET = 'files'

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!hasScope(auth.scopes, 'write')) {
    return NextResponse.json({ error: 'Insufficient scope (write required)' }, { status: 403 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ожидается multipart/form-data с файлом в поле file' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 })
  }

  const invalid = validateReadingPhoto({ type: file.type, size: file.size })
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const buffer = new Uint8Array(await file.arrayBuffer())
  const path = `meter-readings/${auth.orgId}/${Date.now()}-${randomBytes(4).toString('hex')}.${photoExtension(file.type)}`

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })
  if (error) {
    return NextResponse.json({ error: `Не удалось загрузить фото: ${error.message}` }, { status: 500 })
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ data: { url: data.publicUrl, path } }, { status: 201 })
}
