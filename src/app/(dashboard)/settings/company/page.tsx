import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Building2 } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CompanySettingsForm } from '@/features/settings/components/CompanySettingsForm'

export default async function CompanyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: company } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .single()

  const isAdmin = profile?.role === 'admin'

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
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <Building2 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-foreground leading-tight">Компания</h1>
          <p className="text-sm text-muted-foreground">Реквизиты, контакты, логотип</p>
        </div>
      </div>

      <CompanySettingsForm company={company} isAdmin={isAdmin} />
    </div>
  )
}
