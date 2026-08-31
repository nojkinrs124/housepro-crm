import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CreditCard, Check, Zap, Building2, ArrowLeft } from 'lucide-react'
import { getFeatureGate, PLAN_LABELS, PLAN_PRICES } from '@/lib/feature-gates'
import { BillingActions } from './BillingActions'

export default async function BillingPage({
 searchParams,
}: {
 searchParams: Promise<{ success?: string; cancelled?: string }>
}) {
 const sp = await searchParams
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
 if (profile?.role !== 'admin') redirect('/settings')

 const { data: org } = await supabase
 .from('organizations')
 .select('id, name, plan, subscription_status, trial_ends_at, stripe_customer_id')
 .eq('id', (await import('@/lib/org').then(m => m.getOrgId())) ?? '')
 .single()

 const currentPlan = (org?.plan ?? 'free') as 'free' | 'pro' | 'enterprise'
 const gate = getFeatureGate(currentPlan)

 const PLANS = [
 {
 id: 'free' as const,
 name: 'Бесплатный',
 price: 0,
 icon: Zap,
 color: 'text-[var(--hp-sub)]',
 bg: 'bg-[var(--hp-neutral-tint)]',
 border: 'border-[var(--hp-border)]',
 features: ['1 пользователь', '20 объектов', '10 договоров', 'Базовая аналитика'],
 limits: getFeatureGate('free'),
 },
 {
 id: 'pro' as const,
 name: 'Pro',
 price: PLAN_PRICES.pro.monthly,
 icon: CreditCard,
 color: 'text-primary',
 bg: 'bg-primary/5',
 border: 'border-primary/30',
 popular: true,
 features: ['До 10 пользователей', 'Неограниченно объектов', 'Неограниченно договоров', 'API доступ', 'Приоритетная поддержка'],
 limits: getFeatureGate('pro'),
 },
 {
 id: 'enterprise' as const,
 name: 'Enterprise',
 price: PLAN_PRICES.enterprise.monthly,
 icon: Building2,
 color: 'text-[var(--hp-sub)]',
 bg: 'bg-[var(--hp-neutral-tint)]',
 border: 'border-[var(--hp-border)]',
 features: ['Неограниченно пользователей', 'Неограниченно всего', 'API + Webhooks', 'SLA 99.9%', 'Персональный менеджер'],
 limits: getFeatureGate('enterprise'),
 },
 ]

 return (
 <div className="max-w-4xl mx-auto space-y-8">
 <div className="flex items-center gap-3">
 <Link href="/settings" className="text-muted-foreground hover:text-foreground text-sm">Настройки</Link>
 <span className="text-muted-foreground">/</span>
 <span className="text-sm font-medium">Тарифы и оплата</span>
 </div>

 {sp.success && (
 <div className="flex items-center gap-3 px-4 py-3 bg-[var(--hp-good-tint)] border border-[var(--hp-border)] text-[var(--hp-good)] text-sm">
 <Check className="w-4 h-4 flex-shrink-0" />
 Оплата прошла успешно! Тариф активирован.
 </div>
 )}

 {/* Current plan */}
 <div className="hp-card p-6">
 <h2 className="font-semibold mb-4">Текущий тариф</h2>
 <div className="flex items-center justify-between gap-4 flex-wrap">
 <div>
 <div className="flex items-center gap-2">
 <span className="text-xl font-bold">{PLAN_LABELS[currentPlan]}</span>
 <span className={`text-xs px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-medium ${
 org?.subscription_status === 'active' ? 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]' :
 org?.subscription_status === 'past_due' ? 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]' :
 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]'
 }`}>
 {org?.subscription_status === 'active' ? 'Активен' :
 org?.subscription_status === 'past_due' ? 'Просрочен' :
 org?.subscription_status === 'trialing' ? 'Пробный' : 'Неактивен'}
 </span>
 </div>
 <div className="text-sm text-muted-foreground mt-1">
 {gate.max_users === Infinity ? 'Неограниченно пользователей' : `До ${gate.max_users} пользователей`}
 {' · '}
 {gate.max_properties === Infinity ? 'Неограниченно объектов' : `До ${gate.max_properties} объектов`}
 </div>
 </div>
 {org?.stripe_customer_id && (
 <BillingActions hasCustomer={true} />
 )}
 </div>
 </div>

 {/* Plans grid */}
 <div>
 <h2 className="font-semibold mb-4">Выберите тариф</h2>
 <div className="grid gap-4 sm:grid-cols-3">
 {PLANS.map(plan => {
 const Icon = plan.icon
 const isCurrent = plan.id === currentPlan
 return (
 <div
 key={plan.id}
 className={`relative flex flex-col p-5 border-2 transition-all ${
 isCurrent ? `${plan.border} ${plan.bg}` : 'border-[var(--hp-border-soft)] bg-white hover:border-[var(--hp-border)]'
 }`}
 >
 {'popular' in plan && plan.popular && (
 <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-white text-xs font-bold rounded-[var(--hp-radius-badge)]">
 Популярный
 </div>
 )}

 <div className={`w-9 h-9 ${plan.bg} flex items-center justify-center mb-4`}>
 <Icon className={`w-4 h-4 ${plan.color}`} />
 </div>

 <div className="font-bold text-lg mb-1">{plan.name}</div>
 <div className="text-2xl font-bold mb-0.5">
 {plan.price === 0 ? 'Бесплатно' : `${plan.price.toLocaleString('ru-RU')} ₽`}
 </div>
 {plan.price > 0 && <div className="text-xs text-muted-foreground mb-4">в месяц</div>}

 <ul className="space-y-2 mt-2 flex-1">
 {plan.features.map(f => (
 <li key={f} className="flex items-center gap-2 text-sm">
 <Check className="w-3.5 h-3.5 text-[var(--hp-good)] flex-shrink-0" />
 {f}
 </li>
 ))}
 </ul>

 <div className="mt-5">
 {isCurrent ? (
 <div className="w-full py-2 text-center text-sm font-medium text-muted-foreground bg-[var(--hp-neutral-tint)]">
 Текущий тариф
 </div>
 ) : (
 <BillingActions planId={plan.id} />
 )}
 </div>
 </div>
 )
 })}
 </div>
 </div>
 </div>
 )
}
