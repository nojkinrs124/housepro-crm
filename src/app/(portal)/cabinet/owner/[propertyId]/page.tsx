import { notFound } from 'next/navigation'
import Link from 'next/link'
import { grantFor } from '@/features/portal/services/access.service'
import { loadOwnerView } from '@/features/portal/data/cabinet.data'
import { formatAmount } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Кабинет собственника: что с объектом и сколько ему причитается.
 *
 * Состав отчёта зависит от схемы расчёта: при фиксированной выплате доход
 * агентства не раскрывается — собственник получает оговорённую сумму, а маржа
 * агентства его расчёта не касается.
 */
export default async function OwnerCabinetPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params

  // Доступ проверяется заново на каждом запросе: идентификатор из адреса не
  // доверенный. Отказ — именно 404, а не 403: иначе перебором можно узнать,
  // какие объекты существуют.
  const grant = await grantFor(propertyId, 'owner')
  if (!grant) notFound()

  const view = await loadOwnerView(grant)
  if (!view) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-[var(--hp-ink)] text-[19px]">{view.property.title}</h1>
        {view.property.address && (
          <p className="text-sm text-[var(--hp-sub)]">{view.property.address}</p>
        )}
      </div>

      <div className="hp-block">
        <div className="hp-block-header">Сейчас</div>
        <div className="hp-block-row">
          <span className="label">Арендатор</span>
          <span className="value">{view.vacant ? 'объект свободен' : view.tenantName ?? 'не указан'}</span>
        </div>
        {view.rentAmount != null && (
          <div className="hp-block-row">
            <span className="label">Арендная плата</span>
            <span className="value">{formatAmount(view.rentAmount)} ₽/мес</span>
          </div>
        )}
        {view.rentEnd && (
          <div className="hp-block-row">
            <span className="label">Договор найма до</span>
            <span className="value">{view.rentEnd}</span>
          </div>
        )}
        <div className="hp-block-row">
          <span className="label">{view.balance < 0 ? 'Ваша задолженность' : 'К перечислению вам'}</span>
          <span className={`value ${view.balance < 0 ? 'danger' : 'accent'}`}>
            {formatAmount(Math.abs(view.balance))} ₽
          </span>
        </div>
      </div>

      {view.reports.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--hp-ink)]">Отчёты по месяцам</h2>
          {view.reports.map(report => (
            <div key={`${report.year}-${report.month}`} className="hp-block">
              <div className="hp-block-header flex items-center justify-between gap-2">
                <span>{String(report.month).padStart(2, '0')}.{report.year}</span>
                {report.hasPending && (
                  <span className="hp-badge hp-badge-warn">период не закрыт</span>
                )}
              </div>
              {report.lines.map(line => (
                <div key={line.label} className="hp-block-row">
                  <span className="label">{line.label}</span>
                  <span className="value">
                    {line.negative ? '− ' : ''}{formatAmount(line.amount)} ₽
                  </span>
                </div>
              ))}
              <div className="hp-block-row">
                <span className="label">
                  {report.dueToOwner < 0 ? 'Задолженность перед агентством' : 'К перечислению'}
                </span>
                <span className="value accent">{formatAmount(Math.abs(report.dueToOwner))} ₽</span>
              </div>
            </div>
          ))}
        </section>
      )}

      {view.meters.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--hp-ink)]">Счётчики</h2>
          {view.meters.map(meter => (
            <div key={meter.id} className="hp-block">
              <div className="hp-block-header">{meter.title}</div>
              {meter.readings.length === 0 ? (
                <div className="p-[18px] text-sm text-[var(--hp-sub)]">Показаний пока нет</div>
              ) : (
                meter.readings.map(r => (
                  <div key={r.reading_date} className="hp-block-row">
                    <span className="label">{r.reading_date}</span>
                    <span className="value">
                      {r.value} {meter.unit}
                      {r.consumption != null && (
                        <span className="text-[var(--hp-sub)] font-normal"> · расход {r.consumption}</span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          ))}
        </section>
      )}

      <Link href="/cabinet" className="hp-btn-secondary">К списку объектов</Link>
    </div>
  )
}
