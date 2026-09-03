import { createClient } from '@/lib/supabase/server'
import { Settings, Building2, Bell, Shield, Database, ChevronRight, ScrollText, CreditCard, Key, Webhook, Megaphone, Mail, Upload, Download, PhoneCall, Signature, HandCoins } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { APP_VERSION, BUILD_SHA } from '@/lib/version'

const roleLabels: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  agent: 'Агент',
  accountant: 'Бухгалтер',
}

// Разделы сгруппированы по смыслу, а не свалены в один плоский список —
// тот же принцип, что и в боковом меню (рубрики ПРОДАЖИ/БАЗА/...).
// Иконка-бокс везде нейтральная (см. CLAUDE.md «Иконки, аватары»): цвет
// в системе — только семантика статуса, а не подсветка модуля.
const SETTINGS_GROUPS = [
  {
    title: 'Рабочее пространство',
    items: [
      { icon: Building2, title: 'Компания', desc: 'Название, логотип, реквизиты', href: '/settings/company' },
      { icon: HandCoins, title: 'Тарифы агентства', desc: 'Условия работы с собственниками и клиентами', href: '/settings/plans' },
      { icon: Settings, title: 'Общие настройки', desc: 'Язык, валюта, временная зона', href: '/settings/general' },
      { icon: Bell, title: 'Уведомления', desc: 'Email и push-уведомления', href: '/settings/notifications' },
      { icon: Database, title: 'Шаблоны документов', desc: 'DOCX шаблоны договоров', href: '/settings/templates' },
    ],
  },
  {
    title: 'Доступ и данные',
    items: [
      { icon: Shield, title: 'Безопасность', desc: 'Роли, доступы, пароли', href: '/settings/security' },
      { icon: ScrollText, title: 'Журнал аудита', desc: 'История изменений (только admin)', href: '/settings/audit' },
      { icon: Upload, title: 'Импорт данных', desc: 'Перенос базы из Excel или CSV', href: '/settings/import' },
      { icon: Download, title: 'Экспорт объектов', desc: 'XML-фиды для площадок и CSV для 1С', href: '/settings/export' },
    ],
  },
  {
    title: 'Интеграции',
    items: [
      { icon: Key, title: 'API‑ключи', desc: 'Доступ для интеграций', href: '/settings/api' },
      { icon: Webhook, title: 'Вебхуки', desc: 'Уведомления о событиях в реальном времени', href: '/settings/webhooks' },
      { icon: Megaphone, title: 'Авито', desc: 'Публикация объектов через автозагрузку', href: '/settings/avito' },
      { icon: Mail, title: 'Почта', desc: 'Отправитель и журнал писем клиентам', href: '/settings/email' },
      { icon: PhoneCall, title: 'Каналы связи', desc: 'Телефония и WhatsApp в карточках клиентов', href: '/settings/channels' },
      { icon: CreditCard, title: 'Приём платежей', desc: 'Ссылки на оплату для клиентов агентства', href: '/settings/payments' },
      { icon: Signature, title: 'Электронная подпись', desc: 'Подписание договоров через Подпислон', href: '/settings/signing' },
    ],
  },
]

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from('users').select('id, full_name, email, role, avatar_url, phone').eq('id', user.id).single()
    : { data: null }

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
            <p className="font-semibold text-foreground text-sm truncate">
              {(profile as { full_name?: string }).full_name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
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
                  <p className="font-semibold text-foreground text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.desc}</p>
                </div>
                <ChevronRight className="text-[var(--hp-tertiary)] shrink-0" style={{ width: 16, height: 16 }} />
              </Link>
            )
          })}
        </div>
      ))}

      <p className="text-xs text-muted-foreground text-center py-1">
        ХаусПро CRM v{APP_VERSION}{BUILD_SHA ? ` · сборка ${BUILD_SHA}` : ''} · Powered by Next.js + Supabase
      </p>
    </div>
  )
}
