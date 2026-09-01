import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Mail, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { resolveProvider } from '@/lib/email/provider'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
 payment_reminder: 'Напоминание об оплате',
 payment_overdue: 'Просрочка платежа',
 contract_ready: 'Договор',
 collection_shared: 'Подборка',
 showing_scheduled: 'Показ',
 lead_assigned: 'Новый лид',
 task_assigned: 'Задача',
 daily_digest: 'Дайджест',
 custom: 'Письмо',
}

const STATUS_META: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
 sent: { label: 'Доставлено провайдеру', className: 'hp-badge hp-badge-good', Icon: CheckCircle2 },
 failed: { label: 'Ошибка', className: 'hp-badge hp-badge-danger', Icon: XCircle },
 skipped: { label: 'Не отправлено', className: 'hp-badge hp-badge-neutral', Icon: MinusCircle },
}

const PROVIDER_LABEL: Record<string, string> = {
 resend: 'Resend',
 unisender: 'Unisender Go',
 log: 'не настроен (письма только в лог)',
}

export default async function EmailLogPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
 if (profile?.role !== 'admin') redirect('/settings')

 const { data: logs } = await supabase
 .from('email_log')
 .select('id, recipient, subject, kind, status, provider, error, created_at')
 .order('created_at', { ascending: false })
 .limit(200)

 const provider = resolveProvider()
 const configured = provider !== 'log'
 const failedCount = (logs ?? []).filter((l) => l.status === 'failed').length

 return (
 <div className="max-w-5xl mx-auto space-y-6">
 <PageHeader
 title="Почта"
 subtitle={`Отправитель: ${PROVIDER_LABEL[provider]}`}
 backHref="/settings"
 backLabel="Вернуться к настройкам"
 iconBg="bg-[var(--hp-neutral-tint)]"
 icon={<Mail className="text-[var(--hp-ink)]" style={{ width: 20, height: 20 }} />}
 />

 {!configured && (
 <div className="hp-card p-5 space-y-2">
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Почта ещё не подключена</h2>
 <p className="text-sm text-[var(--hp-sub)]">
 Письма клиентам и сотрудникам сейчас не уходят — они пишутся в журнал со статусом
 «Не отправлено». Чтобы включить отправку, задайте в переменных окружения
 <code className="mx-1 px-1.5 py-0.5 bg-[var(--hp-neutral-tint)] text-[var(--hp-ink)]">RESEND_API_KEY</code>
 или
 <code className="mx-1 px-1.5 py-0.5 bg-[var(--hp-neutral-tint)] text-[var(--hp-ink)]">UNISENDER_API_KEY</code>,
 а также адрес отправителя
 <code className="mx-1 px-1.5 py-0.5 bg-[var(--hp-neutral-tint)] text-[var(--hp-ink)]">EMAIL_FROM</code>
 с подтверждённым доменом.
 </p>
 </div>
 )}

 {failedCount > 0 && (
 <div className="hp-card p-5">
 <p className="text-sm font-semibold text-[var(--hp-danger)]">
 {failedCount} письмо(писем) не доставлено — проверьте домен отправителя и лимиты провайдера.
 </p>
 </div>
 )}

 <div className="hp-card overflow-hidden">
 {!logs?.length ? (
 <div className="hp-empty text-center py-16">
 <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
 <Mail style={{ width: 24, height: 24, color: 'var(--hp-sub)' }} />
 </div>
 <p className="text-[var(--hp-ink)] font-bold text-base">Писем ещё не было</p>
 <p className="text-[var(--hp-sub)] text-sm mt-1">
 Здесь появится история всех отправок — напоминаний, договоров и подборок
 </p>
 </div>
 ) : (
 <div className="divide-y divide-[var(--hp-border-soft)]">
 {logs.map((log) => {
 const meta = STATUS_META[log.status] ?? STATUS_META.skipped
 return (
 <div key={log.id} className="px-5 py-4 flex items-start gap-4">
 <meta.Icon className="w-4 h-4 shrink-0 mt-1 text-[var(--hp-sub)]" />
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-sm font-semibold text-[var(--hp-ink)] break-words">{log.subject}</span>
 <span className="hp-badge hp-badge-neutral shrink-0">{KIND_LABEL[log.kind] ?? log.kind}</span>
 </div>
 <p className="text-xs text-[var(--hp-sub)] mt-0.5 break-words">{log.recipient}</p>
 {log.error && <p className="text-xs text-[var(--hp-danger)] mt-1 break-words">{log.error}</p>}
 </div>
 <div className="shrink-0 text-right">
 <span className={meta.className}>{meta.label}</span>
 <p className="text-xs text-[var(--hp-sub)] mt-1 whitespace-nowrap">
 {new Date(log.created_at).toLocaleString('ru-RU', {
 day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
 })}
 </p>
 </div>
 </div>
 )
 })}
 </div>
 )}
 </div>

 <p className="text-xs text-[var(--hp-sub)]">
 Показаны последние 200 отправок. Статус «Доставлено провайдеру» означает, что письмо принято
 Resend/Unisender — дальнейшую судьбу (открытия, отказы) смотрите в панели провайдера.{' '}
 <Link href="/settings" className="underline">Ко всем настройкам</Link>
 </p>
 </div>
 )
}
