import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Webhook } from 'lucide-react'
import { CreateWebhookForm } from '@/features/webhooks/components/CreateWebhookForm'
import { WebhookRow } from '@/features/webhooks/components/WebhookRow'

export default async function WebhooksSettingsPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
 if (profile?.role !== 'admin') redirect('/settings')

 const { data: webhooks } = await supabase
 .from('webhook_endpoints')
 .select('id, url, events, is_active, created_at')
 .order('created_at', { ascending: false })

 return (
 <div className="max-w-3xl mx-auto space-y-6">
 <div className="flex items-center gap-3">
 <Link href="/settings" className="text-muted-foreground hover:text-foreground text-sm">Настройки</Link>
 <span className="text-muted-foreground">/</span>
 <span className="text-sm font-medium">Вебхуки</span>
 </div>

 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl font-bold flex items-center gap-2">
 <Webhook className="w-5 h-5 text-primary" />
 Вебхуки
 </h1>
 <p className="text-sm text-muted-foreground mt-1">
 Получайте уведомления о событиях в реальном времени
 </p>
 </div>
 <CreateWebhookForm />
 </div>

 <div className="space-y-2">
 {(!webhooks || webhooks.length === 0) ? (
 <div className="py-12 text-center text-muted-foreground bg-white border border-dashed border-[var(--hp-border)]">
 <Webhook className="w-8 h-8 mx-auto mb-2 opacity-30" />
 <p className="text-sm">Вебхуков пока нет</p>
 </div>
 ) : (
 webhooks.map(w => (
 <WebhookRow key={w.id} id={w.id} url={w.url} events={w.events ?? []} isActive={w.is_active} />
 ))
 )}
 </div>
 </div>
 )
}
