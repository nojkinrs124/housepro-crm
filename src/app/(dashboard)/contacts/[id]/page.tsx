import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Phone, Mail, MapPin, Edit, MessageCircle, CheckSquare, TrendingUp, FileText, Plus } from 'lucide-react'
import { DeleteContactButton } from '@/features/contacts/components/DeleteContactButton'
import { RepresentativesPanel } from '@/features/contacts/components/RepresentativesPanel'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Contact } from '@/types/database'

const roleLabels: Record<string, string> = {
  client: '👥 Клиент',
  owner:  '🏠 Собственник',
  both:   '🔄 Клиент + Собственник',
}

const statusLabels: Record<string, { label: string; color: string }> = {
  new:      { label: 'Новый',      color: 'bg-gray-100 text-gray-700' },
  active:   { label: 'Активный',   color: 'bg-blue-100 text-blue-700' },
  vip:      { label: 'VIP',        color: 'bg-yellow-100 text-yellow-700' },
  inactive: { label: 'Неактивный', color: 'bg-red-100 text-red-700' },
}

const sourceLabels: Record<string, string> = {
  avito: 'Avito', cian: 'ЦИАН', domclick: 'Домклик',
  instagram: 'Instagram', vk: 'VK', telegram: 'Telegram',
  whatsapp: 'WhatsApp', phone: 'Звонок', referral: 'Рекомендация', other: 'Другое',
}

