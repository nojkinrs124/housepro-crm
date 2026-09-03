import { vi } from 'vitest'

// Base64-encoded JWT payload: {"org_id":"test-org-id"}
const FAKE_JWT_PAYLOAD = Buffer.from(JSON.stringify({ org_id: 'test-org-id' })).toString('base64')
const FAKE_ACCESS_TOKEN = `header.${FAKE_JWT_PAYLOAD}.signature`

/**
 * Создаёт мок Supabase клиента.
 * Позволяет задать возвращаемые данные / ошибки через chainable builder.
 */
export function createSupabaseMock(overrides: {
  user?: { id: string; email: string } | null
  data?: unknown
  error?: { message: string } | null
  single?: unknown
  /**
   * Роль пользователя, которую вернёт lookup в таблице `users` внутри
   * requirePermission()/lib/permissions.ts. По умолчанию 'admin' — проходит
   * любую проверку прав, чтобы существующие тесты не ломались на пустом месте.
   * Передайте другую роль (или null) для теста именно проверки прав.
   */
  role?: string | null
  /**
   * Ответы по конкретным таблицам. Нужны тем экшенам, которые перед записью
   * собирают факты из нескольких таблиц: с одним общим `data` такой экшен
   * получал бы договор вместо объекта и наоборот.
   */
  tables?: Record<string, { data?: unknown; error?: { message: string } | null; single?: unknown }>
}) {
  const { user = { id: 'test-user-id', email: 'test@test.com' }, data = [], error = null, single, role = 'admin', tables } = overrides

  const usersRoleBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: role ? { role } : null, error: null }),
  }

  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: single ?? (Array.isArray(data) ? data[0] : data), error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: single ?? (Array.isArray(data) ? data[0] : data), error }),
    then: undefined as unknown,
  }

  // Make the builder thenable so await works on it
  queryBuilder.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data, error }).then(resolve)

  /** Построитель с собственными данными — для режима `tables`. */
  function builderFor(spec: { data?: unknown; error?: { message: string } | null; single?: unknown }) {
    const tableData = spec.data ?? []
    const tableError = spec.error ?? null
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'lt', 'lte',
                     'gt', 'gte', 'or', 'not', 'in', 'order', 'limit', 'ilike']) {
      b[m] = vi.fn(() => b)
    }
    const first = spec.single ?? (Array.isArray(tableData) ? tableData[0] : tableData)
    b.single = vi.fn().mockResolvedValue({ data: first, error: tableError })
    b.maybeSingle = vi.fn().mockResolvedValue({ data: first, error: tableError })
    b.then = (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: tableData, error: tableError }).then(resolve)
    return b
  }

  const tableBuilders: Record<string, ReturnType<typeof builderFor>> = {}
  if (tables) {
    for (const [name, spec] of Object.entries(tables)) tableBuilders[name] = builderFor(spec)
  }

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: user
            ? { access_token: FAKE_ACCESS_TOKEN, user }
            : null,
        },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (tableBuilders[table]) return tableBuilders[table]
      return table === 'users' ? usersRoleBuilder : queryBuilder
    }),
    _queryBuilder: queryBuilder,
  }

  return { supabase, queryBuilder }
}
