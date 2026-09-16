import { createLeadAction } from '@/features/leads/actions/leads.actions'
import { createClient } from '@/lib/supabase/server'
import { Zap } from 'lucide-react'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { FormActions } from '@/components/forms/FormLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { LeadFormBody } from '@/features/leads/components/LeadFormBody'

export default async function NewLeadPage() {
  const supabase = await createClient()
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Новый лид"
        subtitle="Входящий звонок или сообщение: кто, откуда и что ищет — остальное уточните позже"
        backHref="/leads"
        backLabel="Назад к лидам"
        icon={<Zap className="w-5 h-5 text-[var(--hp-ink)]" />}
      />

      <ServerActionForm action={createLeadAction} className="space-y-4">
        <LeadFormBody users={users ?? []} />
        <FormActions submitLabel="Создать лид" cancelHref="/leads" submitTestId="lead-submit" />
      </ServerActionForm>
    </div>
  )
}
