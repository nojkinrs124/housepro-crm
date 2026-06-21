import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Building2 } from 'lucide-react'
import Link from 'next/link'
import { createCompanyProfileAction } from '@/features/settings/actions/company.actions'
import { CompanyProfileForm } from '@/features/settings/components/CompanyProfileForm'

export default async function NewCompanyProfilePage() {
  const supabase = await createClient()
  const { count } = await supabase.from('company_settings').select('id', { count: 'exact', head: true })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/settings/company" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к профилям
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <Building2 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">Новый профиль</h1>
          <p className="text-muted-foreground text-sm">Физ. лицо, ИП или ООО для подготовки документов</p>
        </div>
      </div>

      <CompanyProfileForm mode="create" profile={null} action={createCompanyProfileAction} isFirstProfile={!count} />
    </div>
  )
}
