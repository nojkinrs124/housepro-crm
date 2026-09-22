/**
 * Демо-фикстура личных кабинетов собственника и арендатора.
 *
 *   node e2e/seed-portal.ts            # создать/пересоздать демо
 *   node e2e/seed-portal.ts code       # снова сделать демо-код действующим
 *   node e2e/seed-portal.ts cleanup    # убрать за собой
 *
 * Зачем отдельно от e2e/seed.ts: базовый сид даёт только то, без чего CRM не
 * открывается. Кабинет же показывает расчёты, начисления и счётчики — пустой
 * он ничего не доказывает и потыкать его нельзя. Здесь заводится один объект
 * в управлении со всей обвязкой: договор найма, полгода операций, счётчики с
 * историей, заявки и два доступа в кабинет.
 *
 * Работает только против ЛОКАЛЬНОГО стека: предохранитель
 * assertIsolatedSupabase() роняет скрипт, если в окружении боевой проект.
 * Демо-данные в боевой базе — это чужие «платежи» в отчётах собственника.
 *
 * Код входа фиксированный (DEMO_CODE): доставки кода в системе нет, а
 * выпускать его каждый раз через карточку объекта ради тыканья по кабинету —
 * лишние пять кликов.
 *
 * Кнопка «Получить код» на форме входа выпускает свой, случайный код, и он
 * становится действующим вместо демонстрационного — увидеть его негде, войти
 * после этого нельзя. Поэтому режим `code`: он гасит выпущенные коды и снова
 * кладёт демонстрационный. Приложение при этом не трогаем: поблажка в проверке
 * кода ради удобства осмотра — это дыра в аутентификации кабинета.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertIsolatedSupabase, serviceClient, seed, SMOKE_PREFIX, type ServiceClient } from './seed.ts'
import type { Database } from '../src/types/supabase.ts'
import { generateSignToken, hashSignCode } from '../src/lib/signing.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const envFile = path.join(root, '.env.e2e.branch')
if (!existsSync(envFile)) {
  console.error('Нет .env.e2e.branch — сначала node scripts/e2e/write-branch-env.mjs')
  process.exit(1)
}
for (const line of readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i > 0 && process.env[t.slice(0, i).trim()] === undefined) {
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
}

assertIsolatedSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL)

/**
 * Название объекта — оно же метка демо: по нему идёт и поиск, и уборка.
 *
 * Без префикса __smoke__ намеренно: название видно в кабинете собственника и
 * арендатора, и служебная метка в шапке мешает смотреть на экран как клиент.
 */
const PROPERTY_TITLE = '2-к квартира на Тестовой, 15'
const OWNER_PHONE = '+79990000001'
const TENANT_PHONE = '+79990000002'
const DEMO_CODE = '123456'
/** Код демо живёт сутки: обычные 15 минут истекают посреди осмотра. */
const DEMO_CODE_TTL_HOURS = 24

const RENT = 65000
/** Доля агентства при процентной схеме. */
const RATE = 10

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Сегодня — им датируется всё, что «только что произошло». */
const TODAY = iso(new Date())

/** Дата в этом или прошлом месяце: monthsAgo=0 — текущий. */
function day(monthsAgo: number, dayOfMonth: number): string {
  const now = new Date()
  return iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, dayOfMonth)))
}

async function categoryId(admin: ServiceClient, code: string): Promise<string> {
  const { data } = await admin.from('accounting_categories').select('id').eq('code', code).limit(1).maybeSingle()
  if (!data) throw new Error(`нет категории учёта ${code} — базовые категории не заведены`)
  return data.id as string
}

/**
 * Удаляет прошлое демо целиком.
 *
 * Обновлять по месту не годится: смысл демо — предсказуемые цифры, а
 * повторный запуск поверх старых операций удваивал бы поступления.
 * Порядок — от зависимых к родительским: каскадов здесь нет.
 */
