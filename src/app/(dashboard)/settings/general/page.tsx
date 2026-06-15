import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Settings } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GeneralSettingsForm } from '@/features/settings/components/GeneralSettingsForm'
import { getGeneralSettingsAction } from '@/features/settings/actions/general.actions'

export default async function GeneralSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const settings = await getGeneralSettingsAction()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Настройки
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
          <Settings className="w-5 h-5 text-gray-600" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-foreground leading-tight">Общие настройки</h1>
          <p className="text-sm text-muted-foreground">Язык, валюта, временная зона</p>
        </div>
      </div>

      <GeneralSettingsForm settings={settings} />
    </div>
  )
}
