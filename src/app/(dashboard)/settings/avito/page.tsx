import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Megaphone, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { AvitoSettingsForm } from '@/features/avito/components/AvitoSettingsForm'
import { AvitoFeedPanel } from '@/features/avito/components/AvitoFeedPanel'
import { env } from '@/lib/env'
import type { AvitoSettings } from '@/types/database'

function maskSecret(secret?: string | null): string {
  if (!secret) return ''
  if (secret.length <= 4) return '••••'
  return `••••${secret.slice(-4)}`
}

export default async function AvitoSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/settings')

  const { data: settings } = await supabase
    .from('avito_settings')
    .select('*')
    .maybeSingle<AvitoSettings>()

  const { count: publishedCount } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('avito_publish', true)

  const feedUrl = settings ? `${env.siteUrl}/api/avito/feed/${settings.feed_token}` : ''

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Авито"
        subtitle="Публикация объектов через API и автозагрузку"
        backHref="/settings"
        backLabel="Настройки"
        iconBg="bg-blue-50"
        icon={<Megaphone className="text-blue-600" style={{ width: 20, height: 20 }} />}
      />

      <div className="flex items-center gap-4 bg-white rounded-[20px] border border-slate-100 p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-blue-50">
          <Megaphone className="text-blue-600" style={{ width: 20, height: 20 }} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-foreground leading-tight">{publishedCount ?? 0}</p>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">объектов помечены для публикации на Авито</p>
        </div>
      </div>

      <div className="rounded-[16px] p-4 flex gap-3" style={{ background: 'rgba(254,243,199,0.5)', border: '1px solid rgba(245,158,11,0.25)' }}>
        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" style={{ width: 18, height: 18 }} />
        <div className="min-w-0 text-sm text-amber-900 leading-relaxed">
          <p className="font-semibold">Важно про дубли объявлений</p>
          <p className="mt-1">
            У Авито нет API «опубликовать объявление мгновенно» — публикация всегда идёт через фид,
            который Авито опрашивает по расписанию. Если для объекта уже есть объявление, созданное
            вручную или другой системой, включение автозагрузки может создать дубль — снимите старое
            объявление в личном кабинете Авито перед тем, как включать публикацию этого объекта здесь.
          </p>
        </div>
      </div>

      <AvitoSettingsForm
        clientId={settings?.client_id ?? ''}
        maskedSecret={maskSecret(settings?.client_secret)}
        avitoUserId={settings?.avito_user_id ?? ''}
        contactPhone={settings?.contact_phone ?? ''}
        isEnabled={settings?.is_enabled ?? true}
      />

      {settings && (
        <AvitoFeedPanel
          feedUrl={feedUrl}
          lastSyncedAt={settings.last_synced_at ?? null}
          lastSyncError={settings.last_sync_error ?? null}
        />
      )}
    </div>
  )
}
