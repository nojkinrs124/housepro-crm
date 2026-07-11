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
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Настройки
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 bg-slate-100">
          <Settings className="text-slate-600" style={{ width: 20, height: 20 }} />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-foreground tracking-tight leading-tight">Общие настройки</h1>
          <p className="text-muted-foreground text-sm font-medium mt-0.5">Язык, валюта, временная зона</p>
        </div>
      </div>

      <GeneralSettingsForm settings={settings} />
    </div>
  )
}
