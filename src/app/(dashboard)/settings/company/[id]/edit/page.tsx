import { createClient } from '@/lib/supabase/server'
import { Building2, Trash2, CheckCircle } from 'lucide-react'
import { notFound } from 'next/navigation'
import { updateCompanyProfileAction, deleteCompanyProfileAction } from '@/features/settings/actions/company.actions'
import { CompanyProfileForm } from '@/features/settings/components/CompanyProfileForm'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function EditCompanyProfilePage({
 params, searchParams,
}: {
 params: Promise<{ id: string }>
 searchParams: Promise<{ created?: string }>
}) {
 const { id } = await params
 const { created } = await searchParams
 const supabase = await createClient()

 const { data: profile } = await supabase.from('company_settings').select('*').eq('id', id).single()
 if (!profile) notFound()

 const boundUpdate = updateCompanyProfileAction.bind(null, id)
 const boundDelete = deleteCompanyProfileAction.bind(null, id)

 return (
 <div className="max-w-2xl mx-auto space-y-6">
 <PageHeader
 title={profile.name || 'Профиль'}
 subtitle="Реквизиты профиля"
 backHref="/settings/company"
 backLabel="Назад к профилям"
 iconBg="bg-blue-50"
 icon={<Building2 className="w-5 h-5 text-blue-600" />}
 actions={
 <ServerActionForm action={boundDelete}>
 <button type="submit"
 className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-all shrink-0">
 <Trash2 className="w-4 h-4" />
 Удалить
 </button>
 </ServerActionForm>
 }
 />

 {created === '1' && (
 <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">
 <CheckCircle className="w-4 h-4" />
 Профиль создан. Теперь можно загрузить логотип и проверить реквизиты.
 </div>
 )}

 <CompanyProfileForm mode="edit" profile={profile} action={boundUpdate} />
 </div>
 )
}
