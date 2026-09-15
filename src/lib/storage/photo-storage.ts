/**
 * Хранилище фото объектов: Yandex Object Storage (S3) или Supabase Storage.
 *
 * Драйвер выбирается переменной `STORAGE_DRIVER`:
 *   - `yandex`   — бакет `YC_S3_BUCKET` на `YC_S3_ENDPOINT`, ключи сервисного
 *                  аккаунта `YC_S3_KEY_ID` / `YC_S3_SECRET`;
 *   - `supabase` — бакет `property-photos` (по умолчанию, если переменная
 *                  не задана — чтобы старый деплой без новых env не сломался).
 *
 * В `properties.photo_urls` лежат публичные URL, а не пути — площадки
 * (Авито, Циан, Домклик) забирают картинки по ним напрямую. Поэтому оба бакета
 * публичные на чтение, а удаление ищет файл по форме URL, а не по активному
 * драйверу: пока идёт перенос, в одной карточке могут соседствовать ссылки
 * обоих хранилищ.
 *
 * Только сервер: файл тянет S3-клиент и `createClient` из `supabase/server`.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_PHOTO_BUCKET = 'property-photos'

type StorageDriver = 'yandex' | 'supabase'

interface YandexConfig {
  endpoint: string
  region: string
  bucket: string
  keyId: string
  secret: string
}

export function photoStorageDriver(): StorageDriver {
  return process.env.STORAGE_DRIVER === 'yandex' ? 'yandex' : 'supabase'
}

function yandexConfig(): YandexConfig {
  const endpoint = (process.env.YC_S3_ENDPOINT ?? 'https://storage.yandexcloud.net').replace(/\/+$/, '')
  const region = process.env.YC_S3_REGION ?? 'ru-central1'
  const bucket = process.env.YC_S3_BUCKET ?? ''
  const keyId = process.env.YC_S3_KEY_ID ?? ''
  const secret = process.env.YC_S3_SECRET ?? ''
  const missing = [
    !bucket && 'YC_S3_BUCKET',
    !keyId && 'YC_S3_KEY_ID',
    !secret && 'YC_S3_SECRET',
  ].filter(Boolean)
  if (missing.length) {
    throw new Error(`STORAGE_DRIVER=yandex, но не заданы: ${missing.join(', ')}`)
  }
  return { endpoint, region, bucket, keyId, secret }
}

let s3: S3Client | null = null
function s3Client(cfg: YandexConfig): S3Client {
  if (!s3) {
    s3 = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      // Yandex отдаёт публичные объекты по path-style URL — тем же стилем и пишем
      forcePathStyle: true,
      credentials: { accessKeyId: cfg.keyId, secretAccessKey: cfg.secret },
    })
  }
  return s3
}

/** Публичный URL объекта в Яндексе. Пути у нас из [a-zA-Z0-9._-/], кодировать нечего. */
export function yandexPublicUrl(cfg: Pick<YandexConfig, 'endpoint' | 'bucket'>, path: string): string {
  return `${cfg.endpoint}/${cfg.bucket}/${path}`
}

/** Год кэша: имя файла содержит timestamp, содержимое по одному URL не меняется. */
export const PHOTO_CACHE_CONTROL = 'public, max-age=31536000, immutable'

export interface UploadResult {
  url?: string
  error?: string
}

/**
 * Загружает фото и возвращает публичный URL. `path` — `<property_id>/<file>`,
 * первая папка — id объекта: на неё завязана RLS в Supabase и по ней же
 * скрипт переноса раскладывает файлы в Яндексе.
 */
export async function uploadPhoto(
  supabase: SupabaseClient,
  path: string,
  body: Uint8Array,
  contentType: string,
): Promise<UploadResult> {
  if (photoStorageDriver() === 'yandex') {
    const cfg = yandexConfig()
    try {
      await s3Client(cfg).send(new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: path,
        Body: body,
        ContentType: contentType,
        CacheControl: PHOTO_CACHE_CONTROL,
      }))
    } catch (e) {
      return { error: `Ошибка загрузки: ${e instanceof Error ? e.message : String(e)}` }
    }
    return { url: yandexPublicUrl(cfg, path) }
  }

  const { error } = await supabase.storage
    .from(SUPABASE_PHOTO_BUCKET)
    .upload(path, body, { contentType, upsert: false })
  if (error) return { error: `Ошибка загрузки: ${error.message}` }
  const { data } = supabase.storage.from(SUPABASE_PHOTO_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl }
}

