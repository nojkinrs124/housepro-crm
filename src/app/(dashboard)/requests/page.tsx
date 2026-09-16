import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'
import { RequestCard, type RequestRow } from '@/features/requests/components/RequestCard'

export const dynamic = 'force-dynamic'

/**
 * Заявки арендаторов на бытовые услуги.
 *
 * Открытые идут первыми: закрытая заявка — это история, а открытая — работа,
 * о которой жилец ждёт ответа.
 */
export default async function RequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('service_requests')
    .select(`
      id, category, description, status, reject_reason, created_at, transaction_id,
      property:properties(title),
      contact:contacts(full_name, company_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows: RequestRow[] = (data ?? []).map(r => {
    const property = Array.isArray(r.property) ? r.property[0] : r.property
    const contact = Array.isArray(r.contact) ? r.contact[0] : r.contact
    return {
      id: r.id,
      category: r.category,
      description: r.description,
      status: r.status,
      rejectReason: r.reject_reason,
      createdAt: r.created_at,
      propertyTitle: property?.title ?? null,
      contactName: contact ? (contact.company_name || contact.full_name) : null,
      hasExpense: r.transaction_id !== null,
    }
  })

  const open = rows.filter(r => !['done', 'rejected'].includes(r.status))
  const closed = rows.filter(r => ['done', 'rejected'].includes(r.status))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Заявки арендаторов"
        subtitle={open.length > 0 ? `${open.length} открытых` : 'открытых нет'}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Wrench className="w-5 h-5 text-[var(--hp-sub)]" />}
          title="Заявок пока нет"
          description="Заявки приходят от жильцов через личный кабинет: поломка, вопрос, показания. Пока ничего не поступало."
        />
      ) : (
        <>
          {open.length > 0 && (
            <section className="space-y-4">
              {open.map(request => <RequestCard key={request.id} request={request} />)}
            </section>
          )}

          {closed.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-[var(--hp-sub)]">Закрытые</h2>
              {closed.slice(0, 20).map(request => <RequestCard key={request.id} request={request} />)}
            </section>
          )}
        </>
      )}
    </div>
  )
}
