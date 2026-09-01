import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Signature } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { getSiteUrl } from '@/lib/telegram/site-url'
import {
  ChannelIntegrationForm,
  type CredentialField,
} from '@/features/communications/components/ChannelIntegrationForm'
import { PodpislonKeyCheck } from '@/features/settings/components/PodpislonKeyCheck'

export const dynamic = 'force-dynamic'

const SIGNING_FIELDS: Record<string, CredentialField[]> = {
  podpislon: [
    {
      name: 'apiKey',
      label: 'API-ключ',
      hint: 'Личный кабинет Подпислона → Настройки → Интеграции → «Данные для интеграции»',
    },
  ],
}

interface IntegrationRow {
  kind: string
  provider: string | null
  is_active: boolean
  webhook_secret: string | null
  credentials: Record<string, unknown> | null
}

export default async function SigningSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/settings')

  const { data } = await supabase
    .from('channel_integrations')
    .select('kind, provider, is_active, webhook_secret, credentials')
    .eq('kind', 'signing')
    .maybeSingle()

  const row = data as IntegrationRow | null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Электронная подпись"
        subtitle="Отправка договоров на подпись клиенту прямо из карточки"
        backHref="/settings"
        backLabel="Вернуться к настройкам"
        iconBg="bg-[var(--hp-neutral-tint)]"
        icon={<Signature className="text-[var(--hp-ink)]" style={{ width: 20, height: 20 }} />}
      />

      <div className="hp-card p-5 space-y-2">
        <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Как это работает</h2>
        <p className="text-sm text-[var(--hp-sub)]">
          В карточке договора появляется кнопка «Отправить на подпись». CRM собирает PDF
          из сформированного документа, подшивает к нему <b>соглашение об использовании
          простой электронной подписи</b> и <b>согласие на обработку персональных данных</b>,
          и передаёт файл в Подпислон. Клиент получает СМС с кодом и подписывает — статус
          и подписанный PDF возвращаются в карточку договора автоматически.
        </p>
        <p className="text-sm text-[var(--hp-sub)]">
          Внутренняя подпись по коду из письма никуда не делась и работает параллельно:
          она бесплатна, но доказательство подписания хранится только у вас. Подпислон —
          независимый оператор, у которого остаётся собственный протокол подписания.
        </p>
      </div>

      <ChannelIntegrationForm
        kind="signing"
        webhookPath="signing"
        title="Подпислон"
        description="API-ключ выпускается в личном кабинете Подпислона. Если у вас несколько юрлиц, для каждого нужен свой ключ — и своя организация в CRM."
        providers={[{ value: 'podpislon', label: 'Подпислон' }]}
        credentialFields={SIGNING_FIELDS}
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

      <PodpislonKeyCheck />

      <div className="hp-card p-5 space-y-2">
        <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Обработчик событий</h2>
        <p className="text-sm text-[var(--hp-sub)]">
          Скопируйте адрес вебхука выше и добавьте его в личном кабинете Подпислона:
          «Интеграции» → «Обработчики событий» → «Добавить обработчик». Без него статус
          в карточке договора не будет обновляться сам — только по кнопке «Обновить».
        </p>
        <p className="text-sm text-[var(--hp-sub)]">
          Секрет в адресе — это пароль обработчика. Если адрес утёк, перевыпустите секрет
          и замените обработчик в кабинете сервиса.
        </p>
      </div>
    </div>
  )
}
