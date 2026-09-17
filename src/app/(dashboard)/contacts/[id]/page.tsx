import { createClient } from '@/lib/supabase/server'
import { Phone, Mail, MapPin, Edit, MessageCircle, CheckSquare, TrendingUp, FileText, Plus, Building2 } from 'lucide-react'
import { deleteContactAction } from '@/features/contacts/actions/contacts.actions'
import { RecordActions } from '@/components/layout/RecordActions'
import { ConfirmDeleteButton } from '@/components/forms/ConfirmDeleteButton'
import { CONTACT_SOURCE_LABELS } from '@/features/contacts/config/contact-sources'
import { RepresentativesPanel } from '@/features/contacts/components/RepresentativesPanel'
import { CounterpartyCheckPanel } from '@/features/contacts/components/CounterpartyCheckPanel'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Contact } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { contactDisplayName } from '@/features/contacts/config/display-name'
import { ReadinessPanel } from '@/components/layout/ReadinessPanel'
import { checkContact } from '@/lib/readiness'
import { DEAL_TYPE_LABELS as dealTypeLabels, DEAL_STATUS_LABELS as dealStatusLabels } from '@/features/deals/config/deal-stages'
import { formatDate, formatAmount, formatDeadline } from '@/lib/utils'
import { FilesSection } from '@/features/files/components/FilesSection'

const roleLabels: Record<string, string> = {
  client: 'Клиент',
  owner:  'Собственник',
  both:   'Клиент + Собственник',
}

const statusLabels: Record<string, { label: string; badgeCls: string }> = {
  new:      { label: 'Новый',      badgeCls: 'hp-badge-info' },
  active:   { label: 'Активный',   badgeCls: 'hp-badge-good' },
  vip:      { label: 'VIP',        badgeCls: 'hp-badge-warn' },
  inactive: { label: 'Неактивный', badgeCls: 'hp-badge-neutral' },
}

