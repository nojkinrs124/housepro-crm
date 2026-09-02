import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { CompleteDealPanel } from '@/features/deals/components/CompleteDealPanel'
import { buildCompletionPlan } from '@/features/deals/services/deal-completion'
import { CONTRACT_TYPE_LABELS } from '@/features/contracts/config/contract-types'
import { PROPERTY_STATUS_LABELS } from '@/features/properties/config/property-labels'
import { DEAL_TYPE_LABELS } from '@/features/deals/config/deal-stages'

export const dynamic = 'force-dynamic'

/**
 * «Оформить сделку» — цепочка договор → начисления → задача → статус объекта
 * одним подтверждением. Раньше это были пять экранов подряд, и звенья
 * терялись: договор есть, начислений нет, объект висит свободным.
 */
export default async function CompleteDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id, deal_number, deal_type, status, amount, owner_contact_id, client_contact_id, property_id,
      property:properties(id, title, property_type, status),
      client_contact:contacts!deals_client_contact_id_fkey(id, full_name, company_name),
      owner_contact:contacts!deals_owner_contact_id_fkey(id, full_name, company_name)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!deal) notFound()

  const property = deal.property as { id: string; title: string; property_type: string | null; status: string | null } | null
  const clientContact = deal.client_contact as { full_name: string | null; company_name: string | null } | null
  const ownerContact = deal.owner_contact as { full_name: string | null; company_name: string | null } | null

  // Порядковый номер договора организации в этом году — из него собирается
  // номер вида «АР-2026-014».
  const yearStart = `${new Date().getUTCFullYear()}-01-01`
  const [{ count }, { data: existingContracts }] = await Promise.all([
    supabase.from('contracts').select('id', { count: 'exact', head: true }).gte('created_at', yearStart),
    supabase
      .from('contracts')
      .select('id, contract_number, status')
      .eq('deal_id', id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false }),
  ])

  const plan = buildCompletionPlan({
    dealType: deal.deal_type,
    propertyType: property?.property_type,
    amount: deal.amount,
    seqInYear: (count ?? 0) + 1,
  })

  const blockers = [
    !deal.owner_contact_id && 'не указан собственник',
    !deal.client_contact_id && 'не указан клиент',
    !deal.property_id && 'не выбран объект',
  ].filter((v): v is string => typeof v === 'string')

  const dealNo = deal.deal_number ? `СД-${deal.deal_number}` : `СД-${id.slice(0, 6)}`

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <PageHeader
        crumbs={[
          { label: 'Сделки', href: '/deals' },
          { label: dealNo, href: `/deals/${id}` },
          { label: 'Оформление' },
        ]}
        title="Оформить сделку"
        iconBg="bg-[var(--hp-good-tint)]"
        icon={<Zap className="w-5 h-5 text-[var(--hp-good)]" />}
        meta={
          <>
            <span>{DEAL_TYPE_LABELS[deal.deal_type] ?? deal.deal_type}</span>
            {ownerContact && (
              <>
                <span className="sep">·</span>
                <span>{ownerContact.company_name || ownerContact.full_name}</span>
              </>
            )}
            {clientContact && (
              <>
                <span className="sep">→</span>
                <span>{clientContact.company_name || clientContact.full_name}</span>
              </>
            )}
          </>
        }
        backHref={`/deals/${id}`}
        backLabel="Вернуться к сделке"
      />

      {blockers.length > 0 ? (
        <div className="hp-block">
          <div className="hp-block-header">Сначала дозаполните сделку</div>
          <div className="hp-block-item items-start">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--hp-danger)]" />
            <span className="flex-1 min-w-0">
              <span className="block text-[var(--hp-ink)] font-medium">
                В сделке {blockers.join(', ')}
              </span>
              <span className="block text-[12px] text-[var(--hp-sub)] mt-0.5">
                Договор нужно с кем-то подписывать и на какой-то объект — без этого оформлять нечего
              </span>
            </span>
            <Link
              href={`/deals/${id}/edit`}
              className="shrink-0 text-[12px] font-medium text-[var(--hp-accent)] hover:underline"
            >
              Заполнить
            </Link>
          </div>
        </div>
      ) : (
        <>
          {(existingContracts ?? []).length > 0 && (
            <div className="hp-block">
              <div className="hp-block-header">По этой сделке уже есть договор</div>
              {(existingContracts ?? []).map(c => (
                <Link key={c.id} href={`/contracts/${c.id}`} className="hp-block-item">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--hp-warn)]" />
                  <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)]">
                    {c.contract_number ?? 'Без номера'}
                  </span>
                  <span className="shrink-0 text-[12px] text-[var(--hp-sub)]">открыть</span>
                </Link>
              ))}
              <div className="hp-block-item text-[12px] text-[var(--hp-sub)]">
                Оформление создаст ещё один — так делают для допсоглашения или замены расторгнутого.
                Если нужен тот же договор, откройте его выше.
              </div>
            </div>
          )}

        <CompleteDealPanel
          dealId={id}
          plan={plan}
          contractTypeLabel={CONTRACT_TYPE_LABELS[plan.contractType] ?? plan.contractType}
          propertyTitle={property?.title ?? null}
          propertyStatusLabel={
            plan.propertyStatus ? PROPERTY_STATUS_LABELS[plan.propertyStatus]?.label ?? null : null
          }
          clientName={clientContact?.company_name || clientContact?.full_name || null}
        />
        </>
      )}
    </div>
  )
}
