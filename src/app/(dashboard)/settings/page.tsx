import { createClient } from '@/lib/supabase/server'
import { Settings, Building2, Bell, Shield, Database, ChevronRight, ScrollText, CreditCard, Key, Webhook, Megaphone, Upload, Download, HandCoins, Code2 } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { APP_VERSION, BUILD_SHA } from '@/lib/version'

const roleLabels: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  agent: 'Риелтор',
  accountant: 'Бухгалтер',
}

// Разделы сгруппированы по смыслу, а не свалены в один плоский список —
// тот же принцип, что и в боковом меню (рубрики ПРОДАЖИ/БАЗА/...).
// Иконка-бокс везде нейтральная (см. CLAUDE.md «Иконки, аватары»): цвет
// в системе — только семантика статуса, а не подсветка модуля.
const SETTINGS_GROUPS = [
  {
    title: 'Компания',
    items: [
      { icon: Building2, title: 'Компания', desc: 'Название, логотип, реквизиты для договоров', href: '/settings/company' },
      { icon: HandCoins, title: 'Тарифы агентства', desc: 'Условия работы с собственниками и клиентами', href: '/settings/plans' },
      { icon: Settings, title: 'Общие настройки', desc: 'Язык, валюта, часовой пояс', href: '/settings/general' },
    ],
  },
  {
    title: 'Документы',
    items: [
      { icon: Database, title: 'Шаблоны договоров', desc: 'DOCX-шаблоны, по которым формируются документы', href: '/settings/templates' },
    ],
  },
  {
    title: 'Интеграции',
    items: [
      { icon: Megaphone, title: 'Авито', desc: 'Публикация объектов через автозагрузку', href: '/settings/avito' },
      { icon: CreditCard, title: 'Приём платежей', desc: 'Ссылки на оплату для клиентов агентства', href: '/settings/payments' },
    ],
  },
  {
    title: 'Аккаунт',
    items: [
      { icon: Bell, title: 'Уведомления и письма', desc: 'Напоминания в колокольчике и письма, которые CRM шлёт клиентам', href: '/settings/notifications' },
      { icon: Shield, title: 'Безопасность', desc: 'Пароль, двухфакторная защита, устройства', href: '/settings/security' },
    ],
  },
  {
    title: 'Данные',
    items: [
      { icon: Upload, title: 'Импорт', desc: 'Перенос базы из Excel или CSV', href: '/settings/import' },
      { icon: Download, title: 'Экспорт', desc: 'XML-фиды для площадок и CSV для 1С', href: '/settings/export' },
      { icon: ScrollText, title: 'Журнал изменений', desc: 'Кто и что менял (только администратор)', href: '/settings/audit' },
    ],
  },
]

// Разделы для разработчиков — только администратору и свёрнуты: ими пользуются
// раз в год при подключении внешнего сервиса. Каналы связи и электронная подпись
// скрыты целиком до первого реального использования (docs/HIDDEN.md).
const DEVELOPER_ITEMS = [
  { icon: Key, title: 'API-ключи', desc: 'Доступ для внешних программ', href: '/settings/api' },
  { icon: Webhook, title: 'Вебхуки', desc: 'CRM присылает уведомление о событии на ваш адрес в момент, когда оно происходит', href: '/settings/webhooks' },
]

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from('users').select('id, full_name, email, role, avatar_url, phone').eq('id', user.id).single()
    : { data: null }

  const isAdmin = (profile as { role?: string } | null)?.role === 'admin'
  const initials = (profile as { full_name?: string } | null)?.full_name?.charAt(0)?.toUpperCase() ?? 'U'
  const avatarUrl = (profile as { avatar_url?: string } | null)?.avatar_url ?? null

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <PageHeader title="Настройки" subtitle="Управление системой ХаусПро CRM" />

      {/* Профиль — отдельно от рубрик, это не раздел системы, а сам пользователь */}
      {profile && (
        <Link
          href="/settings/profile"
          className="flex items-center gap-3 hp-card p-4 hp-card-hover transition-colors"
        >
          <div
            className="w-11 h-11 rounded-[var(--hp-radius)] overflow-hidden flex items-center justify-center shrink-0 text-white text-base font-bold"
            style={{ background: 'var(--hp-accent)' }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--hp-ink)] text-sm truncate">
              {(profile as { full_name?: string }).full_name}
            </p>
            <p className="text-xs text-[var(--hp-sub)] mt-0.5 truncate">
              {(profile as { email?: string }).email} ·{' '}
              {roleLabels[(profile as { role?: string }).role ?? ''] ?? (profile as { role?: string }).role}
            </p>
          </div>
          <span className="hidden sm:flex items-center gap-1 text-[var(--hp-accent)] text-sm font-semibold shrink-0">
            Редактировать <ChevronRight style={{ width: 14, height: 14 }} />
          </span>
        </Link>
      )}

      {SETTINGS_GROUPS.map((group) => (
        <div key={group.title} className="hp-block">
          <div className="hp-block-header">{group.title}</div>
          {group.items.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className="hp-block-item">
                <div className="w-9 h-9 flex items-center justify-center shrink-0 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
                  <Icon className="text-[var(--hp-sub)]" style={{ width: 17, height: 17 }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--hp-ink)] text-sm">{item.title}</p>
                  <p className="text-xs text-[var(--hp-sub)] mt-0.5 truncate">{item.desc}</p>
                </div>
                <ChevronRight className="text-[var(--hp-tertiary)] shrink-0" style={{ width: 16, height: 16 }} />
              </Link>
            )
          })}
        </div>
      ))}

      {isAdmin && (
        <details className="hp-block group">
          <summary className="hp-block-header flex items-center justify-between cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2"><Code2 style={{ width: 14, height: 14 }} />Для разработчиков</span>
            <ChevronRight className="transition-transform group-open:rotate-90" style={{ width: 14, height: 14 }} />
          </summary>
          {DEVELOPER_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className="hp-block-item">
                <div className="w-9 h-9 flex items-center justify-center shrink-0 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
                  <Icon className="text-[var(--hp-sub)]" style={{ width: 17, height: 17 }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--hp-ink)] text-sm">{item.title}</p>
                  <p className="text-xs text-[var(--hp-sub)] mt-0.5">{item.desc}</p>
                </div>
              </Link>
            )
          })}
        </details>
      )}

      <p className="text-xs text-[var(--hp-sub)] text-center py-1">
        ХаусПро CRM v{APP_VERSION}{BUILD_SHA ? ` · сборка ${BUILD_SHA}` : ''} · Powered by Next.js + Supabase
      </p>
    </div>
  )
}