export async function cleanupPortalDemo(admin: ServiceClient, orgId: string): Promise<void> {
  const { data: properties } = await admin
    .from('properties')
    .select('id')
    .eq('organization_id', orgId)
    .eq('title', PROPERTY_TITLE)
  const propertyIds = (properties ?? []).map(p => p.id as string)

  if (propertyIds.length) {
    await admin.from('service_requests').delete().in('property_id', propertyIds)
    await admin.from('tasks').delete().in('property_id', propertyIds)
    await admin.from('accounting_transactions').delete().in('property_id', propertyIds)

    const { data: meters } = await admin.from('utility_meters').select('id').in('property_id', propertyIds)
    const meterIds = (meters ?? []).map(m => m.id as string)
    if (meterIds.length) {
      await admin.from('meter_readings').delete().in('meter_id', meterIds)
      await admin.from('utility_meters').delete().in('id', meterIds)
    }

    await admin.from('portal_access').delete().in('property_id', propertyIds)

    const { data: engagements } = await admin
      .from('management_engagements')
      .select('id')
      .in('property_id', propertyIds)
    const engagementIds = (engagements ?? []).map(e => e.id as string)
    if (engagementIds.length) {
      await admin.from('property_handovers').delete().in('engagement_id', engagementIds)
      // Ссылка на договор управления держит его — снимаем её перед удалением.
      await admin.from('management_engagements').update({ contract_id: null }).in('id', engagementIds)
    }

    await admin.from('contracts').delete().in('property_id', propertyIds)
    await admin.from('management_engagements').delete().in('property_id', propertyIds)
    await admin.from('properties').delete().in('id', propertyIds)
  }

  await admin.from('portal_otp').delete().in('phone', [OWNER_PHONE, TENANT_PHONE])
  await admin.from('contacts').delete().eq('organization_id', orgId).in('phone', [OWNER_PHONE, TENANT_PHONE])
}

/**
 * Кладёт демонстрационный код как действующий для обоих телефонов.
 *
 * Прежние коды гасятся: вход проверяет самый свежий неиспользованный, и
 * оставленный рядом случайный код перебил бы демонстрационный. Хеш считается
 * тем же кодом, что и в проде, — проверка при входе идёт обычным путём.
 */
export async function issueDemoCodes(admin: ServiceClient, orgId: string, userId: string | null): Promise<void> {
  await admin.from('portal_otp').delete().in('phone', [OWNER_PHONE, TENANT_PHONE])

  const expiresAt = new Date(Date.now() + DEMO_CODE_TTL_HOURS * 3600_000).toISOString()
  const { error } = await admin.from('portal_otp').insert(
    [OWNER_PHONE, TENANT_PHONE].map(phone => {
      const token = generateSignToken()
      return {
        organization_id: orgId,
        phone,
        token,
        code_hash: hashSignCode(DEMO_CODE, token),
        channel: 'manual',
        expires_at: expiresAt,
        issued_by: userId,
      }
    })
  )
  if (error) throw new Error(`portal_otp: ${error.message}`)
}

export interface PortalDemo {
  propertyId: string
  ownerPhone: string
  tenantPhone: string
  code: string
}

