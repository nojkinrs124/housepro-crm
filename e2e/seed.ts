/**
 * Seed изолированного окружения для смоук-тестов.
 *
 * Наполняет ЛОКАЛЬНЫЙ Supabase минимумом, без которого CRM не открывается:
 * организация, админ-пользователь с профилем и членством, профиль компании.
 * Стадии сделок и направления живут в коде (features/directions/config),
 * в базе им ничего не нужно. Шаблон DOCX не заводим: без шаблона генерация
 * договора идёт через встроенный generateBasicDocx — поток тот же.
 *
 * Идемпотентен: повторный запуск ничего не дублирует.
 * Работает только через service_role и только против локального стека —
 * предохранитель в assertIsolatedSupabase().
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/supabase'

export type ServiceClient = SupabaseClient<Database>

export const SMOKE_PREFIX = '__smoke__'
export const SMOKE_ORG_SLUG = 'smoke-org'

const PROD_PROJECT_REF = 'zwclvcswvhjeqwxrkbte'

export interface SeedResult {
  orgId: string
  userId: string
  email: string
}

export function assertIsolatedSupabase(url: string | undefined): asserts url is string {
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL не задан — нужен .env.e2e.branch')
  if (url.includes(PROD_PROJECT_REF)) {
    throw new Error(
      `ОСТАНОВ: NEXT_PUBLIC_SUPABASE_URL=${url} — это боевой проект. ` +
        'Смоук работает только против локального стека или dev-ветки (.env.e2e.branch).'
    )
  }
  // Облако допустимо только как dev-ветка, и только если её ref назван явно:
  // любой другой *.supabase.co считаем чужим/боевым.
  const branchRef = process.env.E2E_SUPABASE_BRANCH_REF
  if (/supabase\.co/.test(url) && !(branchRef && url.includes(branchRef))) {
    throw new Error(
      `ОСТАНОВ: NEXT_PUBLIC_SUPABASE_URL=${url} — облачный проект без E2E_SUPABASE_BRANCH_REF. ` +
        'Для dev-ветки укажи её ref в .env.e2e.branch.'
    )
  }
}

export function serviceClient(): ServiceClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  assertIsolatedSupabase(url)
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY не задан — нужен .env.e2e.branch')
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function findAuthUserByEmail(admin: ServiceClient, email: string): Promise<string | null> {
  // listUsers без фильтра по email в этой версии SDK — в локальной базе
  // пользователей единицы, страницы в 200 хватает с запасом.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw new Error(`listUsers: ${error.message}`)
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null
}

export async function seed(): Promise<SeedResult> {
  const admin = serviceClient()
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) throw new Error('E2E_TEST_EMAIL / E2E_TEST_PASSWORD не заданы')

  // 1. Пользователь в auth — триггер on_auth_user_created заведёт public.users
  let userId = await findAuthUserByEmail(admin, email)
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Смоук Тестов' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    userId = data.user.id
  }

  // 2. Организация
  const { data: existingOrg, error: orgSelErr } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', SMOKE_ORG_SLUG)
    .maybeSingle()
  if (orgSelErr) throw new Error(`organizations select: ${orgSelErr.message}`)

  let orgId: string
  if (existingOrg?.id) {
    orgId = existingOrg.id as string
  } else {
    const { data, error } = await admin
      .from('organizations')
      .insert({ name: `${SMOKE_PREFIX} Агентство`, slug: SMOKE_ORG_SLUG, onboarding_completed: true })
      .select('id')
      .single()
    if (error) throw new Error(`organizations insert: ${error.message}`)
    orgId = data.id as string
  }

  // 3. Профиль сотрудника: админ организации. Триггер users_guard_privileged_columns
  //    пропускает service_role.
  const { error: userErr } = await admin
    .from('users')
    .upsert(
      { id: userId, email, full_name: 'Смоук Тестов', role: 'admin', organization_id: orgId, is_active: true },
      { onConflict: 'id' }
    )
  if (userErr) throw new Error(`users upsert: ${userErr.message}`)

  const { error: memberErr } = await admin
    .from('organization_members')
    .upsert({ organization_id: orgId, user_id: userId, role: 'admin', is_active: true }, { onConflict: 'organization_id,user_id' })
  if (memberErr) throw new Error(`organization_members upsert: ${memberErr.message}`)

  // 4. Профиль компании — реквизиты для договоров
  const { data: profile, error: profSelErr } = await admin
    .from('company_settings')
    .select('id')
    .eq('organization_id', orgId)
    .eq('is_default', true)
    .maybeSingle()
  if (profSelErr) throw new Error(`company_settings select: ${profSelErr.message}`)
  if (!profile) {
    const { error } = await admin.from('company_settings').insert({
      organization_id: orgId,
      is_default: true,
      legal_form: 'ip',
      name: `${SMOKE_PREFIX} ИП Тестов С.С.`,
      inn: '770000000000',
      ogrn: '300000000000000',
      phone: '+7 900 000-00-00',
      email: 'office@housepro.local',
      address: 'г. Москва, ул. Тестовая, д. 1',
      // Банковские реквизиты — без них счёт (/accounting/invoice) выходит с
      // прочерками (сквозной проход 17.09.2026, AC-8).
      bank_name: 'АО «Тестовый банк»',
      bik: '044525000',
      bank_account: '40802810000000000001',
      corr_account: '30101810000000000000',
      signatory_name: 'Тестов С.С.',
      signatory_position: 'Индивидуальный предприниматель',
      signatory_basis: 'свидетельства о регистрации',
    })
    if (error) throw new Error(`company_settings insert: ${error.message}`)
  }

  return { orgId, userId, email }
}

/**
 * Удаляет всё, что тесты создали с префиксом __smoke__ в этой организации.
 * Пользователя и организацию оставляет — они нужны следующему прогону.
 */
export async function cleanupSmokeRecords(): Promise<void> {
  const admin = serviceClient()
  const { data: org } = await admin.from('organizations').select('id').eq('slug', SMOKE_ORG_SLUG).maybeSingle()
  if (!org) return
  const orgId = org.id as string

  // Порядок — от зависимых к родительским, чтобы не упереться в FK без каскада.
  const { data: contracts } = await admin
    .from('contracts')
    .select('id')
    .eq('organization_id', orgId)
    .like('notes', `${SMOKE_PREFIX}%`)
  const contractIds = (contracts ?? []).map((c) => c.id as string)
  if (contractIds.length) {
    await admin.from('accounting_transactions').delete().in('contract_id', contractIds)
    await admin.from('contract_versions').delete().in('contract_id', contractIds)
    await admin.from('contracts').delete().in('id', contractIds)
  }
  await admin.from('tasks').delete().eq('organization_id', orgId).like('title', `${SMOKE_PREFIX}%`)
  await admin.from('deals').delete().eq('organization_id', orgId).like('notes', `${SMOKE_PREFIX}%`)
  await admin.from('properties').delete().eq('organization_id', orgId).like('title', `${SMOKE_PREFIX}%`)
  await admin.from('contacts').delete().eq('organization_id', orgId).like('full_name', `${SMOKE_PREFIX}%`)
}

// Запуск напрямую: node --experimental-strip-types e2e/seed.ts (или через globalSetup Playwright)
if (process.argv[1] && /seed\.ts$/.test(process.argv[1])) {
  seed()
    .then((r) => console.log(`seed ok: org=${r.orgId} user=${r.userId} (${r.email})`))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
