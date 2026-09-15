import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const s3Send = vi.fn()
// Классы, а не стрелки: адаптер зовёт их через `new`
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = s3Send },
  PutObjectCommand: class { kind = 'put'; constructor(public input: unknown) {} },
  DeleteObjectCommand: class { kind = 'delete'; constructor(public input: unknown) {} },
}))

const YC_ENV = {
  STORAGE_DRIVER: 'yandex',
  YC_S3_ENDPOINT: 'https://storage.yandexcloud.net',
  YC_S3_REGION: 'ru-central1',
  YC_S3_BUCKET: 'housepro-photos',
  YC_S3_KEY_ID: 'key',
  YC_S3_SECRET: 'secret',
}

function fakeSupabase() {
  const upload = vi.fn().mockResolvedValue({ error: null })
  const remove = vi.fn().mockResolvedValue({ error: null })
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/property-photos/${path}` },
  }))
  const client = { storage: { from: vi.fn(() => ({ upload, remove, getPublicUrl })) } }
  return { client: client as unknown as SupabaseClient, upload, remove }
}

async function loadModule() {
  vi.resetModules()
  return import('@/lib/storage/photo-storage')
}

describe('photo-storage', () => {
  const saved = { ...process.env }

  beforeEach(() => {
    s3Send.mockReset().mockResolvedValue({})
    for (const k of Object.keys(YC_ENV)) delete process.env[k]
  })
  afterEach(() => {
    process.env = { ...saved }
  })

  it('без STORAGE_DRIVER пишет в Supabase — старый деплой без новых env не ломается', async () => {
    const { uploadPhoto, photoStorageDriver } = await loadModule()
    const { client, upload } = fakeSupabase()
    expect(photoStorageDriver()).toBe('supabase')

    const res = await uploadPhoto(client, 'p1/1-a.jpg', new Uint8Array([1]), 'image/jpeg')

    expect(upload).toHaveBeenCalledWith('p1/1-a.jpg', expect.any(Uint8Array), { contentType: 'image/jpeg', upsert: false })
    expect(res.url).toBe('https://x.supabase.co/storage/v1/object/public/property-photos/p1/1-a.jpg')
    expect(s3Send).not.toHaveBeenCalled()
  })

  it('STORAGE_DRIVER=yandex кладёт в бакет и отдаёт публичный path-style URL', async () => {
    Object.assign(process.env, YC_ENV)
    const { uploadPhoto } = await loadModule()
    const { client, upload } = fakeSupabase()

    const res = await uploadPhoto(client, 'p1/1-a.jpg', new Uint8Array([1]), 'image/jpeg')

    expect(upload).not.toHaveBeenCalled()
    expect(s3Send).toHaveBeenCalledTimes(1)
    expect(s3Send.mock.calls[0][0]).toMatchObject({
      kind: 'put',
      input: { Bucket: 'housepro-photos', Key: 'p1/1-a.jpg', ContentType: 'image/jpeg' },
    })
    expect(res.url).toBe('https://storage.yandexcloud.net/housepro-photos/p1/1-a.jpg')
  })

  it('STORAGE_DRIVER=yandex без ключей — понятная ошибка, а не тихий фолбэк в Supabase', async () => {
    process.env.STORAGE_DRIVER = 'yandex'
    process.env.YC_S3_BUCKET = 'housepro-photos'
    const { uploadPhoto } = await loadModule()
    const { client, upload } = fakeSupabase()

    await expect(uploadPhoto(client, 'p1/a.jpg', new Uint8Array([1]), 'image/jpeg'))
      .rejects.toThrow(/YC_S3_KEY_ID, YC_S3_SECRET/)
    expect(upload).not.toHaveBeenCalled()
  })

  it('ошибка S3 возвращается как { error }, не бросается', async () => {
    Object.assign(process.env, YC_ENV)
    s3Send.mockRejectedValueOnce(new Error('AccessDenied'))
    const { uploadPhoto } = await loadModule()

    const res = await uploadPhoto(fakeSupabase().client, 'p1/a.jpg', new Uint8Array([1]), 'image/jpeg')
    expect(res.url).toBeUndefined()
    expect(res.error).toContain('AccessDenied')
  })

  it('удаление по URL Supabase идёт в Supabase, даже когда активен Яндекс', async () => {
    Object.assign(process.env, YC_ENV)
    const { removePhotoByUrl } = await loadModule()
    const { client, remove } = fakeSupabase()

    await removePhotoByUrl(client, 'https://x.supabase.co/storage/v1/object/public/property-photos/p1/old.jpg')

    expect(remove).toHaveBeenCalledWith(['p1/old.jpg'])
    expect(s3Send).not.toHaveBeenCalled()
  })

  it('удаление по URL Яндекса идёт в S3, даже когда активен Supabase (откат после переноса)', async () => {
    Object.assign(process.env, YC_ENV, { STORAGE_DRIVER: 'supabase' })
    const { removePhotoByUrl } = await loadModule()
    const { client, remove } = fakeSupabase()

    await removePhotoByUrl(client, 'https://storage.yandexcloud.net/housepro-photos/p1/new.jpg')

    expect(remove).not.toHaveBeenCalled()
    expect(s3Send.mock.calls[0][0]).toMatchObject({
      kind: 'delete',
      input: { Bucket: 'housepro-photos', Key: 'p1/new.jpg' },
    })
  })

  it('чужой URL пропускает молча', async () => {
    Object.assign(process.env, YC_ENV)
    const { removePhotoByUrl } = await loadModule()
    const { client, remove } = fakeSupabase()

    await removePhotoByUrl(client, 'https://images.unsplash.com/photo.jpg')

    expect(remove).not.toHaveBeenCalled()
    expect(s3Send).not.toHaveBeenCalled()
  })
})
