import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Phone, Mail, MapPin, Edit, MessageCircle, CheckSquare, TrendingUp, FileText, Plus, Building2 } from 'lucide-react'
import { DeleteContactButton } from '@/features/contacts/components/DeleteContactButton'
import { RepresentativesPanel } from '@/features/contacts/components/RepresentativesPanel'
import { CounterpartyCheckPanel } from '@/features/contacts/components/CounterpartyCheckPanel'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Contact } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReadinessPanel } from '@/components/layout/ReadinessPanel'
import { checkContact } from '@/lib/readiness'
import { CommunicationTimeline } from '@/features/communications/components/CommunicationTimeline'
import { DEAL_TYPE_LABELS as dealTypeLabels, DEAL_STATUS_LABELS as dealStatusLabels } from '@/features/deals/config/deal-stages'

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

const sourceLabels: Record<string, string> = {
  avito: 'Avito', cian: 'ЦИАН', domclick: 'Домклик',
  instagram: 'Instagram', vk: 'VK', telegram: 'Telegram',
  whatsapp: 'WhatsApp', phone: 'Звонок', referral: 'Рекомендация', other: 'Другое',
}

const taskStatusLabels: Record<string, string> = {
  todo: 'К выполнению', in_progress: 'В работе', done: 'Выполнено', cancelled: 'Отменено',
}

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: contact }, { data: rawTasks }, { data: rawDeals }, { data: rawReps }] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', id).single(),
    supabase.from('tasks').select('id, title, status, priority, deadline')
      .eq('client_id', id).order('created_at', { ascending: false }).limit(10),
    supabase.from('deals').select('id, deal_type, status, amount, created_at')
      .or(`owner_contact_id.eq.${id},client_contact_id.eq.${id}`)
      .order('created_at', { ascending: false }).limit(10),
    supabase.from('contact_representatives').select('*').eq('contact_id', id).order('created_at'),
  ])

  if (!contact) notFound()

  const c = contact as Contact
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks = rawTasks as any[] | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = rawDeals as any[] | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const representatives = (rawReps ?? []) as any[]
  const isLegalEntity = c.client_type === 'legal_entity'
  const statusInfo = statusLabels[c.status] ?? statusLabels.new

  const issues = checkContact(c)

  const hasPassport = c.passport_series || c.passport_number || c.passport_issued_by
  const hasAddress  = c.country || c.city || c.street

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title={c.full_name}
        backHref="/contacts"
        backLabel="Вернуться к контактам"
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-base">{roleLabels[c.role]}</span>
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
          <>
            <Link href={`/tasks/new?client_id=${id}`}
              className="flex items-center gap-2 px-3 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors whitespace-nowrap">
              <Plus className="w-4 h-4" />
              Задача
            </Link>
            <Link href={`/contacts/${id}/edit`}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors whitespace-nowrap bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)]">
              <Edit className="w-4 h-4" />
              Редактировать
            </Link>
            <DeleteContactButton contactId={id} />
          </>
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
              {/* Legacy field */}
              {!hasPassport && c.passport && (
                <div className="hp-block-row">
                  <span className="label">Паспорт</span>
                  <span className="value">{c.passport}</span>
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

          {/* Deals */}
          <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Сделки
              </h2>
              <Link href={`/deals/new?contact_id=${id}`}
                className="text-xs text-primary hover:underline">+ Новая сделка</Link>
            </div>
            {!deals || deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Сделок нет</p>
            ) : (
              <div className="space-y-2">
                {deals.map(deal => (
                  <Link key={deal.id} href={`/deals/${deal.id}`}
                    className="flex items-center justify-between p-3 rounded-[var(--hp-radius)] hover:bg-accent/50 transition">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {dealTypeLabels[deal.deal_type] ?? deal.deal_type}
                      </p>
                      <p className="text-xs text-muted-foreground">{dealStatusLabels[deal.status] ?? deal.status}</p>
                    </div>
                    <div className="text-right">
                      {deal.amount && (
                        <p className="text-sm font-semibold text-foreground">{Number(deal.amount).toLocaleString('ru-RU')} ₽</p>
                      )}
                      <p className="text-xs text-muted-foreground">{new Date(deal.created_at).toLocaleDateString('ru-RU')}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Tasks */}
          <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                Задачи
              </h2>
              <Link href={`/tasks/new?client_id=${id}`}
                className="text-xs text-primary hover:underline">+ Задача</Link>
            </div>
            {!tasks || tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Задач нет</p>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <Link key={task.id} href={`/tasks/${task.id}`}
                    className="flex items-center justify-between p-3 rounded-[var(--hp-radius)] bg-muted/30 hover:bg-accent/50 transition">
                    <div>
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{taskStatusLabels[task.status] ?? task.status}</p>
                    </div>
                    {task.deadline && (
                      <p className="text-xs text-muted-foreground">{new Date(task.deadline).toLocaleDateString('ru-RU')}</p>
                    )}
                  </Link>
                ))}
              </div>
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
                <span className="value">{new Date(c.birth_date).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
            {c.source && (
              <div className="hp-block-row">
                <span className="label">Источник</span>
                <span className="value">{sourceLabels[c.source] ?? c.source}</span>
              </div>
            )}
            <div className="hp-block-row">
              <span className="label">Добавлен</span>
              <span className="value">{new Date(c.created_at).toLocaleDateString('ru-RU')}</span>
            </div>
          </div>

          {/* Лента общения: звонки из АТС, WhatsApp, письма и ручные заметки. */}
          <CommunicationTimeline contactId={id} phone={c.phone ?? null} />

          {c.comment && (
            <div className="hp-block">
              <div className="hp-block-header">Комментарий</div>
              <p className="text-sm text-[var(--hp-sub)] whitespace-pre-wrap px-[18px] py-3">{c.comment}</p>
            </div>
          )}

          <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] rounded-[var(--hp-radius)] p-4 space-y-2">
            <Link href={`/deals/new?contact_id=${id}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-[var(--hp-radius)] text-sm font-medium hover:bg-primary/20 transition">
              <TrendingUp className="w-4 h-4" />
              Создать сделку
            </Link>
            <Link href={`/contracts/new?contact_id=${id}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-[var(--hp-radius)] text-sm font-medium hover:bg-accent transition">
              <FileText className="w-4 h-4" />
              Создать договор
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
