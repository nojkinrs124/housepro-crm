import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Landmark } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { BankStatementImport } from '@/features/accounting/components/BankStatementImport'

export const dynamic = 'force-dynamic'

export default async function BankImportPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
 if (profile?.role === 'agent') redirect('/accounting')

 return (
 <div className="max-w-4xl mx-auto space-y-6">
 <PageHeader
 title="Сверка с банком"
 subtitle="Загрузка выписки и автоматическая отметка оплат"
 backHref="/accounting"
 backLabel="К бухгалтерии"
 iconBg="bg-[var(--hp-neutral-tint)]"
 icon={<Landmark className="text-[var(--hp-ink)]" style={{ width: 20, height: 20 }} />}
 />
 <BankStatementImport />
 </div>
 )
}