const dealStatusLabels: Record<string, string> = {
  new: 'Новая', showing: 'Показ', negotiation: 'Переговоры',
  contract: 'Договор', payment: 'Оплата', completed: 'Завершена', cancelled: 'Отменена',
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

  const dealTypeLabels: Record<string, string> = {
    rent: 'Аренда', sale: 'Продажа', management: 'Управление', commercial: 'Коммерция', subrent: 'Субаренда',
  }

  const hasPassport = c.passport_series || c.passport_number || c.passport_issued_by
  const hasAddress  = c.country || c.city || c.street

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/contacts" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к контактам
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight break-words">{c.full_name}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-base">{roleLabels[c.role]}</span>
            {c.client_type === 'legal_entity' && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0 bg-indigo-100 text-indigo-700">
                🏢 Юр. лицо
              </span>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/tasks/new?client_id=${id}`}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-sm font-medium hover:bg-accent transition whitespace-nowrap">
            <Plus className="w-4 h-4" />
            Задача
          </Link>
          <Link href={`/contacts/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition whitespace-nowrap" style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
            <Edit className="w-4 h-4" />
            Редактировать
          </Link>
          <DeleteContactButton contactId={id} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">

          {/* Contacts */}
          <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
            <h2 className="font-semibold text-foreground mb-4">Контактные данные</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {c.phone && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Телефон</p>
                    <a href={`tel:${c.phone}`} className="text-sm font-medium text-foreground hover:text-primary transition">{c.phone}</a>
                  </div>
                </div>
              )}
              {c.email && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <a href={`mailto:${c.email}`} className="text-sm font-medium text-foreground hover:text-primary transition truncate block">{c.email}</a>
                  </div>
                </div>
              )}
              {c.telegram && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telegram</p>
                    <p className="text-sm font-medium text-foreground">{c.telegram}</p>
                  </div>
                </div>
              )}
              {c.whatsapp && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                  <MessageCircle className="w-4 h-4 text-green-500 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">WhatsApp</p>
                    <p className="text-sm font-medium text-foreground">{c.whatsapp}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Passport */}
          {!isLegalEntity && hasPassport && (
            <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
              <h2 className="font-semibold text-foreground mb-4">Паспортные данные</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {(c.passport_series || c.passport_number) && (
                  <div>
                    <p className="text-xs text-muted-foreground">Серия и номер</p>
                    <p className="font-mono text-foreground">{c.passport_series} {c.passport_number}</p>
                  </div>
                )}
                {c.passport_issued_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Дата выдачи</p>
                    <p className="text-foreground">{new Date(c.passport_issued_date).toLocaleDateString('ru-RU')}</p>
                  </div>
                )}
                {c.passport_department_code && (
                  <div>
                    <p className="text-xs text-muted-foreground">Код подразделения</p>
                    <p className="font-mono text-foreground">{c.passport_department_code}</p>
                  </div>
                )}
                {c.passport_issued_by && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Кем выдан</p>
                    <p className="text-foreground">{c.passport_issued_by}</p>
                  </div>
                )}
                {/* Legacy field */}
                {!hasPassport && c.passport && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Паспорт</p>
                    <p className="font-mono text-foreground">{c.passport}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Address */}
          {!isLegalEntity && hasAddress && (
            <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
              <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Адрес регистрации
              </h2>
              <p className="text-sm text-foreground">
                {[
                  c.country, c.region, c.city,
                  c.street && `ул. ${c.street}`,
                  c.house_number && `д. ${c.house_number}`,
                  c.building && `корп. ${c.building}`,
                  c.apartment && `кв. ${c.apartment}`,
                ].filter(Boolean).join(', ')}
              </p>
            </div>
          )}

          {/* Company requisites */}
          {isLegalEntity && (
            <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
              <h2 className="font-semibold text-foreground mb-4">Реквизиты организации</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {c.company_name && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Название</p>
                    <p className="text-foreground font-medium">{c.company_name}</p>
                  </div>
                )}
                {c.inn && (
                  <div>
                    <p className="text-xs text-muted-foreground">ИНН</p>
                    <p className="font-mono text-foreground">{c.inn}</p>
                  </div>
                )}
                {c.kpp && (
                  <div>
                    <p className="text-xs text-muted-foreground">КПП</p>
                    <p className="font-mono text-foreground">{c.kpp}</p>
                  </div>
                )}
                {c.ogrn && (
                  <div>
                    <p className="text-xs text-muted-foreground">ОГРН</p>
                    <p className="font-mono text-foreground">{c.ogrn}</p>
                  </div>
                )}
                {c.legal_address && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Юридический адрес</p>
                    <p className="text-foreground">{c.legal_address}</p>
                  </div>
                )}
                {c.bank_name && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Банк</p>
                    <p className="text-foreground">{c.bank_name}</p>
                  </div>
                )}
                {c.bank_account && (
                  <div>
                    <p className="text-xs text-muted-foreground">Расчётный счёт</p>
                    <p className="font-mono text-foreground">{c.bank_account}</p>
                  </div>
                )}
                {c.corr_account && (
                  <div>
                    <p className="text-xs text-muted-foreground">Корр. счёт</p>
                    <p className="font-mono text-foreground">{c.corr_account}</p>
                  </div>
                )}
                {c.bik && (
                  <div>
                    <p className="text-xs text-muted-foreground">БИК</p>
                    <p className="font-mono text-foreground">{c.bik}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Representatives */}
          {isLegalEntity && (
            <RepresentativesPanel contactId={id} representatives={representatives} />
          )}

          {/* Deals */}
          <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Сделки
              </h2>
              <Link href={`/deals/new?client_id=${id}`}
                className="text-xs text-primary hover:underline">+ Новая сделка</Link>
            </div>
            {!deals || deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Сделок нет</p>
            ) : (
              <div className="space-y-2">
                {deals.map(deal => (
                  <Link key={deal.id} href={`/deals/${deal.id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition">
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
          <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
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
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                    <div>
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{taskStatusLabels[task.status] ?? task.status}</p>
                    </div>
                    {task.deadline && (
                      <p className="text-xs text-muted-foreground">{new Date(task.deadline).toLocaleDateString('ru-RU')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
            <h2 className="font-semibold text-foreground mb-4">Информация</h2>
            <div className="space-y-3 text-sm">
              {c.birth_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Дата рождения</p>
                  <p className="text-foreground">{new Date(c.birth_date).toLocaleDateString('ru-RU')}</p>
                </div>
              )}
              {c.source && (
                <div>
                  <p className="text-xs text-muted-foreground">Источник</p>
                  <p className="text-foreground">{sourceLabels[c.source] ?? c.source}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Добавлен</p>
                <p className="text-foreground">{new Date(c.created_at).toLocaleDateString('ru-RU')}</p>
              </div>
            </div>
          </div>

          {c.comment && (
            <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-5">
              <h2 className="font-semibold text-foreground mb-2">Комментарий</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.comment}</p>
            </div>
          )}

          <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-4 space-y-2">
            <Link href={`/deals/new?client_id=${id}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition">
              <TrendingUp className="w-4 h-4" />
              Создать сделку
            </Link>
            <Link href={`/contracts/new?client_id=${id}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-accent transition">
              <FileText className="w-4 h-4" />
              Создать договор
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
