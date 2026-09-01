import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PhoneCall } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { getSiteUrl } from '@/lib/telegram/site-url'
import {
 ChannelIntegrationForm,
 type CredentialField,
} from '@/features/communications/components/ChannelIntegrationForm'
import { TELEPHONY_PROVIDERS, TELEPHONY_PROVIDER_LABELS } from '@/lib/communications/telephony'
import { WHATSAPP_PROVIDERS, WHATSAPP_PROVIDER_LABELS } from '@/lib/communications/whatsapp'

export const dynamic = 'force-dynamic'

// Поля учётных данных отличаются от провайдера к провайдеру, поэтому описаны
// здесь, а не в общей форме: форма остаётся универсальной, а знание о
// конкретных API живёт рядом с их списком.
const TELEPHONY_FIELDS: Record<string, CredentialField[]> = {
 mango: [
 { name: 'apiKey', label: 'API key', hint: 'Личный кабинет Манго → Настройки → API' },
 { name: 'apiSalt', label: 'API salt' },
 ],
 uis: [{ name: 'apiToken', label: 'API-токен', hint: 'UIS → Настройки → Интеграции → API' }],
 zadarma: [
 { name: 'apiKey', label: 'Ключ API' },
 { name: 'apiSecret', label: 'Секрет API' },
 ],
 generic: [],
}

const WHATSAPP_FIELDS: Record<string, CredentialField[]> = {
 wazzup: [
 { name: 'apiKey', label: 'API-ключ', hint: 'Wazzup24 → Интеграции → API' },
 { name: 'channelId', label: 'ID канала' },
 ],
 green_api: [
 { name: 'instanceId', label: 'idInstance' },
 { name: 'apiToken', label: 'apiTokenInstance' },
 ],
}

interface IntegrationRow {
 kind: string
 provider: string | null
 is_active: boolean
 webhook_secret: string | null
 credentials: Record<string, unknown> | null
}

export default async function ChannelsSettingsPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
 if (profile?.role !== 'admin') redirect('/settings')

 const { data } = await supabase
 .from('channel_integrations')
 .select('kind, provider, is_active, webhook_secret, credentials')

 const rows = (data ?? []) as IntegrationRow[]

 // В браузер уходят только имена заполненных полей — сами ключи остаются на сервере.
 const toCurrent = (kind: string) => {
 const row = rows.find((r) => r.kind === kind)
 if (!row) return null
 return {
 provider: row.provider,
 isActive: row.is_active,
 webhookSecret: row.webhook_secret,
 filledCredentials: Object.keys(row.credentials ?? {}),
 }
 }

 const siteUrl = getSiteUrl()

 return (
 <div className="max-w-3xl mx-auto space-y-6">
 <PageHeader
 title="Каналы связи"
 subtitle="Телефония и WhatsApp — звонки и сообщения попадают в карточки клиентов"
 backHref="/settings"
 backLabel="Вернуться к настройкам"
 iconBg="bg-[var(--hp-neutral-tint)]"
 icon={<PhoneCall className="text-[var(--hp-ink)]" style={{ width: 20, height: 20 }} />}
 />

 <ChannelIntegrationForm
 kind="telephony"
 title="Телефония"
 description="Входящие и исходящие звонки, пропущенные и записи разговоров попадут в историю общения. Адрес вебхука нужно указать в личном кабинете АТС."
 providers={TELEPHONY_PROVIDERS.map((p) => ({ value: p, label: TELEPHONY_PROVIDER_LABELS[p] }))}
 credentialFields={TELEPHONY_FIELDS}
 current={toCurrent('telephony')}
 siteUrl={siteUrl}
 />

 <ChannelIntegrationForm
 kind="whatsapp"
 title="WhatsApp"
 description="Переписка с клиентом в WhatsApp через шлюз: входящие сообщения приходят в CRM, отвечать можно прямо из карточки."
 providers={WHATSAPP_PROVIDERS.map((p) => ({ value: p, label: WHATSAPP_PROVIDER_LABELS[p] }))}
 credentialFields={WHATSAPP_FIELDS}
 current={toCurrent('whatsapp')}
 siteUrl={siteUrl}
 />

 <div className="hp-card p-5 space-y-2">
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Как связать звонок с сотрудником</h2>
 <p className="text-sm text-[var(--hp-sub)]">
 АТС присылает добавочный номер оператора. Чтобы в истории было видно, кто именно
 разговаривал, укажите добавочные в карточках сотрудников — раздел «Сотрудники»,
 поле «Внутренний номер».
 </p>
 </div>
 </div>
 )
}
