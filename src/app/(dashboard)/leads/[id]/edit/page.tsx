import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { updateLeadAction } from '@/features/leads/actions/leads.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { FormActions } from '@/components/forms/FormLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { LeadFormBody } from '@/features/leads/components/LeadFormBody'

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: rawLead }, { data: users }] = await Promise.all([
    supabase.from('leads').select('*').eq('id', id).single(),
    supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
  ])

  if (!rawLead) notFound()

  const boundAction = updateLeadAction.bind(null, id)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="Редактировать лид" subtitle={rawLead.full_name ?? rawLead.phone ?? ''} backHref={`/leads/${id}`} backLabel="Вернуться к лиду" />

      <ServerActionForm action={boundAction} className="space-y-4">
        <LeadFormBody lead={rawLead} users={users ?? []} />
        <FormActions submitLabel="Сохранить изменения" cancelHref={`/leads/${id}`} />
      </ServerActionForm>
    </div>
  )
}
