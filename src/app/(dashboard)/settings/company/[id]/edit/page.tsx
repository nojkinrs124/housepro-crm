import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Building2, Trash2, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateCompanyProfileAction, deleteCompanyProfileAction } from '@/features/settings/actions/company.actions'
import { CompanyProfileForm } from '@/features/settings/components/CompanyProfileForm'
import { formAction } from '@/lib/form-action'

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
      <Link href="/settings/company" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к профилям
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight truncate">{profile.name || 'Профиль'}</h1>
            <p className="text-muted-foreground text-sm">Реквизиты профиля</p>
          </div>
        </div>
        <form action={formAction(boundDelete)}>
          <button type="submit"
            className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-all shrink-0">
            <Trash2 className="w-4 h-4" />
            Удалить
          </button>
        </form>
      </div>

      {created === '1' && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm">
          <CheckCircle className="w-4 h-4" />
          Профиль создан. Теперь можно загрузить логотип и проверить реквизиты.
        </div>
      )}

      <CompanyProfileForm mode="edit" profile={profile} action={boundUpdate} />
    </div>
  )
}
