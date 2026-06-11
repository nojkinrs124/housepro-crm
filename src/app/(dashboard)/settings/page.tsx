import { createClient } from '@/lib/supabase/server'
import { Settings, Building2, Bell, Shield, Database, UserCircle } from 'lucide-react'
import Link from 'next/link'

const roleLabels: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  agent: 'Агент',
  accountant: 'Бухгалтер',
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from('users').select('id, full_name, email, role, avatar_url, phone').eq('id', user.id).single()
    : { data: null }

  const initials = (profile as { full_name?: string } | null)?.full_name?.charAt(0)?.toUpperCase() ?? 'U'
  const avatarUrl = (profile as { avatar_url?: string } | null)?.avatar_url ?? null

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Настройки</h1>
        <p className="text-muted-foreground mt-1">Управление системой HousePro CRM</p>
      </div>

      {/* Profile card */}
      {profile && (
        <Link
          href="/settings/profile"
          className="flex items-center gap-4 bg-card border border-border rounded-2xl p-5 hover:shadow-sm hover:border-primary/30 transition-all"
        >
          <div className="w-12 h-12 rounded-2xl bg-primary/10 overflow-hidden flex items-center justify-center shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary text-lg font-bold">{initials}</span>
            )}
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {(profile as { full_name?: string }).full_name}
            </p>
            <p className="text-sm text-muted-foreground">
              {(profile as { email?: string }).email} ·{' '}
              {roleLabels[(profile as { role?: string }).role ?? ''] ?? (profile as { role?: string }).role}
            </p>
          </div>
          <span className="ml-auto text-muted-foreground text-sm">Редактировать профиль →</span>
        </Link>
      )}

      <div className="grid gap-4">
        {[
          {
            icon: Building2,
            title: 'Компания',
            desc: 'Название, логотип, реквизиты',
            color: 'bg-blue-50 text-blue-600',
            href: '/settings/company',
          },
          {
            icon: Bell,
            title: 'Уведомления',
            desc: 'Email и push-уведомления',
            color: 'bg-yellow-50 text-yellow-600',
            href: '/settings/notifications',
          },
          {
            icon: Shield,
            title: 'Безопасность',
            desc: 'Роли, доступы, пароли',
            color: 'bg-green-50 text-green-600',
            href: '/settings/security',
          },
          {
            icon: Database,
            title: 'Шаблоны документов',
            desc: 'DOCX шаблоны договоров',
            color: 'bg-violet-50 text-violet-600',
            href: '/settings/templates',
          },
          {
            icon: Settings,
            title: 'Общие настройки',
            desc: 'Язык, валюта, временная зона',
            color: 'bg-gray-50 text-gray-600',
            href: '/settings/general',
          },
        ].map((item) => {
          const Icon = item.icon
          const card = (
            <div
              key={item.title}
              className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 hover:shadow-sm transition-all cursor-pointer hover:border-primary/30"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
              <span className="ml-auto text-muted-foreground">→</span>
            </div>
          )

          return item.href
            ? <Link key={item.title} href={item.href}>{card}</Link>
            : <div key={item.title}>{card}</div>
        })}
      </div>

      <div className="bg-muted/50 rounded-2xl p-4 text-center">
        <p className="text-sm text-muted-foreground">
          HousePro CRM v1.0.0 · Powered by Next.js + Supabase
        </p>
      </div>
    </div>
  )
}
