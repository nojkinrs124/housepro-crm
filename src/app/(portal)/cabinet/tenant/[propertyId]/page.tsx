import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { grantFor } from '@/features/portal/services/access.service'
import { loadTenantView } from '@/features/portal/data/cabinet.data'
import { TenantReadingForm } from '@/features/portal/components/TenantReadingForm'
import { ServiceRequestForm } from '@/features/portal/components/ServiceRequestForm'
import {
  REQUEST_CATEGORY_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_BADGE,
} from '@/features/portal/config/request-categories'
import { formatAmount } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Кабинет арендатора: свои платежи, сроки, показания и заявки.
 *
 * Чего здесь нет никогда: вознаграждения агентства, расчётов с собственником и
 * его персональных данных. Арендатор видит только то, что относится к его
 * договору.
 */
export default async function TenantCabinetPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params

  const grant = await grantFor(propertyId, 'tenant')
  if (!grant) notFound()

  const view = await loadTenantView(grant)
  if (!view) notFound()

  // Свои заявки: строго по контакту и объекту этого доступа.
  const supabaseAdmin = getSupabaseAdmin()
  const { data: requests } = await supabaseAdmin
    .from('service_requests')
    .select('id, category, description, status, reject_reason, created_at, closed_at')
    .eq('property_id', grant.propertyId)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-[var(--hp-ink)] text-[19px]">{view.property.title}</h1>
        {view.property.address && (
          <p className="text-sm text-[var(--hp-sub)]">{view.property.address}</p>
        )}
      </div>

      <div className="hp-block">
        <div className="hp-block-header">Договор и платежи</div>
        {view.contract?.amount != null && (
          <div className="hp-block-row">
            <span className="label">Арендная плата</span>
            <span className="value">{formatAmount(view.contract.amount)} ₽/мес</span>
          </div>
        )}
        {view.contract?.endDate && (
          <div className="hp-block-row">
            <span className="label">Договор до</span>
            <span className="value">{view.contract.endDate}</span>
          </div>
        )}
        {view.nextPaymentDate && (
          <div className="hp-block-row">
            <span className="label">Ближайший платёж</span>
            <span className="value">
              {view.nextPaymentAmount != null && `${formatAmount(view.nextPaymentAmount)} ₽ · `}
              до {view.nextPaymentDate}
            </span>
          </div>
        )}
        {view.debt > 0 && (
          <div className="hp-block-row">
            <span className="label">Просрочено</span>
            <span className="value danger">{formatAmount(view.debt)} ₽</span>
          </div>
        )}
      </div>

      {view.payments.length > 0 && (
        <div className="hp-block">
          <div className="hp-block-header">История начислений</div>
          {view.payments.slice(0, 12).map(p => (
            <div key={p.id} className="hp-block-row">
              <span className="label">
                {p.dueDate ?? p.date}
                {p.description && <span className="block text-[12px]">{p.description}</span>}
              </span>
              <span className={`value ${p.status === 'completed' ? 'good' : ''}`}>
                {formatAmount(p.amount)} ₽
                <span className="block text-[12px] font-normal text-[var(--hp-sub)]">
                  {p.status === 'completed' ? 'оплачено' : 'ожидается'}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {view.meters.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--hp-ink)]">Счётчики</h2>
          {view.meters.map(meter => (
            <div key={meter.id} className="hp-block">
              <div className="hp-block-header flex items-center justify-between gap-2">
                <span>{meter.title}</span>
                <span className="tracking-normal text-[11px] font-normal text-[var(--hp-sub)]">
                  {meter.lastValue !== null
                    ? `последнее: ${meter.lastValue} ${meter.unit} от ${meter.lastDate}`
                    : 'показаний ещё не было'}
                </span>
              </div>
              <TenantReadingForm meterId={meter.id} unit={meter.unit} lastValue={meter.lastValue} />
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--hp-ink)]">Заявки</h2>
        <ServiceRequestForm propertyId={grant.propertyId} />

        {(requests ?? []).length > 0 && (
          <div className="hp-block">
            {(requests ?? []).map(r => (
              <div key={r.id} className="hp-block-row">
                <span className="label">
                  {REQUEST_CATEGORY_LABELS[r.category] ?? r.category}
                  <span className="block text-[12px]">{r.description}</span>
                  {r.status === 'rejected' && r.reject_reason && (
                    <span className="block text-[12px] text-[var(--hp-danger)]">
                      Причина: {r.reject_reason}
                    </span>
                  )}
                </span>
                <span className="value">
                  <span className={`hp-badge ${REQUEST_STATUS_BADGE[r.status] ?? 'hp-badge-neutral'}`}>
                    {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Link href="/cabinet" className="hp-btn-secondary">К списку объектов</Link>
    </div>
  )
}
