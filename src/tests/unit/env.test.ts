import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('env validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('возвращает значения если переменные заданы', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

    const { env } = await import('@/lib/env')
    expect(env.supabaseUrl).toBe('https://test.supabase.co')
    expect(env.supabaseAnonKey).toBe('test-anon-key')
  })

  it('возвращает пустую строку если переменная не задана (build-safe)', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // В тестовом окружении NODE_ENV=test — не бросает ошибку
    const { env } = await import('@/lib/env')
    expect(env.supabaseUrl).toBe('')
  })

  it('trimит пробелы из значений', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = '  https://test.supabase.co  '
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'

    const { env } = await import('@/lib/env')
    expect(env.supabaseUrl).toBe('https://test.supabase.co')
  })
})
