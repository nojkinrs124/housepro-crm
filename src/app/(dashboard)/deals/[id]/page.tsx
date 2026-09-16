import { createClient } from '@/lib/supabase/server'
import {
  Edit, Plus, FileText, CheckSquare, ExternalLink, Zap, Eye,
} from 'lucide-react'
import { deleteDealAction } from '@/features/deals/actions/deals.actions'
import { DealStageBar } from '@/features/deals/components/DealStageBar'
import { StageChecklist } from '@/features/directions/components/StageChecklist'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { RecordActions } from '@/components/layout/RecordActions'
import { ConfirmDeleteButton } from '@/components/forms/ConfirmDeleteButton'
import { StatStrip } from '@/components/layout/StatStrip'
import { DEAL_SOURCE_LABELS } from '@/features/deals/config/deal-sources'
import { CONTRACT_TYPE_LABELS } from '@/features/contracts/config/contract-types'
import {
  DEAL_STATUS_LABELS, DEAL_TYPE_LABELS, dealStageBadgeClass,
} from '@/features/deals/config/deal-stages'
import { PROPERTY_TYPE_LABELS } from '@/features/properties/config/property-labels'
import {
  formatAmount, formatDate, formatDateCompact, formatDeadline, formatPhone,
  formatRelative, initials,
} from '@/lib/utils'

const contractStatusLabels: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'черновик',  cls: 'text-[var(--hp-tertiary)]' },
  generated: { label: 'создан',    cls: 'text-[var(--hp-sub)]' },
  signed:    { label: 'подписан',  cls: 'text-[var(--hp-good)]' },
  completed: { label: 'завершён',  cls: 'text-[var(--hp-good)]' },
  cancelled: { label: 'отменён',   cls: 'text-[var(--hp-danger)]' },
}

const contactStatusLabels: Record<string, { label: string; cls: string }> = {
  new:      { label: 'Новый',      cls: 'hp-badge-info' },
  active:   { label: 'Активный',   cls: 'hp-badge-good' },
  vip:      { label: 'VIP',        cls: 'hp-badge-warn' },
  inactive: { label: 'Неактивный', cls: 'hp-badge-neutral' },
}

interface PartyContact {
  id?: string
  full_name?: string
  phone?: string
  status?: string
  company_name?: string
  client_type?: string
}

