import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, FileText, Gauge, CheckSquare, Wallet, ArrowUpRight, KeyRound, Phone, CalendarClock, Receipt,
  Settings2, ClipboardCheck, Scale,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { getSettlementScheme } from '@/features/plans/config/settlement'
import { ReadinessPanel } from '@/components/layout/ReadinessPanel'
import { isActiveRentContract } from '@/features/contracts/config/contract-types'
import { checkProperty } from '@/lib/readiness'
import { StatStrip } from '@/components/layout/StatStrip'
import { buttonVariants } from '@/components/ui/button'
import { MetersPanel, type MeterRow } from '@/features/properties/components/MetersPanel'
import { CommunicationTimeline } from '@/features/communications/components/CommunicationTimeline'
import { PaymentScheduleForm } from '@/features/accounting/components/PaymentScheduleForm'
import {
  PROPERTY_MANAGEMENT_SERVICE_OPTIONS,
  REPORT_FREQUENCY_LABELS,
  toPropertyManagementDefaults,
} from '@/features/contracts/utils/property-management-data'
import { formatAmount, formatDateCompact, formatDeadline } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/** Договоры, по которым объект кому-то сдан: из них приходит арендатор. */
const RENT_CONTRACT_TYPES = ['rent_apartment', 'rent_commercial', 'sublease']

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'К выполнению', in_progress: 'В работе', done: 'Выполнено', cancelled: 'Отменено',
}

/**
 * Карточка объекта в управлении — одно место, где видно договор, деньги по
 * объекту, счётчики и задачи. Данные те же, что в остальных разделах: ничего
 * не дублируется, всё связано через property_id.
 */
