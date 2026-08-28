import { createClient } from '@/lib/supabase/server'
import { Settings, Building2, Bell, Shield, Database, ChevronRight, ScrollText, CreditCard, Key, Webhook, Megaphone } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'

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
 <PageHeader title="Настройки" subtitle="Управление системой HousePro CRM" />

 {/* Profile card */}
 {profile && (
 <Link
 href="/settings/profile"
 className="flex items-center gap-4 bg-white border border-slate-100 p-5 transition-all hover:-translate-y-0.5"
 style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
 >
 <div
 className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-white text-base font-bold"
 style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}
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
 icon: CreditCard,
 title: 'Тарифы и оплата',
 desc: 'Управление подпиской и тарифом',
 iconBg: 'bg-blue-50',
 iconColor: 'text-blue-600',
 href: '/settings/billing',
 },
 {
 icon: ScrollText,
 title: 'Журнал аудита',
 desc: 'История изменений (только admin)',
 iconBg: 'bg-amber-50',
 iconColor: 'text-amber-600',
 href: '/settings/audit',
 },
 {
 icon: Key,
 title: 'API ключи',
 desc: 'Доступ для интеграций',
 iconBg: 'bg-indigo-50',
 iconColor: 'text-indigo-600',
 href: '/settings/api',
 },
 {
 icon: Webhook,
 title: 'Вебхуки',
 desc: 'Уведомления о событиях в реальном времени',
 iconBg: 'bg-cyan-50',
 iconColor: 'text-cyan-600',
 href: '/settings/webhooks',
 },
 {
 icon: Megaphone,
 title: 'Авито',
 desc: 'Публикация объектов через автозагрузку',
 iconBg: 'bg-blue-50',
 iconColor: 'text-blue-600',
 href: '/settings/avito',
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
 className="flex items-center gap-4 bg-white border border-slate-100 p-5 transition-all hover:-translate-y-0.5"
 style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}
 >
 <div className={`w-11 h-11 flex items-center justify-center shrink-0 ${item.iconBg}`}>
 <Icon className={item.iconColor} style={{ width: 20, height: 20 }} />
 </div>
 <div className="min-w-0 flex-1">
 <p className="font-semibold text-foreground text-sm">{item.title}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
 </div>
 <ChevronRight className="text-slate-400 shrink-0" style={{ width: 16, height: 16 }} />
 </Link>
 )
 })}
 </div>

 <div className="p-4 text-center" style={{ background: 'rgba(248,250,252,0.8)', border: '1px solid rgba(214,219,235,0.5)' }}>
 <p className="text-xs text-muted-foreground font-medium">
 HousePro CRM v1.0.0 · Powered by Next.js + Supabase
 </p>
 </div>
 </div>
 )
}