export interface PresignedUpload {
  /** Куда браузер шлёт PUT с телом файла */
  uploadUrl: string
  /** Заголовки, которые вошли в подпись — браузер обязан отправить их ровно такими */
  headers: Record<string, string>
  /** Публичный URL, который ляжет в photo_urls после подтверждения */
  publicUrl: string
  path: string
}

/**
 * Подписанная ссылка для загрузки браузером напрямую в Яндекс, минуя Vercel:
 * нет лимита тела Server Action, файлы идут параллельно, трафик не гоняется
 * через США. Для драйвера supabase — null, там остаётся путь через сервер.
 * Ссылка живёт 10 минут; в подпись входят Content-Type и Cache-Control.
 */
export async function presignPhotoUpload(path: string, contentType: string): Promise<PresignedUpload | null> {
  if (photoStorageDriver() !== 'yandex') return null
  const cfg = yandexConfig()
  const uploadUrl = await getSignedUrl(
    s3Client(cfg),
    new PutObjectCommand({ Bucket: cfg.bucket, Key: path, ContentType: contentType, CacheControl: PHOTO_CACHE_CONTROL }),
    { expiresIn: 600 },
  )
  return {
    uploadUrl,
    headers: { 'Content-Type': contentType, 'Cache-Control': PHOTO_CACHE_CONTROL },
    publicUrl: yandexPublicUrl(cfg, path),
    path,
  }
}

/**
 * Есть ли объект в Яндексе. Подтверждение прямой загрузки верит не браузеру,
 * а хранилищу: в photo_urls попадает только то, что реально лежит в бакете.
 * Возвращает размер, чтобы отсечь пустой или подменённый после подписи файл.
 */
export async function yandexPhotoSize(path: string): Promise<number | null> {
  const cfg = yandexConfig()
  try {
    const head = await s3Client(cfg).send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: path }))
    return head.ContentLength ?? 0
  } catch {
    return null
  }
}

/** Публичный URL → путь внутри бакета Яндекса, или null если это не наш URL. */
export function yandexPathFromUrl(url: string): string | null {
  if (!process.env.YC_S3_BUCKET) return null
  const cfg = yandexConfig()
  const prefix = `${cfg.endpoint}/${cfg.bucket}/`
  return url.startsWith(prefix) && url.length > prefix.length ? url.slice(prefix.length) : null
}

/**
 * Удаляет файл по его публичному URL, в каком бы из двух хранилищ он ни лежал.
 * Чужой URL (не наш бакет) молча пропускает — запись в БД уже почищена, а
 * ронять удаление из-за неизвестной ссылки смысла нет.
 */
export async function removePhotoByUrl(supabase: SupabaseClient, url: string): Promise<void> {
  const supabaseMarker = `/storage/v1/object/public/${SUPABASE_PHOTO_BUCKET}/`
  const supabasePath = url.split(supabaseMarker)[1]
  if (supabasePath) {
    await supabase.storage.from(SUPABASE_PHOTO_BUCKET).remove([supabasePath])
    return
  }

  // Ключи Яндекса могут быть заданы и при драйвере supabase (например, откат
  // после переноса) — файл в Яндексе всё равно надо удалить, раз он наш.
  if (!process.env.YC_S3_BUCKET || !process.env.YC_S3_KEY_ID || !process.env.YC_S3_SECRET) return
  const key = yandexPathFromUrl(url)
  if (!key) return
  const cfg = yandexConfig()
  try {
    await s3Client(cfg).send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }))
  } catch {
    // Осиротевший файл в бакете — не повод ломать пользователю удаление фото
  }
}
