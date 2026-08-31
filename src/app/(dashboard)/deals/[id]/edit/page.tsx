import { createClient } from '@/lib/supabase/server'
import { TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateDealAction } from '@/features/deals/actions/deals.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { DealFormBody } from '@/features/deals/components/DealFormBody'
import { PageHeader } from '@/components/layout/PageHeader'
import { DEAL_STATUS_LABELS } from '@/features/deals/config/deal-stages'
import { formatDate } from '@/lib/utils'

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: rawDeal }, { data: rawContacts }, { data: rawProperties }, { data: rawReps }] = await Promise.all([
    supabase.from('deals').select('*').eq('id', id).single(),
    supabase.from('contacts').select('id, full_name, phone, role, client_type').order('full_name'),
    supabase.from('properties').select('id, title, address').order('title'),
    supabase.from('contact_representatives').select('id, contact_id, full_name, position, is_primary').order('is_primary', { ascending: false }),
  ])

  if (!rawDeal) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deal = rawDeal as any
  const contacts = rawContacts ?? []
  const properties = rawProperties ?? []

  const owners  = contacts.filter(c => c.role === 'owner'  || c.role === 'both')
  const clients = contacts.filter(c => c.role === 'client' || c.role === 'both')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const representativesByContact: Record<string, any[]> = {}
  for (const r of rawReps ?? []) {
    (representativesByContact[r.contact_id] ??= []).push(r)
  }

  const boundAction = updateDealAction.bind(null, id)
  const dealNo = deal.deal_number ? `СД-${deal.deal_number}` : `СД-${String(id).slice(0, 6)}`

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <PageHeader
        crumbs={[
          { label: 'Сделки', href: '/deals' },
          { label: DEAL_STATUS_LABELS[deal.status] ?? deal.status },
          { label: dealNo, href: `/deals/${id}` },
          { label: 'Редактирование' },
        ]}
        title="Редактировать сделку"
        subtitle={`${dealNo} · создана ${formatDate(deal.created_at)}`}
        backHref={`/deals/${id}`}
        backLabel="Вернуться к сделке"
        icon={<TrendingUp className="w-5 h-5" style={{ color: 'var(--hp-ink)' }} />}
      />

      <ServerActionForm action={boundAction} className="space-y-4">
        <DealFormBody
          deal={deal}
          owners={owners}
          clients={clients}
          properties={properties}
          representativesByContact={representativesByContact}
          ownerDefaultId={deal.owner_contact_id ?? ''}
          clientDefaultId={deal.client_contact_id ?? ''}
          ownerRepDefaultId={deal.owner_representative_id ?? ''}
          clientRepDefaultId={deal.client_representative_id ?? ''}
          propertyDefaultId={deal.property_id ?? ''}
          showStatus
        />

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" className="hp-btn-primary">
            <TrendingUp className="w-4 h-4" />
            Сохранить изменения
          </button>
          <Link href={`/deals/${id}`} className="hp-btn-secondary">Отмена</Link>
        </div>
      </ServerActionForm>
    </div>
  )
}
