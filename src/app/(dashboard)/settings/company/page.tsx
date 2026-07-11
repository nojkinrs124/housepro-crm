import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Building2, Plus, Star } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LEGAL_FORM_LABELS } from '@/features/settings/config/legal-forms'
import { CompanyProfileCardActions } from '@/features/settings/components/CompanyProfileCardActions'

export default async function CompanyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const { data: profiles } = await supabase
    .from('company_settings')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Настройки
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 bg-blue-50">
            <Building2 className="text-blue-600" style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-foreground tracking-tight leading-tight">Компания</h1>
            <p className="text-muted-foreground text-sm font-medium mt-0.5">Профили реквизитов для подготовки документов</p>
          </div>
        </div>
        {isAdmin && (
          <Link href="/settings/company/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shrink-0">
            <Plus className="w-4 h-4" />
            Профиль
          </Link>
        )}
      </div>

      {!isAdmin && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-[20px] p-6 text-center">
          <Building2 className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <p className="font-semibold text-yellow-900">Только для администраторов</p>
          <p className="text-sm text-yellow-700 mt-1">Управление профилями компании доступно только администраторам системы.</p>
        </div>
      )}

      {isAdmin && (!profiles || profiles.length === 0) && (
        <div className="bg-card border border-dashed border-border rounded-[20px] p-10 text-center">
          <Building2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold text-foreground">Нет ни одного профиля</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Создайте профиль — физ. лицо, ИП или ООО — от имени которого будут готовиться договоры
          </p>
          <Link href="/settings/company/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" />
            Создать профиль
          </Link>
        </div>
      )}

      {isAdmin && profiles && profiles.length > 0 && (
        <div className="space-y-3">
          {profiles.map((p) => (
            <Link key={p.id} href={`/settings/company/${p.id}/edit`}
              className="block bg-card border border-border rounded-[20px] p-5 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                    {p.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logo_url} alt="" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building2 className="w-5 h-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">{p.name || 'Без названия'}</p>
                      {p.is_default && <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {LEGAL_FORM_LABELS[p.legal_form] ?? p.legal_form}
                      {p.inn && <> · ИНН {p.inn}</>}
                    </p>
                  </div>
                </div>
                <CompanyProfileCardActions id={p.id} isDefault={!!p.is_default} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
