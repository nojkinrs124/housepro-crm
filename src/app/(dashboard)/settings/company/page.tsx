import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Building2 } from 'lucide-react'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function saveCompanyAction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const values = {
    name:     (formData.get('name') as string)?.trim() || null,
    inn:      (formData.get('inn') as string)?.trim() || null,
    ogrn:     (formData.get('ogrn') as string)?.trim() || null,
    address:  (formData.get('address') as string)?.trim() || null,
    phone:    (formData.get('phone') as string)?.trim() || null,
    email:    (formData.get('email') as string)?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await supabase.from('company_settings').select('id').limit(1).single()
  if (existing) {
    await supabase.from('company_settings').update(values).eq('id', existing.id)
  } else {
    await supabase.from('company_settings').insert(values)
  }

  revalidatePath('/settings/company')
}

export default async function CompanyPage() {
  const supabase = await createClient()
  const { data: company } = await supabase.from('company_settings').select('*').limit(1).single()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к настройкам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <Building2 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Компания</h1>
          <p className="text-muted-foreground mt-1">Реквизиты и контактные данные</p>
        </div>
      </div>

      <form action={saveCompanyAction} className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Название компании</label>
          <input name="name" defaultValue={company?.name ?? ''} placeholder="ИП HousePro"
            className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">ИНН</label>
            <input name="inn" defaultValue={company?.inn ?? ''} placeholder="123456789012"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">ОГРН</label>
            <input name="ogrn" defaultValue={company?.ogrn ?? ''} placeholder="1234567890123"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Юридический адрес</label>
          <input name="address" defaultValue={company?.address ?? ''} placeholder="г. Москва, ул. Примерная, д. 1"
            className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Телефон</label>
            <input name="phone" defaultValue={company?.phone ?? ''} placeholder="+7 (999) 000-00-00"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input name="email" type="email" defaultValue={company?.email ?? ''} placeholder="info@company.ru"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
          </div>
        </div>

        <button type="submit"
          className="w-full h-10 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
          Сохранить реквизиты
        </button>
      </form>
    </div>
  )
}
