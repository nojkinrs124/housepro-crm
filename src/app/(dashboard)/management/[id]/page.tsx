import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, FileText, Wallet, ArrowUpRight, KeyRound, Phone, Receipt, Settings2, ClipboardCheck,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { RecordActions } from '@/components/layout/RecordActions'
import { PortalAccessPanel } from '@/features/portal/components/PortalAccessPanel'
import { maskPhone } from '@/lib/signing'
import { ReadinessPanel } from '@/components/layout/ReadinessPanel'
import { isActiveRentContract } from '@/features/contracts/config/contract-types'
import { checkEngagement, checkProperty } from '@/lib/readiness'
import { StatStrip } from '@/components/layout/StatStrip'
import { buttonVariants } from '@/components/ui/button'
import { MetersPanel, type MeterRow } from '@/features/properties/components/MetersPanel'
import { CommunicationTimeline } from '@/features/communications/components/CommunicationTimeline'
import { PaymentScheduleForm } from '@/features/accounting/components/PaymentScheduleForm'
import { formatAmount, formatDateCompact } from '@/lib/utils'
import { OwnerPayoutBlock } from '@/features/management/components/OwnerPayoutForm'
import { ManagementTermsBlock } from '@/features/management/components/ManagementTermsBlock'
import { PropertyTasksBlock } from '@/features/management/components/PropertyTasksBlock'
import { calcSettlement } from '@/features/management/services/settlement.service'
import { loadSettlementOperations } from '@/features/management/data/settlement.data'

export const dynamic = 'force-dynamic'

/** Договоры, по которым объект кому-то сдан: из них приходит арендатор. */
const RENT_CONTRACT_TYPES = ['rent_apartment', 'rent_commercial', 'sublease']

