import { createClient } from '@/lib/supabase/server'
import { Settings, Building2, Bell, Shield, Database, ChevronRight } from 'lucide-react'
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
        <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">Настройки</h1>
        <p className="text-[#64748B] mt-1.5 text-sm font-medium">Управление системой HousePro CRM</p>
      </div>

      {/* Profile card */}
      {profile && (
        <Link
          href="/settings/profile"
          className="flex items-center gap-4 bg-white rounded-[20px] border border-slate-100 p-5 transition-all hover:-translate-y-0.5"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
        >
          <div
            className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-white text-base font-bold"
            style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[#111827] text-sm truncate">
              {(profile as { full_name?: string }).full_name}
            </p>
            <p className="text-xs text-[#64748B] mt-0.5 truncate">
              {(profile as { email?: string }).email} ·{' '}
              {roleLabels[(profile as { role?: string }).role ?? ''] ?? (profile as { role?: string }).role}
            </p>
          </div>
          <span className="hidden sm:flex items-center gap-1 text-[#16A34A] text-sm font-semibold shrink-0">
            Редактировать <ChevronRight style={{ width: 14, height: 14 }} />
          </span>
        </Link>
      )}

      <div className="grid gap-3">
        {[
          {
            icon: Building2,
            title: 'Компания',
            desc: 'Название, логотип, реквизиты',
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            href: '/settings/company',
          },
          {
            icon: Bell,
            title: 'Уведомления',
            desc: 'Email и push-уведомления',
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            href: '/settings/notifications',
          },
          {
            icon: Shield,
            title: 'Безопасность',
            desc: 'Роли, доступы, пароли',
            iconBg: 'bg-green-50',
            iconColor: 'text-green-600',
            href: '/settings/security',
          },
          {
            icon: Database,
            title: 'Шаблоны документов',
            desc: 'DOCX шаблоны договоров',
            iconBg: 'bg-violet-50',
            iconColor: 'text-violet-600',
            href: '/settings/templates',
          },
          {
            icon: Settings,
            title: 'Общие настройки',
            desc: 'Язык, валюта, временная зона',
            iconBg: 'bg-slate-100',
            iconColor: 'text-slate-600',
            href: '/settings/general',
          },
        ].map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.title}
              href={item.href}
              className="flex items-center gap-4 bg-white rounded-[20px] border border-slate-100 p-5 transition-all hover:-translate-y-0.5"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg}`}>
                <Icon className={item.iconColor} style={{ width: 20, height: 20 }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#111827] text-sm">{item.title}</p>
                <p className="text-xs text-[#64748B] mt-0.5">{item.desc}</p>
              </div>
              <ChevronRight className="text-[#94A3B8] shrink-0" style={{ width: 16, height: 16 }} />
            </Link>
          )
        })}
      </div>

      <div className="rounded-[16px] p-4 text-center" style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(214,219,235,0.5)' }}>
        <p className="text-xs text-[#64748B] font-medium">
          HousePro CRM v1.0.0 · Powered by Next.js + Supabase
        </p>
      </div>
    </div>
  )
}