export async function seedPortalDemo(): Promise<PortalDemo> {
  const { orgId, userId } = await seed()
  const admin = serviceClient()

  await cleanupPortalDemo(admin, orgId)

  // 1. Контакты. Телефон — не деталь профиля, а логин кабинета: без него
  //    доступ не выдать.
  const { data: owner, error: ownerErr } = await admin
    .from('contacts')
    .insert({
      organization_id: orgId,
      full_name: 'Петров Олег Иванович',
      role: 'owner',
      client_type: 'individual',
      status: 'active',
      phone: OWNER_PHONE,
      email: 'owner@housepro.local',
    })
    .select('id')
    .single()
  if (ownerErr) throw new Error(`contacts owner: ${ownerErr.message}`)

  const { data: tenant, error: tenantErr } = await admin
    .from('contacts')
    .insert({
      organization_id: orgId,
      full_name: 'Смирнова Анна Сергеевна',
      role: 'client',
      client_type: 'individual',
      status: 'active',
      phone: TENANT_PHONE,
      email: 'tenant@housepro.local',
    })
    .select('id')
    .single()
  if (tenantErr) throw new Error(`contacts tenant: ${tenantErr.message}`)

  // 2. Объект. manager_id — на него падают задачи из заявок арендатора.
  const { data: property, error: propErr } = await admin
    .from('properties')
    .insert({
      organization_id: orgId,
      title: PROPERTY_TITLE,
      property_type: 'apartment',
      deal_type: 'management',
      status: 'rented',
      address: 'г. Москва, ул. Тестовая, д. 1, кв. 15',
      district: 'Центральный',
      price: RENT,
      deposit: RENT,
      area: 54.3,
      living_area: 32.1,
      kitchen_area: 9.4,
      rooms: 2,
      floor: 7,
      total_floors: 17,
      owner_id: owner.id,
      manager_id: userId,
      description: 'Демо-объект для осмотра личных кабинетов.',
    })
    .select('id')
    .single()
  if (propErr) throw new Error(`properties: ${propErr.message}`)
  const propertyId = property.id as string

  // 3. Обслуживание: процентная схема, полгода в работе.
  const startedAt = day(6, 1)
  const { data: engagement, error: engErr } = await admin
    .from('management_engagements')
    .insert({
      organization_id: orgId,
      property_id: propertyId,
      owner_contact_id: owner.id,
      settlement_scheme: 'percent',
      rate: RATE,
      repair_limit: 15000,
      started_at: startedAt,
      status: 'active',
      notes: 'Демо-обслуживание для кабинетов.',
    })
    .select('id')
    .single()
  if (engErr) throw new Error(`management_engagements: ${engErr.message}`)
  const engagementId = engagement.id as string

  // 4. Договор найма — из него кабинет арендатора берёт срок и сумму, а
  //    кабинет собственника — имя арендатора.
  const { data: contract, error: contractErr } = await admin
    .from('contracts')
    .insert({
      organization_id: orgId,
      contract_number: 'ДЕМО-2026/01',
      contract_type: 'rent_apartment',
      status: 'signed',
      property_id: propertyId,
      client_contact_id: tenant.id,
      owner_contact_id: owner.id,
      manager_id: userId,
      start_date: startedAt,
      end_date: day(-6, 1),
      amount: RENT,
      deposit: RENT,
      notes: `${SMOKE_PREFIX} демо-договор для кабинетов`,
    })
    .select('id')
    .single()
  if (contractErr) throw new Error(`contracts: ${contractErr.message}`)
  const contractId = contract.id as string

  // 4b. Договор управления и акт приёма. Без них карточка объекта у менеджера
  //     честно пишет «без договора» и «дозаполнить»: обслуживание держится на
  //     договорённости, которой в системе нет.
  const { data: mgmtContract, error: mgmtErr } = await admin
    .from('contracts')
    .insert({
      organization_id: orgId,
      contract_number: 'ДЕМО-У-2026/01',
      contract_type: 'property_management',
      status: 'signed',
      property_id: propertyId,
      client_contact_id: owner.id,
      owner_contact_id: owner.id,
      manager_id: userId,
      start_date: startedAt,
      end_date: day(-6, 1),
      amount: RENT,
      settlement_scheme: 'percent',
      plan_rate: RATE,
      notes: `${SMOKE_PREFIX} демо-договор управления`,
    })
    .select('id')
    .single()
  if (mgmtErr) throw new Error(`contracts management: ${mgmtErr.message}`)

  const { error: linkErr } = await admin
    .from('management_engagements')
    .update({ contract_id: mgmtContract.id })
    .eq('id', engagementId)
  if (linkErr) throw new Error(`management_engagements link: ${linkErr.message}`)

  const { error: handoverErr } = await admin.from('property_handovers').insert({
    organization_id: orgId,
    engagement_id: engagementId,
    inventory: [
      { title: 'Холодильник', condition: 'исправен' },
      { title: 'Стиральная машина', condition: 'исправна' },
      { title: 'Кухонный гарнитур', condition: 'без замечаний' },
    ],
    documents: [{ title: 'Выписка ЕГРН', received: true }],
    condition_note: 'Объект принят в хорошем состоянии, замечаний нет.',
    keys_count: 2,
    completed_at: new Date(`${startedAt}T09:00:00Z`).toISOString(),
    created_by: userId,
  })
  if (handoverErr) throw new Error(`property_handovers: ${handoverErr.message}`)

  // 5. Операции за полгода. Поступление арендатора видно обоим кабинетам,
  //    выплата собственнику — только его; расход за счёт собственника
  //    уменьшает сальдо и попадает в месячный отчёт.
  const tenantPayment = await categoryId(admin, 'tenant_payment')
  const ownerPayout = await categoryId(admin, 'owner_payout')
  const repairMinor = await categoryId(admin, 'repair_minor')
  const cleaningCat = await categoryId(admin, 'cleaning')
  const utilities = await categoryId(admin, 'utilities')

  type Operation = Database['public']['Tables']['accounting_transactions']['Insert']
  const base = { organization_id: orgId, property_id: propertyId, engagement_id: engagementId }
  const operations: Operation[] = []

  // Пять закрытых месяцев: платёж 5-го, выплата собственнику 10-го.
  for (let m = 5; m >= 1; m--) {
    operations.push({
      ...base,
      contract_id: contractId,
      contact_id: tenant.id,
      type: 'income',
      category_id: tenantPayment,
      amount: RENT,
      date: day(m, 5),
      due_date: day(m, 5),
      status: 'completed',
      payment_method: 'bank',
      description: 'Аренда за месяц',
      paid_at: new Date(`${day(m, 5)}T10:00:00Z`).toISOString(),
    })
    operations.push({
      ...base,
      contact_id: owner.id,
      type: 'expense',
      category_id: ownerPayout,
      amount: RENT * (1 - RATE / 100),
      date: day(m, 10),
      status: 'completed',
      payment_method: 'bank',
      borne_by: 'agency',
      description: 'Выплата собственнику',
    })
  }

  // Ремонт за счёт собственника — два месяца назад.
  operations.push({
    ...base,
    type: 'expense',
    category_id: repairMinor,
    amount: 4500,
    date: day(2, 18),
    status: 'completed',
    payment_method: 'card',
    borne_by: 'owner',
    description: 'Замена смесителя в ванной',
  })

  // Клининг за счёт агентства — в его результат, но не в расчёт собственника.
  operations.push({
    ...base,
    type: 'expense',
    category_id: cleaningCat,
    amount: 3000,
    date: day(1, 22),
    status: 'completed',
    payment_method: 'card',
    borne_by: 'agency',
    description: 'Уборка после ремонта',
  })

  // Текущий месяц: платёж пришёл, выплата собственнику ещё нет — в кабинете
  // собственника видно живое сальдо в его пользу.
  operations.push({
    ...base,
    contract_id: contractId,
    contact_id: tenant.id,
    type: 'income',
    category_id: tenantPayment,
    amount: RENT,
    date: day(0, 5),
    due_date: day(0, 5),
    status: 'completed',
    payment_method: 'bank',
    description: 'Аренда за месяц',
    paid_at: new Date(`${day(0, 5)}T10:00:00Z`).toISOString(),
  })

  // Просроченная коммуналка — у арендатора появляется долг.
  operations.push({
    ...base,
    contract_id: contractId,
    contact_id: tenant.id,
    type: 'income',
    category_id: utilities,
    amount: 4200,
    date: day(0, 10),
    due_date: day(0, 10),
    status: 'planned',
    description: 'Коммунальные услуги за прошлый месяц',
  })

  // Следующий платёж — он же «ближайший» в кабинете арендатора.
  operations.push({
    ...base,
    contract_id: contractId,
    contact_id: tenant.id,
    type: 'income',
    category_id: tenantPayment,
    amount: RENT,
    date: day(-1, 5),
    due_date: day(-1, 5),
    status: 'planned',
    description: 'Аренда за следующий месяц',
  })

  const { error: opsErr } = await admin.from('accounting_transactions').insert(operations)
  if (opsErr) throw new Error(`accounting_transactions: ${opsErr.message}`)

  // 6. Счётчики с историей: собственник видит расход, арендатор — последнее
  //    показание и форму передачи нового.
  const meterSpecs = [
    { kind: 'electricity', title: 'Электричество', unit: 'кВт·ч', tariff: 6.43, start: 12840, step: 210 },
    { kind: 'cold_water', title: 'Холодная вода', unit: 'м³', tariff: 45.2, start: 318, step: 6 },
    { kind: 'hot_water', title: 'Горячая вода', unit: 'м³', tariff: 210.5, start: 204, step: 4 },
  ]

  for (const spec of meterSpecs) {
    const { data: meter, error: meterErr } = await admin
      .from('utility_meters')
      .insert({
        organization_id: orgId,
        property_id: propertyId,
        kind: spec.kind,
        title: spec.title,
        unit: spec.unit,
        tariff: spec.tariff,
        serial_number: `DEMO-${spec.kind.toUpperCase()}`,
        is_active: true,
      })
      .select('id')
      .single()
    if (meterErr) throw new Error(`utility_meters ${spec.kind}: ${meterErr.message}`)

    const readings = []
    for (let m = 4; m >= 0; m--) {
      const index = 4 - m
      readings.push({
        organization_id: orgId,
        meter_id: meter.id,
        // Последнее показание — сегодняшнее: 25-е число текущего месяца может
        // ещё не наступить, а показание из будущего в кабинете выглядит сбоем.
        reading_date: m === 0 ? TODAY : day(m, 25),
        value: spec.start + spec.step * index,
        consumption: index === 0 ? null : spec.step,
        amount: index === 0 ? null : Math.round(spec.step * spec.tariff * 100) / 100,
        source: m === 0 ? 'tenant' : 'manager',
      })
    }
    const { error: readErr } = await admin.from('meter_readings').insert(readings)
    if (readErr) throw new Error(`meter_readings ${spec.kind}: ${readErr.message}`)
  }

  // 7. Заявки арендатора: одна в работе с задачей, одна закрытая — чтобы в
  //    кабинете была видна и лента, и статусы.
  const { data: task, error: taskErr } = await admin
    .from('tasks')
    .insert({
      organization_id: orgId,
      title: `${SMOKE_PREFIX} Сантехник — ${PROPERTY_TITLE}`,
      description: 'Заявка арендатора: подтекает кран на кухне.',
      status: 'in_progress',
      priority: 'high',
      due_date: TODAY,
      property_id: propertyId,
      engagement_id: engagementId,
      assigned_to: userId,
    })
    .select('id')
    .single()
  if (taskErr) throw new Error(`tasks: ${taskErr.message}`)

  const { error: reqErr } = await admin.from('service_requests').insert([
    {
      organization_id: orgId,
      engagement_id: engagementId,
      property_id: propertyId,
      contact_id: tenant.id,
      category: 'plumbing',
      description: 'Подтекает кран на кухне, вода капает постоянно.',
      status: 'in_progress',
      task_id: task.id,
    },
    {
      organization_id: orgId,
      engagement_id: engagementId,
      property_id: propertyId,
      contact_id: tenant.id,
      category: 'cleaning',
      description: 'Генеральная уборка после ремонта в ванной.',
      status: 'done',
      closed_at: new Date(`${day(1, 24)}T12:00:00Z`).toISOString(),
    },
  ])
  if (reqErr) throw new Error(`service_requests: ${reqErr.message}`)

  // 8. Доступы. Арендаторский несёт contract_id: без него кабинет не покажет
  //    ни срок договора, ни начисления — они читаются строго по договору.
  const { error: accessErr } = await admin.from('portal_access').insert([
    {
      organization_id: orgId,
      contact_id: owner.id,
      role: 'owner',
      property_id: propertyId,
      engagement_id: engagementId,
      phone: OWNER_PHONE,
      granted_by: userId,
    },
    {
      organization_id: orgId,
      contact_id: tenant.id,
      role: 'tenant',
      property_id: propertyId,
      engagement_id: engagementId,
      contract_id: contractId,
      phone: TENANT_PHONE,
      granted_by: userId,
    },
  ])
  if (accessErr) throw new Error(`portal_access: ${accessErr.message}`)

  // 9. Коды входа.
  await issueDemoCodes(admin, orgId, userId)

  return { propertyId, ownerPhone: OWNER_PHONE, tenantPhone: TENANT_PHONE, code: DEMO_CODE }
}

