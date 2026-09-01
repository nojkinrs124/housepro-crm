import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Upload } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ImportWizard } from '@/features/settings/components/ImportWizard'

export const dynamic = 'force-dynamic'

export default async function ImportPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
 if (profile?.role !== 'admin' && profile?.role !== 'manager') redirect('/settings')

 return (
 <div className="max-w-4xl mx-auto space-y-6">
 <PageHeader
 title="Импорт данных"
 subtitle="Перенос базы из Excel или CSV"
 backHref="/settings"
 backLabel="Вернуться к настройкам"
 iconBg="bg-[var(--hp-neutral-tint)]"
 icon={<Upload className="text-[var(--hp-ink)]" style={{ width: 20, height: 20 }} />}
 />
 <ImportWizard />
 </div>
 )
}