/** Карточка участника сделки: аватар, имя-ссылка, роль + статус, телефон. */
function Party({ role, contact, fallbackName, fallbackPhone }: {
  role: string
  contact: PartyContact | null
  fallbackName?: string
  fallbackPhone?: string
}) {
  const name = contact?.company_name || contact?.full_name || fallbackName
  const phone = contact?.phone ?? fallbackPhone
  const status = contact?.status ? contactStatusLabels[contact.status] : null

  if (!name) {
    return (
      <div className="hp-block-item">
        <div className="hp-avatar" style={{ background: 'var(--hp-neutral-tint)', color: 'var(--hp-tertiary)' }}>?</div>
        <div className="min-w-0 flex-1">
          <p className="text-[var(--hp-tertiary)]">{role} не указан</p>
          <Link href="/contacts/new" className="text-[11.5px] text-[var(--hp-accent)] hover:underline">
            Добавить контакт
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="hp-block-item">
      <div className="hp-avatar">{initials(name)}</div>
      <div className="min-w-0 flex-1">
        {contact?.id ? (
          <Link href={`/contacts/${contact.id}`}
            className="font-semibold text-[var(--hp-ink)] hover:text-[var(--hp-accent)] transition-colors block truncate">
            {name}
          </Link>
        ) : (
          <p className="font-semibold text-[var(--hp-ink)] truncate">{name}</p>
        )}
        <p className="text-[11.5px] text-[var(--hp-sub)] flex items-center gap-1.5 flex-wrap mt-0.5">
          {role}
          {status && <span className={`hp-badge ${status.cls}`} style={{ padding: '1px 8px', fontSize: 10 }}>{status.label}</span>}
        </p>
        {phone && (
          <a href={`tel:${phone}`}
            className="text-[12.5px] text-[var(--hp-sub)] hover:text-[var(--hp-accent)] transition-colors">
            {formatPhone(phone)}
          </a>
        )}
      </div>
    </div>
  )
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [dealResult, contractsResult, tasksResult] = await Promise.all([
    supabase
      .from('deals')
      .select(`
        *,
        property:properties(id, title, address, property_type, area, land_area, cadastral_number, encumbrances, price),
        manager:users(full_name),
        owner_contact:contacts!deals_owner_contact_id_fkey(id, full_name, company_name, client_type, phone, status),
        client_contact:contacts!deals_client_contact_id_fkey(id, full_name, company_name, client_type, phone, status)
      `)
      .eq('id', id)
      .single(),

    supabase
      .from('contracts')
      .select('id, contract_number, contract_type, status, created_at')
      .eq('deal_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('tasks')
      .select('id, title, status, priority, deadline')
      .eq('deal_id', id)
      .not('status', 'in', '(done,cancelled)')
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(6),
  ])

  const deal = dealResult.data
  if (dealResult.error && dealResult.error.code !== 'PGRST116') {
    throw new Error(`Не удалось загрузить сделку: ${dealResult.error.message}`)
  }
  if (!deal) notFound()

  const contracts = contractsResult.data ?? []
  const tasks = tasksResult.data ?? []

  const ownerContact  = deal.owner_contact as PartyContact | null
  const clientContact = deal.client_contact as PartyContact | null
  const property      = deal.property as {
    id?: string; title?: string; address?: string; property_type?: string
    area?: number; land_area?: number; cadastral_number?: string; encumbrances?: string
  } | null
  const manager = deal.manager as { full_name?: string } | null

  const stageLabel = DEAL_STATUS_LABELS[deal.status] ?? deal.status
  const typeLabel  = DEAL_TYPE_LABELS[deal.deal_type] ?? deal.deal_type
  const dealNo     = deal.deal_number ? `СД-${deal.deal_number}` : `СД-${String(id).slice(0, 6)}`

  const objectLabel = property
    ? [PROPERTY_TYPE_LABELS[property.property_type ?? ''] ?? property.title, property.address]
        .filter(Boolean).join(', ')
    : null

  const commissionPct = deal.amount && deal.commission
    ? Math.round((Number(deal.commission) / Number(deal.amount)) * 1000) / 10
    : null

  const isSale = deal.deal_type === 'sale'
  const bargain = deal.bargain_amount ? Number(deal.bargain_amount) : null

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader
        crumbs={[
          { label: 'Сделки', href: '/deals' },
          { label: stageLabel },
          { label: dealNo },
        ]}
        title={objectLabel ? `Сделка №${deal.deal_number ?? ''} — ${objectLabel}` : `Сделка №${deal.deal_number ?? ''} — ${typeLabel}`}
        badges={
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className={`hp-badge ${dealStageBadgeClass(deal.status, deal.deal_type)}`}>{stageLabel}</span>
            {bargain && <span className="hp-badge hp-badge-danger">Торг</span>}
          </span>
        }
        meta={
          <>
            <span>{typeLabel}</span>
            <span className="sep">·</span>
            <span>создана {formatDate(deal.created_at)}</span>
            {manager?.full_name && (
              <>
                <span className="sep">·</span>
                <span>риелтор {manager.full_name}</span>
              </>
            )}
            {deal.updated_at && (
              <>
                <span className="sep">·</span>
                <span>изменена {formatRelative(deal.updated_at)}</span>
              </>
            )}
          </>
        }
        actions={
          <RecordActions
            /* Оформление — цепочка договор → начисления → задача → статус
               объекта одним подтверждением. Скрыто только у отменённой сделки:
               по завершённой договор нередко оформляют задним числом, а этап
               автоматика назад всё равно не двигает. */
            primary={deal.status !== 'cancelled' && (
              <Link href={`/deals/${id}/complete`} className="hp-btn-primary" data-testid="deal-complete">
                <Zap className="w-4 h-4" />
                Оформить
              </Link>
            )}
            secondary={
              <Link href={`/deals/${id}/edit`} className="hp-btn-secondary" data-testid="deal-edit">
                <Edit className="w-4 h-4" />
                Редактировать
              </Link>
            }
            more={
              <>
                {/* Показ — стадия воронки, но не главное действие карточки:
                    главное — «Оформить». Форма показа подставит объект и клиента. */}
                <Link href={`/showings/new?deal_id=${id}${property?.id ? `&property_id=${property.id}` : ''}${clientContact?.id ? `&contact_id=${clientContact.id}` : ''}`}
                  className="hp-menu-item" role="menuitem">
                  <Eye className="w-4 h-4" />
                  Запланировать показ
                </Link>
              <ConfirmDeleteButton
                action={deleteDealAction.bind(null, id)}
                confirmText={`Удалить сделку ${dealNo}? Договоры, задачи и платежи останутся, но потеряют связь со сделкой. Отменить нельзя.`}
                label="Удалить сделку"
              />
              </>
            }
          />
        }
      />

      {/* KPI-полоса */}
      <StatStrip
        items={[
          {
            label: 'Сумма сделки',
            value: deal.amount
              ? <>{formatAmount(deal.amount)} <span className="text-[var(--hp-tertiary)]">₽</span></>
              : '—',
          },
          {
            label: commissionPct ? `Комиссия ${commissionPct}%` : 'Комиссия',
            value: deal.commission
              ? <>{formatAmount(deal.commission)} <span className="text-[var(--hp-tertiary)]">₽</span></>
              : '—',
          },
          {
            label: 'Аванс',
            value: deal.advance_amount
              ? <>{formatAmount(deal.advance_amount)} <span className="text-[var(--hp-tertiary)]">₽</span></>
              : '—',
            hint: deal.down_payment ? `первый взнос ${formatAmount(deal.down_payment)} ₽` : undefined,
          },
          {
            label: 'Закрытие (план)',
            small: true,
            value: deal.expected_close_date ? formatDate(deal.expected_close_date) : '—',
            hint: deal.expected_close_date ? formatDeadline(deal.expected_close_date)?.label : undefined,
            alert: deal.expected_close_date
              ? !!formatDeadline(deal.expected_close_date)?.overdue && deal.status !== 'completed'
              : false,
          },
        ]}
      />

      {/* Стадии — своя воронка у каждого направления */}
      <DealStageBar dealId={id} status={deal.status} direction={deal.deal_type} />

      {/* Что нужно сделать на текущей стадии, чтобы уйти дальше */}
      <StageChecklist
        dealId={id}
        direction={deal.deal_type}
        stage={deal.status}
        progress={(deal.stage_progress ?? {}) as Record<string, string[]>}
      />

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">

          {/* Объект и условия */}
          <div className="hp-block">
            <div className="hp-block-header flex items-center justify-between">
              <span>Объект и условия</span>
              {property?.id ? (
                <Link href={`/properties/${property.id}`}
                  className="flex items-center gap-1 normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
                  Карточка объекта
                  <ExternalLink className="w-3 h-3" />
                </Link>
              ) : (
                <Link href="/properties/new" target="_blank"
                  className="flex items-center gap-1 normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
                  <Plus className="w-3 h-3" />
                  Создать объект
                </Link>
              )}
            </div>

            <div className="hp-block-grid">
              <div className="hp-block-row">
                <span className="label">Тип объекта</span>
                <span className="value">
                  {property
                    ? [
                        PROPERTY_TYPE_LABELS[property.property_type ?? ''] ?? '—',
                        property.area ? `${property.area} м²` : null,
                      ].filter(Boolean).join(', ')
                    : <span className="text-[var(--hp-tertiary)]">не привязан</span>}
                </span>
              </div>
              <div className="hp-block-row">
                <span className="label">Форма оплаты</span>
                <span className="value">
                  {[deal.payment_method, deal.bank_name].filter(Boolean).join(', ') || <span className="text-[var(--hp-tertiary)]">—</span>}
                </span>
              </div>

              <div className="hp-block-row">
                <span className="label">Адрес</span>
                <span className="value">{property?.address ?? '—'}</span>
              </div>
              <div className="hp-block-row">
                <span className="label">{isSale ? 'Первый взнос' : 'Аванс'}</span>
                <span className="value">
                  {deal.down_payment
                    ? `${formatAmount(deal.down_payment)} ₽`
                    : deal.advance_amount ? `${formatAmount(deal.advance_amount)} ₽` : '—'}
                </span>
              </div>

              <div className="hp-block-row">
                <span className="label">Участок</span>
                <span className="value">{property?.land_area ? `${property.land_area} сот.` : '—'}</span>
              </div>
              <div className="hp-block-row">
                <span className="label">Одобрение банка</span>
                <span className={`value${deal.bank_approval_date ? ' good' : ''}`}>
                  {deal.bank_approval_date ? `получено ${formatDateCompact(deal.bank_approval_date)}` : '—'}
                </span>
              </div>

              <div className="hp-block-row">
                <span className="label">Кадастровый №</span>
                <span className="value">{property?.cadastral_number ?? '—'}</span>
              </div>
              <div className="hp-block-row">
                <span className="label">Торг</span>
                <span className={`value${bargain ? ' danger' : ''}`}>
                  {bargain ? `−${formatAmount(bargain)} ₽ обсуждается` : 'без торга'}
                </span>
              </div>

              <div className="hp-block-row">
                <span className="label">Обременения</span>
                <span className="value">{property?.encumbrances || 'нет'}</span>
              </div>
              <div className="hp-block-row">
                <span className="label">Источник</span>
                <span className="value">{deal.source ? (DEAL_SOURCE_LABELS[deal.source] ?? deal.source) : '—'}</span>
              </div>
            </div>
          </div>

          {/* Ближайшие задачи */}
          <div className="hp-block">
            <div className="hp-block-header flex items-center justify-between">
              <span>Ближайшие задачи</span>
              <Link href={`/tasks/new?deal_id=${id}`}
                className="flex items-center gap-1 normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
                <Plus className="w-3 h-3" />
                Задача
              </Link>
            </div>
            {tasks.length === 0 ? (
              <div className="hp-block-item text-[var(--hp-tertiary)]">
                <CheckSquare className="w-4 h-4 shrink-0" />
                Открытых задач нет
              </div>
            ) : (
              tasks.map(task => {
                const dl = formatDeadline(task.deadline)
                return (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="hp-block-item">
                    <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)]">{task.title}</span>
                    {dl && (
                      <span className={`shrink-0 text-[12px] font-medium ${dl.overdue ? 'text-[var(--hp-danger)]' : 'text-[var(--hp-sub)]'}`}>
                        {dl.label}
                      </span>
                    )}
                  </Link>
                )
              })
            )}
          </div>

          {/* Примечания */}
          {deal.notes && (
            <div className="hp-block">
              <div className="hp-block-header">Примечания</div>
              <p className="px-[18px] py-3 text-sm text-[var(--hp-sub)] whitespace-pre-wrap leading-relaxed">
                {deal.notes}
              </p>
            </div>
          )}

        </div>

        {/* Правая колонка */}
        <div className="space-y-4">

          {/* Участники */}
          <div className="hp-block">
            <div className="hp-block-header">Участники</div>
            <Party role="Собственник" contact={ownerContact} />
            <Party
              role={isSale ? 'Покупатель' : 'Арендатор'}
              contact={clientContact}
            />
            {manager?.full_name && (
              <div className="hp-block-item">
                <div className="hp-avatar" style={{ background: 'var(--hp-neutral-tint)', color: 'var(--hp-sub)' }}>
                  {initials(manager.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--hp-ink)] truncate">{manager.full_name}</p>
                  <p className="text-[11.5px] text-[var(--hp-sub)] mt-0.5">Риелтор</p>
                </div>
              </div>
            )}
          </div>

          {/* Договоры по сделке. Вложения (files) скрыты: бакет не существует
              (задача #35), записей 0 — см. docs/HIDDEN.md. */}
          <div className="hp-block">
            <div className="hp-block-header flex items-center justify-between">
              <span>Договоры</span>
              <Link href={`/contracts/new?deal_id=${id}`}
                className="flex items-center gap-1 normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
                <Plus className="w-3 h-3" />
                Договор
              </Link>
            </div>
            {contracts.length === 0 && (
              <div className="hp-block-item text-[var(--hp-tertiary)]">
                <FileText className="w-4 h-4 shrink-0" />
                Договоров пока нет
              </div>
            )}
            {contracts.map(c => {
              const st = contractStatusLabels[c.status] ?? { label: c.status, cls: 'text-[var(--hp-sub)]' }
              return (
                <Link key={c.id} href={`/contracts/${c.id}`} className="hp-block-item">
                  <FileText className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                  <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)]">
                    {CONTRACT_TYPE_LABELS[c.contract_type] ?? c.contract_number ?? 'Договор'}
                  </span>
                  <span className={`shrink-0 text-[11.5px] font-medium ${st.cls}`}>{st.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
