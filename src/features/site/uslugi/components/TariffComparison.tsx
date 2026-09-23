'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { formatRub } from '../calc'
import { TARIFFS, TARIFF_IDS, USLUGI, tariffCommissionLabel, type TariffId } from '../config'

/**
 * Экран 4 страницы «Сдать квартиру» — сравнение тарифов.
 *
 * По умолчанию видна только «дельта» — что добавляется на следующем уровне,
 * посчитанная из тех же ROWS, что и полная таблица (не отдельный текст, чтобы
 * не разъезжалось с конфигом). Полная таблица на 20+ строк — под кнопкой,
 * на мобильном она едет вбок и как первый экран сравнения читается тяжело.
 * Подписи строк — дословно из docs/uslugi/sdat-kvartiru-texts.md, числа —
 * из config.ts. Клиентский из-за useState на кнопке разворота.
 */

interface Props {
  /** id секции для якорных ссылок */
  id?: string
}

interface ComparisonRow {
  label: string
  /** Минимальный тариф, с которого пункт включён */
  from: TariffId
}

// ─── Склонения чисел из конфига ────────────────────────────────────────────

/** Русское множественное число: pluralRu(5, ['день', 'дня', 'дней']) → «дней» */
function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}

const days = (n: number) => `${n} ${pluralRu(n, ['день', 'дня', 'дней'])}`
const months = (n: number) => `${n} ${pluralRu(n, ['месяц', 'месяца', 'месяцев'])}`
/** «до 1 ставки» / «до 2 ставок» — родительный падеж после «до» */
const rates = (n: number) => `${n} ${pluralRu(n, ['ставки', 'ставок', 'ставок'])}`

// ─── Строки таблицы ────────────────────────────────────────────────────────

const { freeReplacementDays, payoutWindow, inspectionEveryMonths, minorRepairs, paymentGuarantee, insurance } = USLUGI

const ROWS: readonly ComparisonRow[] = [
  { label: 'Оценка рыночной ставки', from: 'podbor' },
  { label: 'Фотосъёмка и объявление', from: 'podbor' },
  { label: 'Реклама на площадках', from: 'podbor' },
  { label: 'Показы без вашего участия', from: 'podbor' },
  { label: 'Проверка нанимателя по базам', from: 'podbor' },
  { label: 'Договор под конкретную квартиру', from: 'podbor' },
  { label: 'Акт с описью и счётчиками', from: 'podbor' },
  { label: `Бесплатная замена в первые ${days(freeReplacementDays)}`, from: 'podbor' },
  { label: 'Общение с нанимателем', from: 'upravlenie' },
  { label: 'Контроль оплаты и просрочки', from: 'upravlenie' },
  { label: `Перевод денег с ${payoutWindow.fromDay}-го по ${payoutWindow.toDay}-е число`, from: 'upravlenie' },
  { label: 'Отчёты в личном кабинете', from: 'upravlenie' },
  { label: `Проверка квартиры раз в ${months(inspectionEveryMonths)}`, from: 'upravlenie' },
  {
    label: `Ремонт до ${formatRub(minorRepairs.perIncidentRub)} за поломку, до ${formatRub(minorRepairs.perYearRub)} в год`,
    from: 'upravlenie',
  },
  { label: 'Уборка между нанимателями', from: 'upravlenie' },
  { label: 'Смена нанимателя без комиссии', from: 'upravlenie' },
  { label: `Гарантия платежа до ${rates(paymentGuarantee.maxMonthlyRates)}`, from: 'premium' },
  { label: `Страхование до ${formatRub(insurance.maxRub)}`, from: 'premium' },
  { label: 'Вопросы с УК и авариями', from: 'premium' },
  { label: 'Выезд 24/7', from: 'premium' },
  { label: 'Ежегодный пересмотр ставки', from: 'premium' },
]

/** Пункт включён, если тариф не ниже `from` по порядку TARIFF_IDS */
function isIncluded(row: ComparisonRow, tariffId: TariffId): boolean {
  return TARIFF_IDS.indexOf(tariffId) >= TARIFF_IDS.indexOf(row.from)
}

/** Строки, которые появляются именно на этом тарифе (для блока «что добавляется») */
function rowsAddedAt(tariffId: TariffId): string[] {
  return ROWS.filter(row => row.from === tariffId).map(row => row.label)
}

interface DeltaStep {
  fromLabel: string
  toLabel: string
  added: string[]
}

const DELTA_STEPS: DeltaStep[] = TARIFF_IDS.slice(1).map((tariffId, index) => ({
  fromLabel: TARIFFS[TARIFF_IDS[index]].shortName,
  toLabel: TARIFFS[tariffId].shortName,
  added: rowsAddedAt(tariffId),
}))

// ─── Ячейки ────────────────────────────────────────────────────────────────

