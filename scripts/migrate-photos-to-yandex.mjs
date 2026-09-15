#!/usr/bin/env node
/**
 * Переносит фото объектов из Supabase Storage (бакет property-photos) в Yandex
 * Object Storage и переписывает ссылки в `properties.photo_urls`.
 *
 * Запуск с машины: `npm run migrate:photos`. Флаги:
 *   --dry-run        только показать, что будет перенесено, ничего не менять;
 *   --delete-source  после успешной записи новой ссылки удалить файл из Supabase
 *                    (по умолчанию старые файлы остаются — на случай отката;
 *                    действует только на файлы, перенесённые этим же запуском).
 *
 * Идемпотентен: ссылки, уже ведущие в Яндекс, пропускает; повторный запуск
 * доносит то, что не долетело в прошлый раз. Путь объекта сохраняется как был
 * (`<property_id>/<файл>`), меняется только домен.
 *
 * Входит обычным пользователем (учётка из .env.e2e) — RLS ограничивает его
 * своей организацией, service-role ключ не нужен. Если организаций с фото
 * несколько, скрипт гоняется под пользователем каждой.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const DELETE_SOURCE = process.argv.includes('--delete-source')

const SUPABASE_BUCKET = 'property-photos'
const SUPABASE_MARKER = `/storage/v1/object/public/${SUPABASE_BUCKET}/`

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const email = process.env.E2E_TEST_EMAIL
const password = process.env.E2E_TEST_PASSWORD

const endpoint = (process.env.YC_S3_ENDPOINT ?? 'https://storage.yandexcloud.net').replace(/\/+$/, '')
const region = process.env.YC_S3_REGION ?? 'ru-central1'
const bucket = process.env.YC_S3_BUCKET
const keyId = process.env.YC_S3_KEY_ID
const secret = process.env.YC_S3_SECRET

if (!url || !key) {
  console.error('Нет NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY — проверьте .env.local')
  process.exit(1)
}
if (!email || !password) {
  console.error('Нет E2E_TEST_EMAIL / E2E_TEST_PASSWORD — они лежат в .env.e2e')
  process.exit(1)
}
if (!bucket || !keyId || !secret) {
  console.error('Нет YC_S3_BUCKET / YC_S3_KEY_ID / YC_S3_SECRET — заполните .env.local')
  process.exit(1)
}

const yandexPrefix = `${endpoint}/${bucket}/`
const s3 = new S3Client({
  endpoint,
  region,
  forcePathStyle: true,
  credentials: { accessKeyId: keyId, secretAccessKey: secret },
})

const supabase = createClient(url, key)
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password })
if (authError || !auth.user) {
  console.error('Не удалось войти:', authError?.message ?? 'нет пользователя')
  process.exit(1)
}

const { data: properties, error: listError } = await supabase
  .from('properties')
  .select('id, address, photo_urls')
  .not('photo_urls', 'is', null)
  .order('created_at')
if (listError) {
  console.error('Не удалось прочитать объекты:', listError.message)
  process.exit(1)
}

const todo = (properties ?? [])
  .map((p) => ({ ...p, pending: (p.photo_urls ?? []).filter((u) => u.includes(SUPABASE_MARKER)) }))
  .filter((p) => p.pending.length > 0)

const totalFiles = todo.reduce((n, p) => n + p.pending.length, 0)
console.log(
  `${DRY_RUN ? '[dry-run] ' : ''}Объектов с фото в Supabase: ${todo.length}, файлов: ${totalFiles}` +
  ` → ${yandexPrefix}`,
)
if (todo.length === 0) process.exit(0)

/** Скачивает файл из Supabase и кладёт в Яндекс под тем же путём; возвращает новый URL. */
async function transfer(sourceUrl) {
  const path = sourceUrl.split(SUPABASE_MARKER)[1]
  const res = await fetch(sourceUrl)
  if (!res.ok) throw new Error(`скачивание ${res.status} ${res.statusText}`)
  const body = new Uint8Array(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  if (!DRY_RUN) {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }))
  }
  return { newUrl: `${yandexPrefix}${path}`, path, bytes: body.byteLength }
}

let moved = 0
let failed = 0
let bytes = 0

for (const property of todo) {
  const label = `${property.address ?? property.id} (${property.pending.length} фото)`
  const rewritten = []
  const movedPaths = []
  let propertyFailed = false

  for (const u of property.photo_urls) {
    if (!u.includes(SUPABASE_MARKER)) {
      rewritten.push(u)
      continue
    }
    try {
      const { newUrl, path, bytes: size } = await transfer(u)
      rewritten.push(newUrl)
      movedPaths.push(path)
      bytes += size
      moved++
    } catch (e) {
      // Ссылку оставляем старой: карточка не потеряет фото, а повторный запуск доделает
      console.error(`  ✗ ${u}: ${e instanceof Error ? e.message : e}`)
      rewritten.push(u)
      propertyFailed = true
      failed++
    }
  }

  if (DRY_RUN || movedPaths.length === 0) {
    console.log(`  ${DRY_RUN ? '→' : '–'} ${label}`)
    continue
  }

  const { error: updateError } = await supabase
    .from('properties')
    .update({ photo_urls: rewritten })
    .eq('id', property.id)
  if (updateError) {
    console.error(`  ✗ ${label}: ссылки не записаны — ${updateError.message}`)
    failed += movedPaths.length
    moved -= movedPaths.length
    continue
  }
  console.log(`  ✓ ${label}${propertyFailed ? ' — частично' : ''}`)

  if (DELETE_SOURCE && !propertyFailed) {
    const { error: removeError } = await supabase.storage.from(SUPABASE_BUCKET).remove(movedPaths)
    if (removeError) console.error(`    старые файлы не удалены: ${removeError.message}`)
  }
}

console.log(
  `\nПеренесено: ${moved} файлов (${(bytes / 1024 / 1024).toFixed(1)} МБ), ошибок: ${failed}` +
  (DRY_RUN ? ' — dry-run, база не тронута' : '') +
  (!DRY_RUN && !DELETE_SOURCE && moved > 0
    ? '\nСтарые файлы оставлены в Supabase Storage (property-photos) — после проверки удалить их в Dashboard'
    : ''),
)
process.exit(failed > 0 ? 1 : 0)