const taskStatusLabels: Record<string, string> = {
  todo: 'К выполнению', in_progress: 'В работе', done: 'Выполнено', cancelled: 'Отменено',
}

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: contact }, { data: rawTasks }, { data: rawDeals }, { data: rawReps }, { data: rawLeads }] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', id).single(),
    supabase.from('tasks').select('id, title, status, priority, deadline')
      .eq('contact_id', id).order('created_at', { ascending: false }).limit(10),
    supabase.from('deals').select('id, deal_type, status, amount, created_at')
      .or(`owner_contact_id.eq.${id},client_contact_id.eq.${id}`)
      .order('created_at', { ascending: false }).limit(10),
    supabase.from('contact_representatives').select('*').eq('contact_id', id).order('created_at'),
    // Из какого лида пришёл контакт — двусторонняя связь (проход 17.09.2026, L-9).
    supabase.from('leads').select('id, full_name, status, created_at').eq('contact_id', id).order('created_at', { ascending: false }),
  ])

  if (!contact) notFound()
  const leads = rawLeads ?? []

  const c = contact as Contact
  const tasks = rawTasks
  const deals = rawDeals
  const representatives = (rawReps ?? [])
  const isLegalEntity = c.client_type === 'legal_entity'
  const statusInfo = statusLabels[c.status] ?? statusLabels.new

  const issues = checkContact(c)

  const hasPassport = c.passport_series || c.passport_number || c.passport_issued_by
  const hasAddress  = c.country || c.city || c.street

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title={contactDisplayName(c)}
        backHref="/contacts"
        backLabel="Вернуться к контактам"
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-base">{roleLabels[c.role]}</span>
            {c.client_type === 'legal_entity' && c.company_name && c.full_name && (
              <span className="text-base text-[var(--hp-sub)]">· контактное лицо {c.full_name}</span>
            )}
            {c.client_type === 'legal_entity' && (
              <span className="hp-badge hp-badge-neutral">
                <Building2 className="w-3 h-3" />
                Юр. лицо
              </span>
            )}
            <span className={`hp-badge ${statusInfo.badgeCls}`}>
              {statusInfo.label}
            </span>
          </span>
        }
        actions={
          <RecordActions
            primary={
              <Link href={`/deals/new?contact_id=${id}`} className="hp-btn-primary" data-testid="contact-new-deal">
                <TrendingUp className="w-4 h-4" />
                Новая сделка
              </Link>
            }
            secondary={
              <Link href={`/contacts/${id}/edit`} className="hp-btn-secondary" data-testid="contact-edit">
                <Edit className="w-4 h-4" />
                Редактировать
              </Link>
            }
            more={
              <>
                <Link href={`/contracts/new?contact_id=${id}`} className="hp-menu-item" role="menuitem">
                  <FileText className="w-4 h-4" />
                  Создать договор
                </Link>
                <ConfirmDeleteButton
                  action={deleteContactAction.bind(null, id)}
                  confirmText={`Удалить контакт «${c.full_name}»? Сделки и договоры останутся, но потеряют связь с ним. Отменить нельзя.`}
                  label="Удалить контакт"
                />
              </>
            }
          />
        }
      />


      <ReadinessPanel issues={issues} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">

          {/* Contacts */}
          <div className="hp-block">
            <div className="hp-block-header">Контактные данные</div>
            {c.phone && (
              <div className="hp-block-row">
                <span className="label flex items-center gap-2"><Phone className="w-3.5 h-3.5 shrink-0" />Телефон</span>
                <a href={`tel:${c.phone}`} className="value hover:text-[var(--hp-accent)] transition-colors">{c.phone}</a>
              </div>
            )}
            {c.email && (
              <div className="hp-block-row">
                <span className="label flex items-center gap-2"><Mail className="w-3.5 h-3.5 shrink-0" />Email</span>
                <a href={`mailto:${c.email}`} className="value truncate hover:text-[var(--hp-accent)] transition-colors">{c.email}</a>
              </div>
            )}
            {c.telegram && (
              <div className="hp-block-row">
                <span className="label flex items-center gap-2"><MessageCircle className="w-3.5 h-3.5 shrink-0" />Telegram</span>
                <span className="value">{c.telegram}</span>
              </div>
            )}
            {c.whatsapp && (
              <div className="hp-block-row">
                <span className="label flex items-center gap-2"><MessageCircle className="w-3.5 h-3.5 shrink-0" />WhatsApp</span>
                <span className="value">{c.whatsapp}</span>
              </div>
            )}
            {!c.phone && !c.email && !c.telegram && !c.whatsapp && (
              <div className="hp-block-row"><span className="label">Контакты не указаны</span></div>
            )}
          </div>

          {/* Passport */}
          {!isLegalEntity && hasPassport && (
            <div className="hp-block">
              <div className="hp-block-header">Паспортные данные</div>
              {(c.passport_series || c.passport_number) && (
                <div className="hp-block-row">
                  <span className="label">Серия и номер</span>
                  <span className="value">{c.passport_series} {c.passport_number}</span>
                </div>
              )}
              {c.passport_issued_date && (
                <div className="hp-block-row">
                  <span className="label">Дата выдачи</span>
                  <span className="value">{new Date(c.passport_issued_date).toLocaleDateString('ru-RU')}</span>
                </div>
              )}
              {c.passport_department_code && (
                <div className="hp-block-row">
                  <span className="label">Код подразделения</span>
                  <span className="value">{c.passport_department_code}</span>
                </div>
              )}
              {c.passport_issued_by && (
                <div className="hp-block-row">
                  <span className="label">Кем выдан</span>
                  <span className="value">{c.passport_issued_by}</span>
                </div>
              )}
            </div>
          )}

          {/* Address */}
          {!isLegalEntity && hasAddress && (
            <div className="hp-block">
              <div className="hp-block-header flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                Адрес регистрации
              </div>
              <div className="hp-block-row">
                <span className="value text-left">
                  {[
                    c.country, c.region, c.city,
                    c.street && `ул. ${c.street}`,
                    c.house_number && `д. ${c.house_number}`,
                    c.building && `корп. ${c.building}`,
                    c.apartment && `кв. ${c.apartment}`,
                  ].filter(Boolean).join(', ')}
                </span>
              </div>
            </div>
          )}

          {/* Company requisites */}
          {isLegalEntity && (
            <div className="hp-block">
              <div className="hp-block-header">Реквизиты организации</div>
              {c.company_name && (
                <div className="hp-block-row">
                  <span className="label">Название</span>
                  <span className="value">{c.company_name}</span>
                </div>
              )}
              {c.inn && (
                <div className="hp-block-row">
                  <span className="label">ИНН</span>
                  <span className="value">{c.inn}</span>
                </div>
              )}
              {c.kpp && (
                <div className="hp-block-row">
                  <span className="label">КПП</span>
                  <span className="value">{c.kpp}</span>
                </div>
              )}
              {c.ogrn && (
                <div className="hp-block-row">
                  <span className="label">ОГРН</span>
                  <span className="value">{c.ogrn}</span>
                </div>
              )}
              {c.legal_address && (
                <div className="hp-block-row">
                  <span className="label">Юридический адрес</span>
                  <span className="value">{c.legal_address}</span>
                </div>
              )}
              {c.bank_name && (
                <div className="hp-block-row">
                  <span className="label">Банк</span>
                  <span className="value">{c.bank_name}</span>
                </div>
              )}
              {c.bank_account && (
                <div className="hp-block-row">
                  <span className="label">Расчётный счёт</span>
                  <span className="value">{c.bank_account}</span>
                </div>
              )}
              {c.corr_account && (
                <div className="hp-block-row">
                  <span className="label">Корр. счёт</span>
                  <span className="value">{c.corr_account}</span>
                </div>
              )}
              {c.bik && (
                <div className="hp-block-row">
                  <span className="label">БИК</span>
                  <span className="value">{c.bik}</span>
                </div>
              )}
            </div>
          )}

          {/* Representatives */}
          {isLegalEntity && (
            <RepresentativesPanel contactId={id} representatives={representatives} />
          )}

          {/* Проверка по ЕГРЮЛ — только для юрлиц: у физлица проверять нечего. */}
          {isLegalEntity && (
            <CounterpartyCheckPanel
              contactId={id}
              initialSnapshot={c.counterparty_check ?? null}
              checkedAt={c.counterparty_checked_at ?? null}
            />
          )}

          {/* Сделки — создание только главной кнопкой в шапке (одно действие — один способ) */}
          <div className="hp-block">
            <div className="hp-block-header">Сделки</div>
            {!deals || deals.length === 0 ? (
              <div className="hp-block-item text-[var(--hp-tertiary)]">
                <TrendingUp className="w-4 h-4 shrink-0" />
                Сделок пока нет
              </div>
            ) : (
              deals.map(deal => (
                <Link key={deal.id} href={`/deals/${deal.id}`} className="hp-block-item">
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[var(--hp-ink)] font-medium">{dealTypeLabels[deal.deal_type] ?? deal.deal_type}</span>
                    <span className="block text-[11.5px] text-[var(--hp-sub)]">{dealStatusLabels[deal.status] ?? deal.status}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {deal.amount && <span className="block text-sm font-semibold text-[var(--hp-ink)]">{formatAmount(deal.amount)} ₽</span>}
                    <span className="block text-[11.5px] text-[var(--hp-tertiary)]">{formatDate(deal.created_at)}</span>
                  </span>
                </Link>
              ))
            )}
          </div>

          {/* Задачи */}
          <div className="hp-block">
            <div className="hp-block-header flex items-center justify-between">
              <span>Задачи</span>
              <Link href={`/tasks/new?contact_id=${id}`}
                className="flex items-center gap-1 normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
                <Plus className="w-3 h-3" />
                Задача
              </Link>
            </div>
            {!tasks || tasks.length === 0 ? (
              <div className="hp-block-item text-[var(--hp-tertiary)]">
                <CheckSquare className="w-4 h-4 shrink-0" />
                Задач пока нет
              </div>
            ) : (
              tasks.map(task => {
                const dl = formatDeadline(task.deadline)
                return (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="hp-block-item">
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[var(--hp-ink)]">{task.title}</span>
                      <span className="block text-[11.5px] text-[var(--hp-sub)]">{taskStatusLabels[task.status] ?? task.status}</span>
                    </span>
                    {dl && (
                      <span className={`shrink-0 text-[12px] font-medium ${dl.overdue && task.status !== 'done' ? 'text-[var(--hp-danger)]' : 'text-[var(--hp-sub)]'}`}>
                        {dl.label}
                      </span>
                    )}
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="hp-block">
            <div className="hp-block-header">Информация</div>
            {c.birth_date && (
              <div className="hp-block-row">
                <span className="label">Дата рождения</span>
                <span className="value">{formatDate(c.birth_date)}</span>
              </div>
            )}
            {c.source && (
              <div className="hp-block-row">
                <span className="label">Источник</span>
                <span className="value">{CONTACT_SOURCE_LABELS[c.source] ?? c.source}</span>
              </div>
            )}
            <div className="hp-block-row">
              <span className="label">Добавлен</span>
              <span className="value">{formatDate(c.created_at)}</span>
            </div>
            {leads.map(l => (
              <div key={l.id} className="hp-block-row">
                <span className="label">Из лида</span>
                <Link href={`/leads/${l.id}`} className="value underline-offset-2 hover:underline">
                  {l.full_name || 'без имени'} · {formatDate(l.created_at)}
                </Link>
              </div>
            ))}
          </div>

          {c.comment && (
            <div className="hp-block">
              <div className="hp-block-header">Комментарий</div>
              <p className="text-sm text-[var(--hp-sub)] whitespace-pre-wrap px-[18px] py-3">{c.comment}</p>
            </div>
          )}

          {/* Сканы паспорта и документы контакта — приватный бакет documents */}
          <FilesSection clientId={id} title="Документы" />
        </div>
      </div>
    </div>
  )
}
