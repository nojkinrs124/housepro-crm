import { createClient } from '@/lib/supabase/server'
import { Settings } from 'lucide-react'
import { redirect } from 'next/navigation'
import { GeneralSettingsForm } from '@/features/settings/components/GeneralSettingsForm'
import { getGeneralSettingsAction } from '@/features/settings/actions/general.actions'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function GeneralSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const settings = await getGeneralSettingsAction()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Общие настройки"
        subtitle="Язык, валюта, временная зона"
        backHref="/settings"
        backLabel="Настройки"
        iconBg="bg-[var(--hp-neutral-tint)]"
        icon={<Settings className="text-[var(--hp-sub)]" style={{ width: 20, height: 20 }} />}
      />

      <GeneralSettingsForm settings={settings} />
    </div>
  )
}
