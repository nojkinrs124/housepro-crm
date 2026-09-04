import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { EngagementTermsForm, type EngagementTerms } from '@/features/management/components/EngagementTermsForm'
import { can, toUserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

/**
 * Условия расчёта с собственником по объекту в управлении.
 *
 * Отдельная страница, а не блок на карточке: от схемы расчёта зависят
 * взаиморасчёт, отчёт и учёт простоя, и менять её походя нельзя.
 */
export default async function EngagementTermsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (!can(toUserRole(profile?.role), 'contracts', 'update')) redirect(`/management/${id}`)

  const [{ data: engagement }, { data: property }, { data: owners }, { data: plans }, { data: contracts }] =
    await Promise.all([
      supabase.from('management_engagements')
        .select('id, owner_contact_id, plan_id, contract_id, settlement_scheme, rate, owner_fixed_amount, owner_payout_day, started_at, notes')
        .eq('property_id', id).is('ended_at', null).maybeSingle(),
      supabase.from('properties').select('title, address').eq('id', id).maybeSingle(),
      supabase.from('contacts').select('id, full_name, company_name')
        .in('role', ['owner', 'both']).order('full_name'),
      supabase.from('service_plans').select('id, title, charge_type, rate')
        .eq('is_active', true).contains('directions', ['management']).order('sort_order'),
      supabase.from('contracts').select('id, contract_number, start_date')
        .eq('property_id', id).in('contract_type', ['property_management', 'sublease'])
        .order('start_date', { ascending: false, nullsFirst: false }),
    ])

  if (!engagement || !property) notFound()

  const terms: EngagementTerms = {
    id: engagement.id,
    ownerContactId: engagement.owner_contact_id,
    planId: engagement.plan_id,
    contractId: engagement.contract_id,
    settlementScheme: engagement.settlement_scheme,
    rate: engagement.rate,
    ownerFixedAmount: engagement.owner_fixed_amount,
    ownerPayoutDay: engagement.owner_payout_day,
    startedAt: engagement.started_at,
    notes: engagement.notes,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Условия обслуживания"
        subtitle={property.title}
        backHref={`/management/${id}`}
        backLabel="Объект"
      />
      <EngagementTermsForm
        terms={terms}
        owners={(owners ?? []).map(o => ({ id: o.id, label: o.company_name || o.full_name }))}
        plans={(plans ?? []).map(p => ({
          id: p.id,
          label: p.rate !== null ? `${p.title} — ${p.rate}%` : p.title,
        }))}
        contracts={(contracts ?? []).map(c => ({
          id: c.id,
          propertyId: id,
          label: `${c.contract_number || `№${c.id.slice(0, 8)}`}${c.start_date ? ` от ${c.start_date}` : ''}`,
        }))}
        backHref={`/management/${id}`}
      />
    </div>
  )
}
