import { Check } from 'lucide-react'
import { formatRub } from '../calc'
import { TARIFFS, TARIFF_IDS, USLUGI, tariffCommissionLabel, type TariffId } from '../config'

/**
 * Экран 4 страницы «Сдать квартиру» — таблица сравнения тарифов.
 *
 * Серверный компонент: интерактивности нет, только разметка. Подписи строк —
 * дословно из docs/uslugi/sdat-kvartiru-texts.md, числа в них — из config.ts.
 * Включённость описана данными: у каждой строки `from` — минимальный тариф,
 * начиная с которого пункт входит (порядок тарифов — TARIFF_IDS).
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
  return (
    <section id={id} className="scroll-mt-20 pt-16 sm:pt-20">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Сравнение тарифов
        </h2>
        {/* На телефоне видна одна колонка тарифа — без подсказки не очевидно, что таблица едет вбок */}
        <p className="mt-2 text-[13px] sm:hidden" style={{ color: 'var(--hp-tertiary)' }}>
          Таблица прокручивается вбок →
        </p>

        <div
          className="mt-4 sm:mt-8 border overflow-x-auto"
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
