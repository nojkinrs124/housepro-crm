import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { PrintButton } from '@/features/accounting/components/PrintButton'
import { formatAmount } from '@/lib/utils'
import { buildMonthlyReport } from '@/features/management/services/report.service'

export const dynamic = 'force-dynamic'

// Отчёт собственнику за месяц по объекту в управлении.
//
// Сделан обычной страницей с print-стилями — как счёт на оплату: браузер
// печатает в PDF сам, вёрстка правится без шаблонов и лишних зависимостей.

function parseMonth(raw: string | undefined): Date {
  const m = raw?.match(/^(\d{4})-(\d{2})$/)
  if (!m) {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function fmtDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function OwnerReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const { id } = await params
  const { month: monthParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const month = parseMonth(monthParam)
  const from = month.toISOString().slice(0, 10)
  const to = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)

  const { data: property } = await supabase
    .from('properties')
    .select('id, title, address, owner_id, management_fee')
    .eq('id', id)
    .maybeSingle()

  if (!property) notFound()

  // Обслуживание задаёт схему расчёта, а от неё зависит и состав отчёта, и то,
  // какие суммы собственнику вообще положено видеть.
  const { data: engagement } = await supabase
    .from('management_engagements')
    .select('id, owner_contact_id, settlement_scheme, rate, owner_fixed_amount, owner_payout_day, started_at, ended_at')
    .eq('property_id', id)
    .is('ended_at', null)
    .maybeSingle()

  const [{ data: txns }, { data: owner }, { data: company }, { data: meters }, { data: contracts }] = await Promise.all([
    supabase.from('accounting_transactions')
      .select('id, type, amount, status, date, description, borne_by, category:accounting_categories(name, code)')
      .eq('property_id', id)
      .gte('date', from).lt('date', to)
      .order('date', { ascending: true }),
    // Собственник берётся из обслуживания: properties.owner_id может быть пуст,
    // а платить и отчитываться нужно конкретному человеку.
    (engagement?.owner_contact_id ?? property.owner_id)
      ? supabase.from('contacts').select('full_name, company_name, phone, email')
          .eq('id', engagement?.owner_contact_id ?? property.owner_id!).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('company_settings')
      .select('name, signatory_name, signatory_position, phone, email')
      .order('is_default', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('utility_meters')
      .select('id, kind, title, unit, readings:meter_readings(reading_date, value, consumption, amount)')
      .eq('property_id', id).eq('is_active', true),
    supabase.from('contracts')
      .select('id, contract_number, contract_type, amount, status, end_date')
      .eq('property_id', id),
  ])

  const done = (txns ?? []).filter(t => t.status === 'completed')

  function categoryOf(t: (typeof done)[number]): { name?: string; code?: string } | null {
    const c = t.category as { name?: string; code?: string } | { name?: string; code?: string }[] | null
    return Array.isArray(c) ? c[0] ?? null : c
  }

  // Собственнику показываются только его деньги: поступления от арендатора и
  // расходы, отнесённые на него. Удержание агентства и его собственные траты —
  // не его расчёт. Раньше отчёт складывал всё подряд, и выплата считалась как
  // «все доходы минус все расходы»: удержание попадало в доход собственника,
  // а траты агентства уменьшали его выплату.
  const income = done.filter(t => t.type === 'income' && categoryOf(t)?.code !== 'agency_fee')
  const expense = done.filter(t => t.type === 'expense' && t.borne_by !== 'agency')

  const operations = done.map(t => ({
    type: t.type as 'income' | 'expense',
    status: t.status,
    categoryCode: categoryOf(t)?.code ?? null,
    amount: Number(t.amount || 0),
    date: t.date,
    borneBy: (t.borne_by as 'agency' | 'owner' | null) ?? null,
  }))

  const terms = {
    scheme: (engagement?.settlement_scheme ?? null) as 'percent' | 'fixed' | null,
    rate: engagement?.rate ?? null,
    ownerFixedAmount: engagement?.owner_fixed_amount ?? null,
    ownerPayoutDay: engagement?.owner_payout_day ?? null,
    startedAt: engagement?.started_at ?? from,
    endedAt: engagement?.ended_at ?? null,
  }

  const report = buildMonthlyReport(
    terms,
    month.getUTCFullYear(),
    month.getUTCMonth() + 1,
    operations,
    operations,
  )

  const incomeTotal = income.reduce((s, t) => s + Number(t.amount), 0)
  const expenseTotal = expense.reduce((s, t) => s + Number(t.amount), 0)
  const payout = report.error ? incomeTotal - expenseTotal : report.dueToOwner

  const mgmt = (contracts ?? []).find(c => c.contract_type === 'property_management')

  // Показания за месяц: берутся те, что сняты внутри периода
  const periodReadings = (meters ?? []).map(m => ({
    id: m.id,
    label: m.title || m.kind,
    unit: m.unit,
    rows: ((m.readings ?? []) as { reading_date: string; value: number; consumption: number | null; amount: number | null }[])
      .filter(r => r.reading_date >= from && r.reading_date < to)
      .sort((a, b) => a.reading_date.localeCompare(b.reading_date)),
  })).filter(m => m.rows.length > 0)

  const prev = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1))
  const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))
  // Без owner_id у объекта подписывать отчёт некем — честнее сказать прямо,
  // чем печатать слово «Собственник» вместо имени.
  const ownerName = owner?.company_name || owner?.full_name || 'не указан'

  const cell = 'border border-[var(--hp-border)] px-3 py-2'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <Link href={`/management/${id}`} className="hp-back-link inline-flex items-center gap-2">
          <ArrowLeft style={{ width: 16, height: 16 }} />
          К объекту
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/management/${id}/report?month=${monthKey(prev)}`} className="hp-chip">
            <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
            Пред.
          </Link>
          <Link href={`/management/${id}/report`} className="hp-chip">Текущий</Link>
          <Link href={`/management/${id}/report?month=${monthKey(next)}`} className="hp-chip">
            След.
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </Link>
          <PrintButton label="Печать отчёта" />
        </div>
      </div>

      <div className="bg-[var(--hp-surface)] border border-[var(--hp-border)] p-8 space-y-6 print:border-0 print:p-0">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-[var(--hp-ink)]">
            Отчёт об управлении объектом
          </h1>
          <p className="text-sm text-[var(--hp-sub)] capitalize">
            за {month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </p>
        </div>

        <table className="w-full text-[13px] border border-[var(--hp-border)]">
          <tbody>
            <tr>
              <td className={`${cell} text-[var(--hp-sub)] w-1/3`}>Объект</td>
              <td className={`${cell} text-[var(--hp-ink)]`}>
                {property.title}
                {property.address && <><br /><span className="text-[var(--hp-sub)]">{property.address}</span></>}
              </td>
            </tr>
            <tr>
              <td className={`${cell} text-[var(--hp-sub)]`}>Собственник</td>
              <td className={`${cell} text-[var(--hp-ink)]`}>
                {ownerName}
                {owner?.phone && <span className="text-[var(--hp-sub)]"> · {owner.phone}</span>}
              </td>
            </tr>
            <tr>
              <td className={`${cell} text-[var(--hp-sub)]`}>Управляющий</td>
              <td className={`${cell} text-[var(--hp-ink)]`}>
                {company?.name ?? '—'}
                {mgmt?.contract_number && <span className="text-[var(--hp-sub)]"> · договор {mgmt.contract_number}</span>}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Поступления */}
        <div className="space-y-2">
          <h2 className="font-semibold text-[var(--hp-ink)] text-[15px]">Поступления</h2>
          {income.length === 0 ? (
            <p className="text-sm text-[var(--hp-sub)]">За период поступлений не было.</p>
          ) : (
            <table className="w-full text-[13px] border border-[var(--hp-border)]">
              <thead>
                <tr className="bg-[var(--hp-neutral-tint)]">
                  <th className={`${cell} text-left font-semibold`}>Дата</th>
                  <th className={`${cell} text-left font-semibold`}>Назначение</th>
                  <th className={`${cell} text-right font-semibold`}>Сумма, ₽</th>
                </tr>
              </thead>
              <tbody>
                {income.map(t => (
                  <tr key={t.id}>
                    <td className={cell}>{fmtDate(t.date)}</td>
                    <td className={cell}>
                      {t.description ?? (t.category as { name?: string } | null)?.name ?? 'Поступление'}
                    </td>
                    <td className={`${cell} text-right`}>{formatAmount(Number(t.amount))}</td>
                  </tr>
                ))}
                <tr>
                  <td className={`${cell} font-semibold`} colSpan={2}>Итого поступлений</td>
                  <td className={`${cell} text-right font-semibold`}>{formatAmount(incomeTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Расходы */}
        <div className="space-y-2">
          <h2 className="font-semibold text-[var(--hp-ink)] text-[15px]">Расходы</h2>
          {expense.length === 0 ? (
            <p className="text-sm text-[var(--hp-sub)]">За период расходов не было.</p>
          ) : (
            <table className="w-full text-[13px] border border-[var(--hp-border)]">
              <thead>
                <tr className="bg-[var(--hp-neutral-tint)]">
                  <th className={`${cell} text-left font-semibold`}>Дата</th>
                  <th className={`${cell} text-left font-semibold`}>Назначение</th>
                  <th className={`${cell} text-right font-semibold`}>Сумма, ₽</th>
                </tr>
              </thead>
              <tbody>
                {expense.map(t => (
                  <tr key={t.id}>
                    <td className={cell}>{fmtDate(t.date)}</td>
                    <td className={cell}>
                      {t.description ?? (t.category as { name?: string } | null)?.name ?? 'Расход'}
                    </td>
                    <td className={`${cell} text-right`}>{formatAmount(Number(t.amount))}</td>
                  </tr>
                ))}
                <tr>
                  <td className={`${cell} font-semibold`} colSpan={2}>Итого расходов</td>
                  <td className={`${cell} text-right font-semibold`}>{formatAmount(expenseTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Показания счётчиков */}
        {periodReadings.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold text-[var(--hp-ink)] text-[15px]">Показания счётчиков</h2>
            <table className="w-full text-[13px] border border-[var(--hp-border)]">
              <thead>
                <tr className="bg-[var(--hp-neutral-tint)]">
                  <th className={`${cell} text-left font-semibold`}>Счётчик</th>
                  <th className={`${cell} text-left font-semibold`}>Дата</th>
                  <th className={`${cell} text-right font-semibold`}>Показание</th>
                  <th className={`${cell} text-right font-semibold`}>Расход</th>
                  <th className={`${cell} text-right font-semibold`}>Сумма, ₽</th>
                </tr>
              </thead>
              <tbody>
                {periodReadings.flatMap(m => m.rows.map((r, i) => (
                  <tr key={`${m.id}-${r.reading_date}-${i}`}>
                    <td className={cell}>{m.label}</td>
                    <td className={cell}>{fmtDate(r.reading_date)}</td>
                    <td className={`${cell} text-right`}>{r.value} {m.unit}</td>
                    <td className={`${cell} text-right`}>{r.consumption ?? '—'}</td>
                    <td className={`${cell} text-right`}>{r.amount != null ? formatAmount(Number(r.amount)) : '—'}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}

        {/* Итог. Состав строк задаёт схема расчёта: при проценте раскрывается
            удержание агентства, при фиксированной выплате — обязательство и
            факт выплаты, но не маржа агентства. */}
        {report.error ? (
          <div className="border border-[var(--hp-border)] p-4 text-[13px] space-y-2">
            <p className="text-[var(--hp-warn)]">{report.error}</p>
            <p className="text-[var(--hp-sub)]">
              Ниже — сводка по поступлениям и расходам объекта. Она не заменяет расчёт:
              без схемы неизвестно, что причитается собственнику.
            </p>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className={`${cell} text-[var(--hp-sub)] w-2/3`}>Поступления за период</td>
                  <td className={`${cell} text-right`}>{formatAmount(incomeTotal)} ₽</td>
                </tr>
                <tr>
                  <td className={`${cell} text-[var(--hp-sub)]`}>Расходы за его счёт</td>
                  <td className={`${cell} text-right`}>− {formatAmount(expenseTotal)} ₽</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <table className="w-full text-[13px] border border-[var(--hp-border)]">
            <tbody>
              {report.lines.map(line => (
                <tr key={line.label}>
                  <td className={`${cell} text-[var(--hp-sub)] w-2/3`}>
                    {line.label}
                    {line.hint && <span className="text-[var(--hp-tertiary)]"> · {line.hint}</span>}
                  </td>
                  <td className={`${cell} text-right`}>
                    {line.negative ? '− ' : ''}{formatAmount(line.amount)} ₽
                  </td>
                </tr>
              ))}
              <tr>
                <td className={`${cell} font-semibold`}>
                  {report.dueToOwner < 0 ? 'Задолженность собственника перед агентством' : 'К перечислению собственнику'}
                </td>
                <td className={`${cell} text-right font-bold`}>{formatAmount(Math.abs(payout))} ₽</td>
              </tr>
              <tr>
                <td className={`${cell} text-[var(--hp-sub)]`}>Сальдо на конец периода</td>
                <td className={`${cell} text-right`}>{formatAmount(report.balanceToDate)} ₽</td>
              </tr>
            </tbody>
          </table>
        )}

        {report.hasPending && (
          <p className="text-xs text-[var(--hp-warn)]">
            В периоде есть запланированные операции — период не закрыт, суммы могут измениться.
          </p>
        )}

        {/* Вознаграждение агентства раскрывается только при процентной схеме:
            при фиксированной выплате собственник получает оговорённую сумму, а
            маржа агентства его расчёта не касается. Прежний текст искал
            вознаграждение регуляркой по описанию операции — оно находилось или
            не находилось случайно. */}
        {terms.scheme === 'percent' && terms.rate != null && (
          <p className="text-xs text-[var(--hp-sub)]">
            Удержание агентства — {terms.rate}% от поступлений, посчитано в строке выше.
          </p>
        )}
        {terms.scheme === 'fixed' && terms.ownerFixedAmount != null && (
          <p className="text-xs text-[var(--hp-sub)]">
            Выплата по договору — {formatAmount(Number(terms.ownerFixedAmount))} ₽/мес,
            {terms.ownerPayoutDay != null && ` ${terms.ownerPayoutDay}-го числа`}. Наступает
            независимо от того, заплатил ли арендатор.
          </p>
        )}

        <div className="grid grid-cols-2 gap-8 pt-6 text-[13px]">
          <div>
            <p className="text-[var(--hp-sub)]">Управляющий</p>
            <div className="mt-8 border-t border-[var(--hp-border)] pt-1">
              {company?.signatory_name ?? '—'}
              {company?.signatory_position && (
                <span className="block text-[var(--hp-sub)] text-xs">{company.signatory_position}</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-[var(--hp-sub)]">Собственник</p>
            <div className="mt-8 border-t border-[var(--hp-border)] pt-1">{ownerName}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
