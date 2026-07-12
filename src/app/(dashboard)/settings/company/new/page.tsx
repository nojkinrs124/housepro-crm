import { createClient } from '@/lib/supabase/server'
import { Building2 } from 'lucide-react'
import { createCompanyProfileAction } from '@/features/settings/actions/company.actions'
import { CompanyProfileForm } from '@/features/settings/components/CompanyProfileForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function NewCompanyProfilePage() {
  const supabase = await createClient()
  const { count } = await supabase.from('company_settings').select('id', { count: 'exact', head: true })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Новый профиль"
        subtitle="Физ. лицо, ИП или ООО для подготовки документов"
        backHref="/settings/company"
        backLabel="Назад к профилям"
        iconBg="bg-blue-50"
        icon={<Building2 className="w-5 h-5 text-blue-600" />}
      />

      <CompanyProfileForm mode="create" profile={null} action={createCompanyProfileAction} isFirstProfile={!count} />
    </div>
  )
}