export default async function ManagementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Обслуживание — самостоятельная сущность: от него зависят условия расчёта,
  // акт приёма и всё, что считается по объекту.
  const { data: engagement } = await supabase
    .from('management_engagements')
    .select('id, status, settlement_scheme, owner_contact_id, contract_id, notes, started_at, handover:property_handovers(completed_at)')
    .eq('property_id', id)
    .is('ended_at', null)
    .maybeSingle()

  const { data: property } = await supabase
    .from('properties')
    .select('id, title, address, deal_type, status, owner_id, manager_id, management_fee, price')
    .eq('id', id)
    .maybeSingle()

  if (!property) notFound()

  const [
    { data: contracts }, { data: txns }, { data: tasks }, { data: metersRaw },
    { data: owner }, { data: manager },
  ] = await Promise.all([
    supabase.from('contracts')
      .select(`id, contract_number, contract_type, status, amount, deposit, start_date, end_date,
               client_contact_id, contract_type_data, indexation_percent, indexation_period_months, created_at,
               plan_id, plan_rate, settlement_scheme, owner_fixed_amount, owner_payout_day,
               plan:service_plans(title, charge_type, repair_limit, obligations)`)
      .eq('property_id', id).order('start_date', { ascending: false, nullsFirst: false }),
    supabase.from('accounting_transactions')
      .select(`id, type, amount, status, date, due_date, description, contract_id, schedule_seq,
               category:accounting_categories(name)`)
      .eq('property_id', id).order('date', { ascending: false }).limit(100),
    supabase.from('tasks')
      .select('id, title, status, priority, deadline, due_date, regulation_code')
      .eq('property_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('utility_meters')
      .select('id, kind, title, serial_number, unit, tariff, readings:meter_readings(id, reading_date, value, consumption, amount)')
      .eq('property_id', id).eq('is_active', true).order('created_at', { ascending: true }),
    property.owner_id
      ? supabase.from('contacts').select('id, full_name, company_name, phone').eq('id', property.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    property.manager_id
      ? supabase.from('users').select('id, full_name').eq('id', property.manager_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const meters: MeterRow[] = ((metersRaw ?? []) as unknown as MeterRow[]).map(meter => ({
    ...meter,
    readings: [...(meter.readings ?? [])].sort((a, b) => b.reading_date.localeCompare(a.reading_date)),
  }))

  const mgmtContract = (contracts ?? []).find(c => c.contract_type === 'property_management') ?? null

  // Что не доедет до отчёта собственнику, если поле осталось пустым.
  const issues = checkProperty(property, {
    hasActiveRentContract: (contracts ?? []).some(c => isActiveRentContract(c)),
  })

  // Арендатор берётся из договора аренды на этот же объект: в нём сторона
  // «клиент» (client_contact_id) — наниматель. Отдельной связи «управление →
  // арендатор» не нужно, объект у обоих договоров один.
  const rentContracts = (contracts ?? []).filter(c => RENT_CONTRACT_TYPES.includes(c.contract_type))
  const extra = toPropertyManagementDefaults(mgmtContract?.contract_type_data)
  const serviceLabels = (extra.services ?? [])
    .map(v => PROPERTY_MANAGEMENT_SERVICE_OPTIONS.find(o => o.value === v)?.label ?? v)

  const now0 = new Date()
  const todayIso = new Date(Date.UTC(now0.getUTCFullYear(), now0.getUTCMonth(), now0.getUTCDate()))
    .toISOString().slice(0, 10)

  const activeRent = rentContracts.find(c =>
    c.status !== 'cancelled' && (!c.end_date || c.end_date >= todayIso)
  ) ?? null
  const pastRents = rentContracts.filter(c => c !== activeRent)

  const { data: tenant } = activeRent?.client_contact_id
    ? await supabase.from('contacts')
        .select('id, full_name, company_name, phone, email')
        .eq('id', activeRent.client_contact_id)
        .maybeSingle()
    : { data: null }

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const todayStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10)

  const all = txns ?? []
  const sum = (list: typeof all) => list.reduce((s, t) => s + Number(t.amount), 0)
  const incomeMonth = sum(all.filter(t => t.type === 'income' && t.status === 'completed' && t.date >= monthStart))
  const expenseMonth = sum(all.filter(t => t.type === 'expense' && t.status === 'completed' && t.date >= monthStart))
  const planned = all.filter(t => t.status === 'planned' && t.due_date)
  const overdue = planned.filter(t => (t.due_date as string) < todayStr)
  const upcoming = planned
    .filter(t => (t.due_date as string) >= todayStr)
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))

  const tenantDebt = activeRent
    ? sum(all.filter(t =>
        t.contract_id === activeRent.id && t.status === 'planned'
        && t.due_date && (t.due_date as string) < todayStr))
    : 0

  const scheduledCount = activeRent
    ? all.filter(t => t.contract_id === activeRent.id && t.schedule_seq !== null).length
    : 0

  const openTasks = (tasks ?? []).filter(t => !['done', 'cancelled'].includes(t.status))

  // Регламентные задачи: заведены кроном по правилам тарифа. Показываются
  // отдельно от ручных и с разделением на просроченные и предстоящие — иначе
  // «снять показания» тонет среди прочего, а пропущенное показание означает
  // неверный счёт.
  const regulationTasks = openTasks.filter(t => t.regulation_code)
  const overdueRegulation = regulationTasks
    .filter(t => (t.due_date ?? t.deadline) && (t.due_date ?? t.deadline)! < todayStr)
    .sort((a, b) => ((a.due_date ?? a.deadline) ?? '').localeCompare((b.due_date ?? b.deadline) ?? ''))
  const upcomingRegulation = regulationTasks
    .filter(t => (t.due_date ?? t.deadline) && (t.due_date ?? t.deadline)! >= todayStr)
    .sort((a, b) => ((a.due_date ?? a.deadline) ?? '').localeCompare((b.due_date ?? b.deadline) ?? ''))
  const ownerName = owner ? (owner.company_name || owner.full_name) : null

  return (
    <div className="space-y-6">
      <PageHeader
        title={property.title}
        subtitle={property.address ?? 'Объект в управлении'}
        backHref="/management"
        backLabel="Управление"
        actions={
          <>
            {engagement && (
              <>
                <Link href={`/management/${id}/terms`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                  <Settings2 style={{ width: 16, height: 16 }} />
                  Условия
                </Link>
                <Link href={`/management/${id}/handover`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                  <ClipboardCheck style={{ width: 16, height: 16 }} />
                  Акт приёма
                </Link>
                <Link href={`/management/${id}/settlement`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                  <Scale style={{ width: 16, height: 16 }} />
                  Взаиморасчёт
                </Link>
              </>
            )}
            <Link href={`/management/${id}/report`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              <Receipt style={{ width: 16, height: 16 }} />
              Отчёт собственнику
            </Link>
            <Link href={`/accounting/transactions/new?property_id=${id}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              <Wallet style={{ width: 16, height: 16 }} />
              Операция
            </Link>
            <Link href={`/tasks/new?property_id=${id}`} className={buttonVariants({ size: 'sm' })}>
              <Plus style={{ width: 16, height: 16 }} />
              Задача
            </Link>
          </>
        }
      />


      {/* Что не заполнено в обслуживании. Показывается до всех цифр: пока нет
          собственника и схемы расчёта, взаиморасчёт и отчёт посчитать нельзя,
          и любые суммы ниже будут неполными. */}
      {engagement && (() => {
        const handover = Array.isArray(engagement.handover) ? engagement.handover[0] : engagement.handover
        const missing: string[] = []
        if (!engagement.owner_contact_id) missing.push('не указан собственник — не с кем вести взаиморасчёт')
        if (!engagement.settlement_scheme) missing.push('не выбрана схема расчёта — не посчитать ни выплату, ни вознаграждение')
        if (!engagement.contract_id) missing.push('не привязан договор управления')
        if (!handover?.completed_at) missing.push('не закрыт акт приёма — нет начальных показаний и описи')
        if (missing.length === 0) return null

        return (
          <div className="hp-block">
            <div className="hp-block-header">Обслуживание не настроено</div>
            <div className="p-[18px] space-y-3">
              <ul className="space-y-1.5 text-sm text-[var(--hp-ink)]">
                {missing.map(m => (
                  <li key={m} className="flex gap-2">
                    <span className="text-[var(--hp-warn)]">•</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
              {engagement.notes && (
                <p className="text-xs text-[var(--hp-sub)]">{engagement.notes}</p>
              )}
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link href={`/management/${id}/terms`} className="hp-btn-primary">Заполнить условия</Link>
                <Link href={`/management/${id}/handover`} className="hp-btn-secondary">Акт приёма</Link>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Регламент обслуживания: что просрочено и что предстоит. Просроченное
          идёт первым и красным — по FR-028 ни одно плановое действие не должно
          пропадать незаметно. */}
      {regulationTasks.length > 0 && (
        <div className="hp-block">
          <div className="hp-block-header flex items-center justify-between gap-2">
            <span>Регламент обслуживания</span>
            {overdueRegulation.length > 0 && (
              <span className="hp-badge hp-badge-danger">Просрочено: {overdueRegulation.length}</span>
            )}
          </div>
          {[...overdueRegulation, ...upcomingRegulation].slice(0, 8).map(task => {
            const date = task.due_date ?? task.deadline
            const overdue = date != null && date < todayStr
            return (
              <Link key={task.id} href={`/tasks/${task.id}`} className="hp-block-item">
                <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)]">{task.title}</span>
                <span className={`shrink-0 text-[12px] ${overdue ? 'text-[var(--hp-danger)]' : 'text-[var(--hp-sub)]'}`}>
                  {overdue ? 'просрочено ' : 'до '}{date ? formatDateCompact(date) : '—'}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      <ReadinessPanel issues={issues} />

      <StatStrip
        items={[
          { label: 'Доход за месяц', value: `${formatAmount(incomeMonth)} ₽` },
          { label: 'Расход за месяц', value: `${formatAmount(expenseMonth)} ₽` },
          { label: 'Прибыль за месяц', value: `${formatAmount(incomeMonth - expenseMonth)} ₽`, alert: incomeMonth - expenseMonth < 0 },
          {
            label: 'Просрочено',
            value: `${formatAmount(sum(overdue))} ₽`,
            hint: overdue.length > 0 ? `${overdue.length} начислений` : 'нет',
            alert: overdue.length > 0,
          },
          {
            label: 'Ближайший платёж',
            value: upcoming[0] ? formatDateCompact(upcoming[0].due_date) : '—',
            hint: upcoming[0] ? `${formatAmount(Number(upcoming[0].amount))} ₽` : 'не запланирован',
            small: true,
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Договор управления */}
          <div className="hp-block">
            <div className="hp-block-header">Договор управления</div>
            {mgmtContract ? (
              <>
                <Link href={`/contracts/${mgmtContract.id}`} className="hp-block-item">
                  <FileText className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                  <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)] font-semibold">
                    {mgmtContract.contract_number ?? 'Договор управления'}
                  </span>
                  <ArrowUpRight className="w-4 h-4 shrink-0 text-[var(--hp-tertiary)]" />
                </Link>
                <div className="hp-block-row">
                  <span className="label">Срок</span>
                  <span className="value">
                    {mgmtContract.start_date ? formatDateCompact(mgmtContract.start_date) : '—'}
                    {' — '}
                    {mgmtContract.end_date ? formatDateCompact(mgmtContract.end_date) : 'бессрочно'}
                  </span>
                </div>
                <div className="hp-block-row">
                  <span className="label">Вознаграждение</span>
                  <span className="value">
                    {mgmtContract.amount != null
                      ? `${formatAmount(Number(mgmtContract.amount))} ₽/мес`
                      : property.management_fee != null
                        ? `${formatAmount(Number(property.management_fee))} ₽/мес (из карточки объекта)`
                        : '—'}
                  </span>
                </div>
                <div className="hp-block-row">
                  <span className="label">Отчёт собственнику</span>
                  <span className="value">
                    {REPORT_FREQUENCY_LABELS[extra.report_frequency ?? 'monthly']}
                  </span>
                </div>
                <div className="hp-block-row">
                  <span className="label">Услуги</span>
                  <span className="value">
                    {serviceLabels.length > 0
                      ? serviceLabels.join(', ') + (extra.service_other ? `, ${extra.service_other}` : '')
                      : extra.service_other || 'не заданы'}
                  </span>
                </div>
              </>
            ) : (
              <div className="p-[18px] space-y-3">
                <p className="text-sm text-[var(--hp-sub)]">
                  Договор управления не оформлен — сроки, вознаграждение и состав услуг взять неоткуда.
                  {property.management_fee != null && (
                    <> В карточке объекта указано вознаграждение {formatAmount(Number(property.management_fee))} ₽.</>
                  )}
                </p>
                <Link
                  href={`/contracts/new?type=property_management&property_id=${id}`}
                  className={buttonVariants({ size: 'sm' })}
                >
                  <Plus style={{ width: 16, height: 16 }} />
                  Оформить договор управления
                </Link>
              </div>
            )}
          </div>

          {/* Тариф агентства: по составу обязательств видно, чем «Премиум»
              отличается от обычного управления, и кто несёт риск простоя */}
          {mgmtContract && (
            <div className="hp-block">
              <div className="hp-block-header">Тариф и обязательства</div>
              {(() => {
                const plan = mgmtContract.plan as {
                  title?: string
                  charge_type?: string
                  repair_limit?: number | null
                  obligations?: unknown
                } | null

                if (!plan) {
                  return (
                    <div className="p-[18px]">
                      <p className="text-sm text-[var(--hp-sub)]">
                        Тариф в договоре не выбран — вознаграждение и состав обязательств взять неоткуда.
                      </p>
                    </div>
                  )
                }

                const obligations = Array.isArray(plan.obligations)
                  ? (plan.obligations as { code?: string; title?: string }[])
                      .map(o => o?.title)
                      .filter((t): t is string => typeof t === 'string')
                  : []

                const scheme = getSettlementScheme(mgmtContract.settlement_scheme)

                return (
                  <>
                    <div className="hp-block-row">
                      <span className="label">Тариф</span>
                      <span className="value">{plan.title ?? '—'}</span>
                    </div>
                    {scheme && (
                      <>
                        <div className="hp-block-row">
                          <span className="label">Схема расчёта</span>
                          <span className="value">{scheme.label}</span>
                        </div>
                        <div className="hp-block-row">
                          <span className="label">Риск простоя</span>
                          <span className={`value ${scheme.vacancyRiskBearer === 'agency' ? 'danger' : ''}`}>
                            {scheme.vacancyRiskBearer === 'agency' ? 'на агентстве' : 'на собственнике'}
                          </span>
                        </div>
                      </>
                    )}
                    {mgmtContract.settlement_scheme === 'percent' && mgmtContract.plan_rate != null && (
                      <div className="hp-block-row">
                        <span className="label">Удержание агентства</span>
                        <span className="value">{mgmtContract.plan_rate}% от платежа</span>
                      </div>
                    )}
                    {mgmtContract.settlement_scheme === 'fixed' && mgmtContract.owner_fixed_amount != null && (
                      <div className="hp-block-row">
                        <span className="label">Выплата собственнику</span>
                        <span className="value">
                          {formatAmount(Number(mgmtContract.owner_fixed_amount))} ₽/мес
                          {mgmtContract.owner_payout_day != null && `, ${mgmtContract.owner_payout_day}-го числа`}
                        </span>
                      </div>
                    )}
                    {plan.repair_limit != null && (
                      <div className="hp-block-row">
                        <span className="label">Мелкий ремонт за счёт агентства</span>
                        <span className="value">до {formatAmount(Number(plan.repair_limit))} ₽</span>
                      </div>
                    )}
                    {obligations.length > 0 && (
                      <div className="hp-block-row">
                        <span className="label">Что входит</span>
                        <span className="value">{obligations.join(' · ')}</span>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Платежи */}
          <div className="hp-block">
            <div className="hp-block-header">Платежи по объекту</div>
            {overdue.length === 0 && upcoming.length === 0 && all.length === 0 ? (
              <div className="hp-block-item text-[var(--hp-tertiary)]">
                <Wallet className="w-4 h-4 shrink-0" />
                Операций по объекту нет
              </div>
            ) : (
              <>
                {[...overdue, ...upcoming].slice(0, 8).map(t => {
                  const isOverdue = (t.due_date as string) < todayStr
                  return (
                    <Link key={t.id} href={`/accounting/transactions/${t.id}`} className="hp-block-item">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOverdue ? 'bg-[var(--hp-danger)]' : 'bg-[var(--hp-warn)]'}`} />
                      <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)]">
                        {t.description ?? (t.type === 'income' ? 'Поступление' : 'Расход')}
                      </span>
                      <span className={`shrink-0 text-[12px] font-medium ${isOverdue ? 'text-[var(--hp-danger)]' : 'text-[var(--hp-sub)]'}`}>
                        {formatDateCompact(t.due_date)} · {t.type === 'income' ? '+' : '−'}{formatAmount(Number(t.amount))} ₽
                      </span>
                    </Link>
                  )
                })}
                {all.filter(t => t.status === 'completed').slice(0, 5).map(t => (
                  <Link key={t.id} href={`/accounting/transactions/${t.id}`} className="hp-block-item">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--hp-good)]" />
                    <span className="flex-1 min-w-0 truncate text-[var(--hp-sub)]">
                      {t.description ?? (t.type === 'income' ? 'Поступление' : 'Расход')}
                    </span>
                    <span className="shrink-0 text-[12px] text-[var(--hp-sub)]">
                      {formatDateCompact(t.date)} · {t.type === 'income' ? '+' : '−'}{formatAmount(Number(t.amount))} ₽
                    </span>
                  </Link>
                ))}
              </>
            )}
            <Link href={`/accounting/transactions/new?property_id=${id}`} className="hp-block-item text-[var(--hp-accent)] font-semibold">
              <Plus className="w-4 h-4 shrink-0" />
              Добавить операцию по объекту
            </Link>
          </div>

          {/* Разворачивание аренды в график: год аренды — это 12 одинаковых
              ручных форм, и опечатка в дате всплывает только при разборе просрочек.
              Дальше по этим начислениям крон payment-reminders сам напомнит
              арендатору о сроке и о просрочке. */}
          {activeRent && (
            <div className="hp-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[var(--hp-sub)]" />
                <h2 className="font-semibold text-foreground">График начислений по аренде</h2>
              </div>
              <PaymentScheduleForm
                contractId={activeRent.id}
                startDate={activeRent.start_date}
                endDate={activeRent.end_date}
                amount={activeRent.amount === null ? null : Number(activeRent.amount)}
                deposit={activeRent.deposit === null ? null : Number(activeRent.deposit)}
                indexationPercent={activeRent.indexation_percent}
                indexationPeriodMonths={activeRent.indexation_period_months}
                existingCount={scheduledCount}
              />
              {!tenant?.email && (
                <p className="text-xs text-[var(--hp-warn)]">
                  У арендатора не заполнен email — письма о сроке и просрочке уходить не будут.
                </p>
              )}
            </div>
          )}

          {/* Счётчики */}
          <MetersPanel propertyId={id} meters={meters} />
        </div>

        <div className="space-y-4">
          {/* Участники */}
          <div className="hp-block">
            <div className="hp-block-header">Стороны</div>
            {ownerName ? (
              <Link href={`/contacts/${property.owner_id}`} className="hp-block-item">
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-semibold text-[var(--hp-ink)]">{ownerName}</span>
                  <span className="block text-[11.5px] text-[var(--hp-sub)]">Собственник</span>
                </span>
              </Link>
            ) : (
              <div className="hp-block-item text-[var(--hp-tertiary)]">Собственник не указан</div>
            )}
            <div className="hp-block-row">
              <span className="label">Управляющий</span>
              <span className="value">{manager?.full_name ?? '—'}</span>
            </div>
            <Link href={`/properties/${id}`} className="hp-block-item">
              <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)]">Карточка объекта</span>
              <ArrowUpRight className="w-4 h-4 shrink-0 text-[var(--hp-tertiary)]" />
            </Link>
          </div>


          {/* Арендатор — из действующего договора аренды на этот объект */}
          <div className="hp-block">
            <div className="hp-block-header">Арендатор</div>
            {activeRent && tenant ? (
              <>
                <Link href={`/contacts/${tenant.id}`} className="hp-block-item">
                  <KeyRound className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-semibold text-[var(--hp-ink)]">
                      {tenant.company_name || tenant.full_name}
                    </span>
                    <span className="block text-[11.5px] text-[var(--hp-sub)]">
                      по договору {activeRent.contract_number ?? 'аренды'}
                    </span>
                  </span>
                  <ArrowUpRight className="w-4 h-4 shrink-0 text-[var(--hp-tertiary)]" />
                </Link>

                {tenant.phone && (
                  <a href={`tel:${tenant.phone}`} className="hp-block-item">
                    <Phone className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                    <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)]">{tenant.phone}</span>
                  </a>
                )}

                <div className="hp-block-row">
                  <span className="label">Арендная плата</span>
                  <span className="value">
                    {activeRent.amount != null ? `${formatAmount(Number(activeRent.amount))} ₽/мес` : '—'}
                  </span>
                </div>
                {activeRent.deposit != null && (
                  <div className="hp-block-row">
                    <span className="label">Залог</span>
                    <span className="value">{formatAmount(Number(activeRent.deposit))} ₽</span>
                  </div>
                )}
                <div className="hp-block-row">
                  <span className="label">Срок аренды</span>
                  <span className="value">
                    {activeRent.start_date ? formatDateCompact(activeRent.start_date) : '—'}
                    {' — '}
                    {activeRent.end_date ? formatDateCompact(activeRent.end_date) : 'бессрочно'}
                  </span>
                </div>
                <div className="hp-block-row">
                  <span className="label">Долг по аренде</span>
                  <span className={`value${tenantDebt > 0 ? ' text-[var(--hp-danger)]' : ''}`}>
                    {tenantDebt > 0 ? `${formatAmount(tenantDebt)} ₽` : 'нет'}
                  </span>
                </div>

                <Link
                  href={`/accounting/transactions/new?property_id=${id}&contract_id=${activeRent.id}`}
                  className="hp-block-item text-[var(--hp-accent)] font-semibold"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Начислить аренду
                </Link>
                <Link href={`/contracts/${activeRent.id}`} className="hp-block-item">
                  <FileText className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                  <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)]">Договор аренды</span>
                  <ArrowUpRight className="w-4 h-4 shrink-0 text-[var(--hp-tertiary)]" />
                </Link>
              </>
            ) : (
              <div className="p-[18px] space-y-3">
                <p className="text-sm text-[var(--hp-sub)]">
                  Объект никому не сдан. Арендатор появится здесь сам, как только будет
                  оформлен договор аренды на этот объект.
                </p>
                <Link
                  href={`/contracts/new?type=rent_apartment&property_id=${id}${property.owner_id ? `&owner_id=${property.owner_id}` : ''}`}
                  className={buttonVariants({ size: 'sm' })}
                >
                  <Plus style={{ width: 16, height: 16 }} />
                  Сдать в аренду
                </Link>
              </div>
            )}
          </div>

          {/* Прошлые арендаторы */}
          {pastRents.length > 0 && (
            <div className="hp-block">
              <div className="hp-block-header">История аренды</div>
              {pastRents.map(c => (
                <Link key={c.id} href={`/contracts/${c.id}`} className="hp-block-item">
                  <span className="flex-1 min-w-0 truncate text-[var(--hp-sub)]">
                    {c.contract_number ?? 'Договор аренды'}
                  </span>
                  <span className="shrink-0 text-[12px] text-[var(--hp-tertiary)]">
                    {c.end_date ? `до ${formatDateCompact(c.end_date)}` : '—'}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Задачи */}
          <div className="hp-block">
            <div className="hp-block-header">Задачи по объекту</div>
            {openTasks.length === 0 ? (
              <div className="hp-block-item text-[var(--hp-tertiary)]">
                <CheckSquare className="w-4 h-4 shrink-0" />
                Открытых задач нет
              </div>
            ) : (
              openTasks.map(task => {
                const dl = formatDeadline(task.deadline)
                return (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="hp-block-item">
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[var(--hp-ink)]">{task.title}</span>
                      <span className="block text-[11.5px] text-[var(--hp-sub)]">{TASK_STATUS_LABELS[task.status] ?? task.status}</span>
                    </span>
                    {dl && (
                      <span className={`shrink-0 text-[12px] font-medium ${dl.overdue ? 'text-[var(--hp-danger)]' : 'text-[var(--hp-sub)]'}`}>
                        {dl.label}
                      </span>
                    )}
                  </Link>
                )
              })
            )}
            <Link href={`/tasks/new?property_id=${id}`} className="hp-block-item text-[var(--hp-accent)] font-semibold">
              <Plus className="w-4 h-4 shrink-0" />
              Новая задача
            </Link>
          </div>

          {/* Общение с арендатором */}
          {tenant && (
            <CommunicationTimeline contactId={tenant.id} phone={tenant.phone ?? null} limit={10} />
          )}

          {/* Счётчики — сводка */}
          <div className="hp-block">
            <div className="hp-block-header">Показания</div>
            {meters.length === 0 ? (
              <div className="hp-block-item text-[var(--hp-tertiary)]">
                <Gauge className="w-4 h-4 shrink-0" />
                Счётчики не заведены
              </div>
            ) : (
              meters.map(m => (
                <div key={m.id} className="hp-block-row">
                  <span className="label">{m.title || m.kind}</span>
                  <span className="value">
                    {m.readings[0]
                      ? `${m.readings[0].value} ${m.unit} · ${formatDateCompact(m.readings[0].reading_date)}`
                      : 'нет показаний'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
