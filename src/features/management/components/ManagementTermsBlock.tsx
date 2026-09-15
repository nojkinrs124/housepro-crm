import Link from 'next/link'
import { ArrowUpRight, FileText, Plus } from 'lucide-react'
import { getSettlementScheme } from '@/features/plans/config/settlement'
import {
  PROPERTY_MANAGEMENT_SERVICE_OPTIONS,
  REPORT_FREQUENCY_LABELS,
  toPropertyManagementDefaults,
} from '@/features/contracts/utils/property-management-data'
import { formatAmount, formatDateCompact } from '@/lib/utils'

interface PlanSummary {
  title?: string | null
  repair_limit?: number | null
  obligations?: unknown
}

export interface TermsEngagement {
  settlement_scheme: string | null
  rate: number | null
  owner_fixed_amount: number | null
  owner_payout_day: number | null
  repair_limit: number | null
  notes: string | null
  plan: PlanSummary | PlanSummary[] | null
}

export interface TermsContract {
  id: string
  contract_number: string | null
  start_date: string | null
  end_date: string | null
  amount: number | null
  contract_type_data: unknown
  plan_rate: number | null
  settlement_scheme: string | null
  owner_fixed_amount: number | null
  owner_payout_day: number | null
  plan: PlanSummary | PlanSummary[] | null
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

/**
 * Условия обслуживания одним блоком: договор, тариф, схема расчёта, услуги.
 *
 * До 16.09.2026 это были два блока — «Договор управления» и «Тариф и
 * обязательства», и второй читал схему из договора, тогда как взаиморасчёт
 * считается по условиям самого обслуживания. Здесь источник один: условия
 * обслуживания, договор — запасной вариант, пока условия не заполнены.
 *
 * Server Component: только разметка, интерактива нет.
 */
export function ManagementTermsBlock({
  propertyId,
  engagement,
  contract,
  propertyFee,
}: {
  propertyId: string
  engagement: TermsEngagement | null
  contract: TermsContract | null
  /** Вознаграждение из карточки объекта — показывается, пока в договоре суммы нет */
  propertyFee: number | null
}) {
  const plan = one(engagement?.plan) ?? one(contract?.plan)
  const schemeValue = engagement?.settlement_scheme ?? contract?.settlement_scheme ?? null
  const scheme = getSettlementScheme(schemeValue)
  const rate = engagement?.rate ?? contract?.plan_rate ?? null
  const fixedAmount = engagement?.owner_fixed_amount ?? contract?.owner_fixed_amount ?? null
  const payoutDay = engagement?.owner_payout_day ?? contract?.owner_payout_day ?? null
  const repairLimit = engagement?.repair_limit ?? plan?.repair_limit ?? null

  const obligations = Array.isArray(plan?.obligations)
    ? (plan.obligations as { title?: string }[])
        .map(o => o?.title)
        .filter((t): t is string => typeof t === 'string')
    : []

  const extra = toPropertyManagementDefaults(contract?.contract_type_data)
  const services = (extra.services ?? [])
    .map(v => PROPERTY_MANAGEMENT_SERVICE_OPTIONS.find(o => o.value === v)?.label ?? v)
  if (extra.service_other) services.push(extra.service_other)

  const fee = contract?.amount ?? propertyFee

  return (
    <div className="hp-block">
      <div className="hp-block-header flex items-center justify-between gap-2">
        <span>Условия обслуживания</span>
        {engagement && (
          <Link href={`/management/${propertyId}/terms`}
            className="text-[12.5px] font-semibold normal-case tracking-normal text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
            Изменить
          </Link>
        )}
      </div>

      {contract ? (
        <Link href={`/contracts/${contract.id}`} className="hp-block-item">
          <FileText className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
          <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)] font-semibold">
            {contract.contract_number ?? 'Договор управления'}
          </span>
          <span className="shrink-0 text-[12px] text-[var(--hp-sub)]">
            {contract.start_date ? formatDateCompact(contract.start_date) : '—'}
            {' — '}
            {contract.end_date ? formatDateCompact(contract.end_date) : 'бессрочно'}
          </span>
          <ArrowUpRight className="w-4 h-4 shrink-0 text-[var(--hp-tertiary)]" />
        </Link>
      ) : (
        <Link
          href={`/contracts/new?type=property_management&property_id=${propertyId}`}
          className="hp-block-item text-[var(--hp-accent)] font-semibold"
        >
          <Plus className="w-4 h-4 shrink-0" />
          Оформить договор управления
        </Link>
      )}

      <div className="hp-block-row">
        <span className="label">Тариф</span>
        <span className={`value${plan?.title ? '' : ' muted'}`}>{plan?.title ?? 'не выбран'}</span>
      </div>
      <div className="hp-block-row">
        <span className="label">Схема расчёта</span>
        <span className={`value${scheme ? '' : ' muted'}`}>
          {scheme
            ? <>
                {scheme.label}
                <span className={`block text-[11.5px] font-normal ${scheme.vacancyRiskBearer === 'agency' ? 'text-[var(--hp-danger)]' : 'text-[var(--hp-sub)]'}`}>
                  риск простоя {scheme.vacancyRiskBearer === 'agency' ? 'на агентстве' : 'на собственнике'}
                </span>
              </>
            : 'не выбрана'}
        </span>
      </div>
      {schemeValue === 'percent' && (
        <div className="hp-block-row">
          <span className="label">Удержание агентства</span>
          <span className={`value${rate == null ? ' muted' : ''}`}>
            {rate == null ? 'ставка не задана' : `${rate}% от платежа`}
          </span>
        </div>
      )}
      {schemeValue === 'fixed' && (
        <div className="hp-block-row">
          <span className="label">Выплата собственнику</span>
          <span className={`value${fixedAmount == null ? ' muted' : ''}`}>
            {fixedAmount == null
              ? 'сумма не задана'
              : `${formatAmount(Number(fixedAmount))} ₽/мес${payoutDay != null ? `, ${payoutDay}-го числа` : ''}`}
          </span>
        </div>
      )}
      <div className="hp-block-row">
        <span className="label">Вознаграждение</span>
        <span className={`value${fee == null ? ' muted' : ''}`}>
          {fee == null
            ? 'не указано'
            : `${formatAmount(Number(fee))} ₽/мес${contract?.amount == null ? ' (из карточки объекта)' : ''}`}
        </span>
      </div>
      {repairLimit != null && (
        <div className="hp-block-row">
          <span className="label">Мелкий ремонт за счёт агентства</span>
          <span className="value">до {formatAmount(Number(repairLimit))} ₽</span>
        </div>
      )}
      {obligations.length > 0 && (
        <div className="hp-block-row">
          <span className="label">Что входит</span>
          <span className="value">{obligations.join(' · ')}</span>
        </div>
      )}
      {services.length > 0 && (
        <div className="hp-block-row">
          <span className="label">Услуги по договору</span>
          <span className="value">{services.join(', ')}</span>
        </div>
      )}
      {contract && (
        <div className="hp-block-row">
          <span className="label">Отчёт собственнику</span>
          <span className="value">{REPORT_FREQUENCY_LABELS[extra.report_frequency ?? 'monthly']}</span>
        </div>
      )}
      {engagement?.notes && (
        <div className="hp-block-row">
          <span className="label">Примечание</span>
          <span className="value muted">{engagement.notes}</span>
        </div>
      )}
    </div>
  )
}