function Included() {
  return (
    <Check
      role="img"
      aria-label="включено"
      style={{ width: 16, height: 16, color: 'var(--hp-accent)', display: 'inline-block', verticalAlign: 'middle' }}
    />
  )
}

function NotIncluded() {
  return (
    <>
      <span aria-hidden="true" style={{ color: 'var(--hp-tertiary)' }}>
        —
      </span>
      <span className="sr-only">не включено</span>
    </>
  )
}

/** Фон колонки популярного тарифа — в шапке, ячейках и итоговой строке */
const highlight = (tariffId: TariffId) =>
  TARIFFS[tariffId].popular ? { background: 'var(--hp-accent-tint)' } : undefined

// ─── Компонент ─────────────────────────────────────────────────────────────

export function TariffComparison({ id }: Props) {
  const [fullTableOpen, setFullTableOpen] = useState(false)

  return (
    <section id={id} className="scroll-mt-20 pt-16 sm:pt-20">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Что добавляется на следующем уровне
        </h2>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DELTA_STEPS.map(step => (
            <div
              key={step.toLabel}
              className="border p-5"
              style={{
                background: 'var(--hp-surface)',
                borderColor: 'var(--hp-border)',
                borderRadius: 'var(--hp-radius)',
              }}
            >
              <p className="text-[13px] font-bold" style={{ color: 'var(--hp-accent)' }}>
                {step.fromLabel} → {step.toLabel}
              </p>
              <ul className="mt-3 space-y-2">
                {step.added.map(label => (
                  <li
                    key={label}
                    className="flex items-start gap-2 text-[13.5px] leading-relaxed"
                    style={{ color: 'var(--hp-ink)' }}
                  >
                    <Check
                      aria-hidden="true"
                      style={{ width: 15, height: 15, marginTop: 2, color: 'var(--hp-accent)', flexShrink: 0 }}
                    />
                    <span className="break-words">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setFullTableOpen(v => !v)}
          aria-expanded={fullTableOpen}
          className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold"
          style={{ color: 'var(--hp-accent)' }}
        >
          {fullTableOpen ? 'Скрыть полное сравнение' : 'Показать полное сравнение построчно'}
          <ChevronDown
            aria-hidden="true"
            className={`transition-transform${fullTableOpen ? ' rotate-180' : ''}`}
            style={{ width: 14, height: 14 }}
          />
        </button>

        {/* На телефоне видна одна колонка тарифа — без подсказки не очевидно, что таблица едет вбок */}
        {fullTableOpen && (
          <p className="mt-4 text-[13px] sm:hidden" style={{ color: 'var(--hp-tertiary)' }}>
            Таблица прокручивается вбок →
          </p>
        )}

        <div
          hidden={!fullTableOpen}
          className="mt-4 border overflow-x-auto"
          style={{
            background: 'var(--hp-surface)',
            borderColor: 'var(--hp-border)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          <table className="w-full min-w-[560px] text-[13.5px] border-collapse">
            <caption className="sr-only">Сравнение тарифов</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-[200px] text-left px-4 py-3"
                  style={{ background: 'var(--hp-surface)' }}
                >
                  {/* В текстах угловая ячейка пустая — подпись только для скринридера */}
                  <span className="sr-only">Что входит</span>
                </th>
                {TARIFF_IDS.map(tariffId => (
                  <th
                    key={tariffId}
                    scope="col"
                    className="px-3 py-3 text-center font-bold whitespace-nowrap"
                    style={{ color: 'var(--hp-ink)', ...highlight(tariffId) }}
                  >
                    {TARIFFS[tariffId].shortName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(row => (
                <tr key={row.label} className="border-t" style={{ borderColor: 'var(--hp-border-soft)' }}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 min-w-[200px] text-left font-normal px-4 py-2.5 leading-snug"
                    style={{ background: 'var(--hp-surface)', color: 'var(--hp-ink)' }}
                  >
                    {row.label}
                  </th>
                  {TARIFF_IDS.map(tariffId => (
                    <td key={tariffId} className="px-3 py-2.5 text-center" style={highlight(tariffId)}>
                      {isIncluded(row, tariffId) ? <Included /> : <NotIncluded />}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t" style={{ borderColor: 'var(--hp-border-soft)' }}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 min-w-[200px] text-left font-bold px-4 py-3"
                  style={{ background: 'var(--hp-surface)', color: 'var(--hp-ink)' }}
                >
                  Комиссия
                </th>
                {TARIFF_IDS.map(tariffId => (
                  <td
                    key={tariffId}
                    className="px-3 py-3 text-center font-bold whitespace-nowrap"
                    style={{ color: 'var(--hp-ink)', ...highlight(tariffId) }}
                  >
                    {tariffCommissionLabel(TARIFFS[tariffId])}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