const mode = process.argv[2]

if (mode === 'cleanup') {
  const admin = serviceClient()
  const { data: org } = await admin.from('organizations').select('id').eq('slug', 'smoke-org').maybeSingle()
  if (org) await cleanupPortalDemo(admin, org.id as string)
  console.log('[seed-portal] демо-кабинеты убраны')
} else if (mode === 'code') {
  const admin = serviceClient()
  const { data: org } = await admin.from('organizations').select('id').eq('slug', 'smoke-org').maybeSingle()
  if (!org) throw new Error('нет организации smoke-org — сначала node e2e/seed-portal.ts')
  const { data: granter } = await admin.from('portal_access').select('granted_by').limit(1).maybeSingle()
  await issueDemoCodes(admin, org.id as string, (granter?.granted_by as string | null) ?? null)
  console.log(`[seed-portal] код ${DEMO_CODE} снова действует для ${OWNER_PHONE} и ${TENANT_PHONE}`)
} else {
  const demo = await seedPortalDemo()
  console.log('[seed-portal] готово')
  console.log(`  объект:      ${demo.propertyId}`)
  console.log(`  собственник: ${demo.ownerPhone}, код ${demo.code}`)
  console.log(`  арендатор:   ${demo.tenantPhone}, код ${demo.code}`)
}