/**
 * Карточка объекта в управлении — одно место, где видно договор, деньги по
 * объекту, счётчики и задачи. Данные те же, что в остальных разделах: ничего
 * не дублируется, всё связано через property_id.
 *
 * Порядок сверху вниз — по частоте вопроса: что дозаполнить → деньги за
 * месяц → сколько должен собственнику → условия → платежи → счётчики.
 * Справа — люди и задачи. Каждый блок с одним действием внутри, поэтому
 * в шапке только то, чему внутри блоков места нет.
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
    .select(`id, status, settlement_scheme, rate, owner_fixed_amount, owner_payout_day, repair_limit,
             owner_contact_id, contract_id, notes, started_at,
             plan:service_plans(title, repair_limit, obligations),
             handover:property_handovers(completed_at)`)
    .eq('property_id', id)
    .is('ended_at', null)
    .maybeSingle()

  // Сальдо с собственником считается здесь же: «сколько я ему должен» — первый
  // вопрос по объекту в управлении, и держать ответ за переходом на отдельную
  // страницу значит не отвечать на него вовсе.
  const settlement = engagement?.settlement_scheme
    ? calcSettlement(
        {
          scheme: engagement.settlement_scheme as 'percent' | 'fixed',
          rate: engagement.rate,
          ownerFixedAmount: engagement.owner_fixed_amount,
          ownerPayoutDay: engagement.owner_payout_day,
          startedAt: engagement.started_at,
        },
        await loadSettlementOperations(supabase, engagement.id),
      )
    : null

  const { data: property } = await supabase
    .from('properties')
    .select('id, title, address, deal_type, status, owner_id, manager_id, management_fee, price')
    .eq('id', id)
    .maybeSingle()

  if (!property) notFound()

  // Собственник для взаиморасчёта — тот, что в условиях обслуживания; карточка
  // объекта — запасной источник, пока условия не заполнены.
  const ownerId = engagement?.owner_contact_id ?? property.owner_id

  const [
    { data: contracts }, { data: txns }, { data: tasks }, { data: metersRaw },
    { data: owner }, { data: manager }, { data: portalAccesses }, { data: portalContacts },
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
    ownerId
      ? supabase.from('contacts').select('id, full_name, company_name, phone').eq('id', ownerId).maybeSingle()
      : Promise.resolve({ data: null }),
    property.manager_id
      ? supabase.from('users').select('id, full_name').eq('id', property.manager_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('portal_access')
      .select('id, role, phone, last_login_at, contact:contacts(full_name, company_name)')
      .eq('property_id', id).is('revoked_at', null),
    supabase.from('contacts')
      .select('id, full_name, company_name, phone, role')
      .in('role', ['owner', 'client', 'both']).order('full_name'),
  ])

  const meters: MeterRow[] = ((metersRaw ?? []) as unknown as MeterRow[]).map(meter => ({
    ...meter,
    readings: [...(meter.readings ?? [])].sort((a, b) => b.reading_date.localeCompare(a.reading_date)),
  }))

  const mgmtContract = (contracts ?? []).find(c => c.contract_type === 'property_management') ?? null

  // Один список «что заполнить»: сначала обслуживание (без собственника и
  // схемы ни одна сумма ниже не считается), потом сам объект.
  const handover = Array.isArray(engagement?.handover) ? engagement.handover[0] : engagement?.handover
  const issues = [
    ...(engagement
      ? checkEngagement({
          propertyId: id,
          owner_contact_id: engagement.owner_contact_id,
          settlement_scheme: engagement.settlement_scheme,
          contract_id: engagement.contract_id,
          handoverCompletedAt: handover?.completed_at ?? null,
        })
      : []),
    ...checkProperty(property, {
      hasActiveRentContract: (contracts ?? []).some(c => isActiveRentContract(c)),
    }),
  ]

  // Арендатор берётся из договора аренды на этот же объект: в нём сторона
  // «клиент» (client_contact_id) — наниматель. Отдельной связи «управление →
  // арендатор» не нужно, объект у обоих договоров один.
  const now = new Date()
  const todayStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString().slice(0, 10)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)

  const rentContracts = (contracts ?? []).filter(c => RENT_CONTRACT_TYPES.includes(c.contract_type))
  const activeRent = rentContracts.find(c =>
    c.status !== 'cancelled' && (!c.end_date || c.end_date >= todayStr)
  ) ?? null
  const pastRents = rentContracts.filter(c => c !== activeRent)

  const { data: tenant } = activeRent?.client_contact_id
    ? await supabase.from('contacts')
        .select('id, full_name, company_name, phone, email')
        .eq('id', activeRent.client_contact_id)
        .maybeSingle()
    : { data: null }

  const all = txns ?? []
  const sum = (list: typeof all) => list.reduce((s, t) => s + Number(t.amount), 0)
  const incomeMonth = sum(all.filter(t => t.type === 'income' && t.status === 'completed' && t.date >= monthStart))
  const expenseMonth = sum(all.filter(t => t.type === 'expense' && t.status === 'completed' && t.date >= monthStart))
  const planned = all.filter(t => t.status === 'planned' && t.due_date)
  const overdue = planned.filter(t => (t.due_date as string) < todayStr)
  const upcoming = planned
    .filter(t => (t.due_date as string) >= todayStr)
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))
  const completed = all.filter(t => t.status === 'completed')

  const tenantDebt = activeRent
    ? sum(all.filter(t =>
        t.contract_id === activeRent.id && t.status === 'planned'
        && t.due_date && (t.due_date as string) < todayStr))
    : 0

  const scheduledCount = activeRent
    ? all.filter(t => t.contract_id === activeRent.id && t.schedule_seq !== null).length
    : 0

  const ownerName = owner ? (owner.company_name || owner.full_name) : null
  const contactOption = (c: { id: string; full_name: string; company_name: string | null; phone: string | null }) =>
    ({ id: c.id, label: c.company_name || c.full_name, hasPhone: Boolean(c.phone) })

  return (
    <div className="space-y-5">
      <PageHeader
        title={property.title}
        subtitle={property.address ?? 'Объект в управлении'}
        backHref="/management"
        backLabel="Управление"
        actions={
          <RecordActions
            primary={
              <Link href={`/accounting/transactions/new?property_id=${id}`} className="hp-btn-primary">
                <Plus className="w-4 h-4" />
                Платёж
              </Link>
            }
            secondary={
              <Link href={`/management/${id}/report`} className="hp-btn-secondary">
                <Receipt className="w-4 h-4" />
                Отчёт собственнику
              </Link>
            }
            more={engagement && (
              <>
                <Link href={`/management/${id}/terms`} className="hp-menu-item" role="menuitem">
                  <Settings2 className="w-4 h-4" />
                  Условия обслуживания
                </Link>
                <Link href={`/management/${id}/handover`} className="hp-menu-item" role="menuitem">
                  <ClipboardCheck className="w-4 h-4" />
                  Акт приёма-передачи
                </Link>
              </>
            )}
          />
        }
      />

      <ReadinessPanel issues={issues} title="Что заполнить" />

      <StatStrip
        items={[
          { label: 'Доход за месяц', value: `${formatAmount(incomeMonth)} ₽` },
          { label: 'Расход за месяц', value: `${formatAmount(expenseMonth)} ₽` },
          { label: 'Прибыль за месяц', value: `${formatAmount(incomeMonth - expenseMonth)} ₽`, alert: incomeMonth - expenseMonth < 0 },
          {
            label: 'Просрочено',
            value: `${formatAmount(sum(overdue))} ₽`,
            hint: overdue.length > 0 ? `${overdue.length} просрочено` : 'нет',
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
          {/* Взаиморасчёт с собственником */}
          {engagement && settlement && !settlement.error && (
            <div className="hp-block">
              <div className="hp-block-header flex items-center justify-between gap-2">
                <span>Взаиморасчёт с собственником</span>
                <Link href={`/management/${id}/settlement`}
                  className="text-[12.5px] font-semibold normal-case tracking-normal text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
                  Подробно
                </Link>
              </div>
              <OwnerPayoutBlock
                engagementId={engagement.id}
                balance={settlement.balance}
                ownerName={ownerName}
              />
              <div className="hp-block-row">
                <span className="label">Поступило от арендатора</span>
                <span className="value">{formatAmount(settlement.tenantPayments)} ₽</span>
              </div>
              <div className="hp-block-row">
                <span className="label">
                  {settlement.agencyResult < 0 ? 'Убыток агентства' : 'Заработано агентством'}
                </span>
                <span className={`value ${settlement.agencyResult < 0 ? 'danger' : ''}`}>
                  {formatAmount(Math.abs(settlement.agencyResult))} ₽
                </span>
              </div>
              <div className="hp-block-row">
                <span className="label">Уже выплачено собственнику</span>
                <span className="value">{formatAmount(settlement.paidToOwner)} ₽</span>
              </div>
            </div>
          )}

          <ManagementTermsBlock
            propertyId={id}
            engagement={engagement}
            contract={mgmtContract}
            propertyFee={property.management_fee}
          />

          {/* Платежи: просроченные и ближайшие — начисления, затем последние проведённые */}
          <div className="hp-block">
            <div className="hp-block-header">Платежи по объекту</div>
            {all.length === 0 ? (
              <div className="hp-block-item text-[var(--hp-tertiary)]">
                <Wallet className="w-4 h-4 shrink-0" />
                Платежей по объекту пока нет
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
                {completed.slice(0, 5).map(t => (
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
              Добавить платёж
            </Link>
            {/* Год аренды — это 12 одинаковых ручных форм: график разворачивает
                договор в начисления разом, дальше крон payment-reminders сам
                напомнит арендатору о сроке и о просрочке. */}
            {activeRent && (
              <div className="p-[18px] border-t border-[var(--hp-border-soft)] space-y-3">
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
          </div>

          <MetersPanel propertyId={id} meters={meters} />
        </div>

        <div className="space-y-4">
          {/* Стороны */}
          <div className="hp-block">
            <div className="hp-block-header">Стороны</div>
            {ownerName ? (
              <Link href={`/contacts/${ownerId}`} className="hp-block-item">
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-semibold text-[var(--hp-ink)]">{ownerName}</span>
                  <span className="block text-[11.5px] text-[var(--hp-sub)]">Собственник</span>
                </span>
                <ArrowUpRight className="w-4 h-4 shrink-0 text-[var(--hp-tertiary)]" />
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

          {/* Арендатор — из действующего договора аренды; прошлые — ниже в том же блоке */}
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
                  <span className="label">Аренда</span>
                  <span className="value">
                    {activeRent.amount != null ? `${formatAmount(Number(activeRent.amount))} ₽/мес` : '—'}
                    {activeRent.deposit != null && (
                      <span className="block text-[11.5px] font-normal text-[var(--hp-sub)]">
                        залог {formatAmount(Number(activeRent.deposit))} ₽
                      </span>
                    )}
                  </span>
                </div>
                <div className="hp-block-row">
                  <span className="label">Срок</span>
                  <span className="value">
                    {!activeRent.start_date && !activeRent.end_date
                      ? 'бессрочно'
                      : `${activeRent.start_date ? formatDateCompact(activeRent.start_date) : '…'} — ${activeRent.end_date ? formatDateCompact(activeRent.end_date) : 'бессрочно'}`}
                  </span>
                </div>
                <div className="hp-block-row">
                  <span className="label">Долг по аренде</span>
                  <span className={`value${tenantDebt > 0 ? ' danger' : ' good'}`}>
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
                  href={`/contracts/new?type=rent_apartment&property_id=${id}${ownerId ? `&owner_id=${ownerId}` : ''}`}
                  className={buttonVariants({ size: 'sm' })}
                >
                  <Plus style={{ width: 16, height: 16 }} />
                  Сдать в аренду
                </Link>
              </div>
            )}
            {pastRents.length > 0 && (
              <>
                <div className="hp-block-row">
                  <span className="label">Раньше сдавался</span>
                </div>
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
              </>
            )}
          </div>

          <PropertyTasksBlock propertyId={id} tasks={tasks ?? []} />

          {tenant && (
            <CommunicationTimeline contactId={tenant.id} phone={tenant.phone ?? null} limit={10} />
          )}

          {/* Доступ собственника и арендатора в личный кабинет — редкое действие,
              поэтому в конце: выдаётся один раз, дальше только смотрят, кто заходил. */}
          {engagement && (
            <PortalAccessPanel
              propertyId={id}
              engagementId={engagement.id}
              accesses={(portalAccesses ?? []).map(a => {
                const contact = Array.isArray(a.contact) ? a.contact[0] : a.contact
                return {
                  id: a.id,
                  role: a.role,
                  contactName: contact ? (contact.company_name || contact.full_name) : 'Контакт',
                  phoneMasked: maskPhone(a.phone),
                  lastLoginAt: a.last_login_at,
                }
              })}
              owners={(portalContacts ?? []).filter(c => c.role === 'owner' || c.role === 'both').map(contactOption)}
              tenants={(portalContacts ?? []).filter(c => c.role === 'client' || c.role === 'both').map(contactOption)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
