import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { getSiteUrl } from '@/lib/telegram/site-url'
import {
 ChannelIntegrationForm,
 type CredentialField,
} from '@/features/communications/components/ChannelIntegrationForm'

export const dynamic = 'force-dynamic'

const PAYMENT_FIELDS: Record<string, CredentialField[]> = {
 yookassa: [
 { name: 'shopId', label: 'shopId', hint: 'Личный кабинет ЮKassa → Настройки → Магазин' },
 { name: 'secretKey', label: 'Секретный ключ', hint: 'Там же, раздел «Ключи API»' },
 ],
}

interface IntegrationRow {
 kind: string
 provider: string | null
 is_active: boolean
 webhook_secret: string | null
 credentials: Record<string, unknown> | null
}

export default async function PaymentsSettingsPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
 if (profile?.role !== 'admin') redirect('/settings')

 const { data } = await supabase
 .from('channel_integrations')
 .select('kind, provider, is_active, webhook_secret, credentials')
 .eq('kind', 'payments')
 .maybeSingle()

 const row = data as IntegrationRow | null

 return (
 <div className="max-w-3xl mx-auto space-y-6">
 <PageHeader
 title="Приём платежей"
 subtitle="Ссылки на оплату для арендаторов и автоматическая сверка"
 backHref="/settings"
 backLabel="Вернуться к настройкам"
 iconBg="bg-[var(--hp-neutral-tint)]"
 icon={<CreditCard className="text-[var(--hp-ink)]" style={{ width: 20, height: 20 }} />}
 />

 <div className="hp-card p-5 space-y-2">
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Это не тариф на CRM</h2>
 <p className="text-sm text-[var(--hp-sub)]">
 Здесь настраивается приём денег <b>от ваших клиентов</b> — за аренду и услуги.
 Оплата подписки на саму CRM живёт отдельно, в разделе «Тарифы и оплата».
 </p>
 </div>

 <ChannelIntegrationForm
 kind="payments"
 webhookPath="payments"
 title="ЮKassa"
 description="Начисление можно отправить клиенту ссылкой на оплату. Когда деньги поступят, ЮKassa пришлёт уведомление, и начисление само станет оплаченным."
 providers={[{ value: 'yookassa', label: 'ЮKassa' }]}
 credentialFields={PAYMENT_FIELDS}
 current={
 row
 ? {
 provider: row.provider,
 isActive: row.is_active,
 webhookSecret: row.webhook_secret,
 filledCredentials: Object.keys(row.credentials ?? {}),
 }
 : null
 }
 siteUrl={getSiteUrl()}
 />

 <div className="hp-card p-5 space-y-2">
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Чеки по 54-ФЗ</h2>
 <p className="text-sm text-[var(--hp-sub)]">
 Если к магазину ЮKassa подключена онлайн-касса, чек формируется автоматически —
 CRM передаёт состав платежа и контакты плательщика. Без подключённой кассы платёж
 пройдёт, но чек выпущен не будет.
 </p>
 </div>
 </div>
 )
}
