'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { ANALYTICS_EVENTS, analyticsAttrs } from '../analytics'
import { formatRub } from '../calc'
import { TARIFFS, TARIFF_IDS, USLUGI, type TariffId } from '../config'
import { requestLead } from '../lead-context-store'

/**
 * Экран 2 страницы «Сдать квартиру» — три карточки тарифов.
 *
 * Тексты — дословно из docs/uslugi/sdat-kvartiru-texts.md, числа — только из
 * config.ts. Кнопка карточки сохраняет тариф в контекст заявки и прокручивает
 * к форме (`requestLead`), поэтому файл клиентский.
 */

interface Props {
  /** id секции для якорных ссылок (USLUGI_ANCHORS.tariffs) */
  id?: string
}

/** Пункт списка: `lead` — жирное начало («Гарантия платежа.»), `text` — остальное */
interface Feature {
  lead?: string
  text: string
}

interface TariffCopy {
  /** Подпись к проценту в строке цены */
  priceNote: string
  forWhom: string
  /** «Всё из „Разового подбора“, и дальше квартира на нас:» — у тарифов 2 и 3 */
  linkLine?: string
  features: Feature[]
  footnote?: string
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

const RATES_WORDS: Record<number, string> = { 1: 'одной', 2: 'двух', 3: 'трёх' }

/** «до одной месячной ставки» / «до двух месячных ставок» / «до 4 месячных ставок» */
function monthlyRatesPhrase(n: number): string {
  const word = RATES_WORDS[n] ?? String(n)
  return n === 1 ? `${word} месячной ставки` : `${word} месячных ставок`
}

const days = (n: number) => `${n} ${pluralRu(n, ['день', 'дня', 'дней'])}`
const months = (n: number) => `${n} ${pluralRu(n, ['месяц', 'месяца', 'месяцев'])}`
const minutes = (n: number) => `${n} ${pluralRu(n, ['минуту', 'минуты', 'минут'])}`

// ─── Тексты ────────────────────────────────────────────────────────────────

const { freeReplacementDays, paymentGuarantee, minorRepairs, payoutWindow, inspectionEveryMonths, insurance, timing } =
  USLUGI

const insuranceText = insurance.company
  ? `Страхуем квартиру от затопления и порчи имущества на сумму до ${formatRub(insurance.maxRub)} в ${insurance.company} — за наш счёт`
  : `Страхуем квартиру от затопления и порчи имущества на сумму до ${formatRub(insurance.maxRub)} — за наш счёт`

const COPY: Record<TariffId, TariffCopy> = {
  podbor: {
    priceNote: 'от месячной ставки аренды, один раз при заселении',
    forWhom:
      'вы готовы сами общаться с нанимателем, принимать платежи и решать бытовые вопросы. От нас нужен только грамотный вход в сделку.',
    features: [
      {
        text: 'Оценим ставку: смотрим 20–30 похожих объявлений в вашем районе и называем цену, по которой квартира реально сдастся, а не простоит месяц',
      },
      { text: 'Фотографируем квартиру и пишем объявление — за наш счёт' },
      { text: 'Публикуем на Авито, Циан, Яндекс.Недвижимости и в нашем канале' },
      { text: 'Принимаем звонки и проводим показы сами — вам приезжать не нужно' },
      {
        text: 'Проверяем нанимателя: паспорт на действительность, долги и исполнительные производства в ФССП, реестр банкротов, занятость и платёжеспособность',
      },
      { text: 'Показываем вам кандидата до заселения — решение за вами, без вашего «да» никто не въедет' },
      {
        text: 'Готовим договор найма под вашу квартиру: срок, дата и способ оплаты, кто платит коммуналку, что считается мелким ремонтом, условия досрочного расторжения и возврата депозита',
      },
      { text: 'Составляем акт приёма-передачи: опись мебели и техники, фото состояния, показания счётчиков' },
      {
        text: `Заселяем в день показа: если квартира понравилась, документы готовим на месте, подписание занимает ${minutes(timing.moveInMinutes)}`,
      },
      { text: `Если наниматель съедет в первые ${days(freeReplacementDays)} — подбираем нового бесплатно` },
    ],
    footnote: 'Наниматель платит свою комиссию отдельно, из вашей ставки она не вычитается.',
  },
  upravlenie: {
    priceNote: 'от ежемесячного платежа',
    forWhom:
      'вы не хотите заниматься квартирой сами — общение с нанимателем, мелкий ремонт и текущие вопросы решаем мы, вам остаётся получать деньги.',
    linkLine: 'Всё из «Разового подбора», и дальше квартира на нас:',
    features: [
      { text: 'Общение с нанимателем берём на себя: бытовые вопросы, соседи, аварии, управляющая компания' },
      { text: 'Контролируем оплату: напоминаем, работаем с просрочкой. Вы не звоните нанимателю и не просите денег' },
      { text: `Переводим вам арендную плату с ${payoutWindow.fromDay}-го по ${payoutWindow.toDay}-е число` },
      {
        text: 'Отчёт в личном кабинете: что поступило, что удержано, что потрачено на квартиру — видно в любой момент с телефона',
      },
      { text: `Проверяем квартиру раз в ${months(inspectionEveryMonths)} и присылаем фотоотчёт` },
      { text: 'Снимаем показания счётчиков и следим, чтобы коммуналка платилась вовремя' },
      {
        text: `Мелкий ремонт за наш счёт: до ${formatRub(minorRepairs.perIncidentRub)} за поломку и до ${formatRub(minorRepairs.perYearRub)} в год — смесители, розетки, замки, мелкая сантехника`,
      },
      { text: 'Генеральная уборка между нанимателями — за наш счёт' },
      { text: 'Смена нанимателя без новой комиссии: выселяем, убираем, ищем следующего' },
    ],
  },
  premium: {
    priceNote: 'от ежемесячного платежа',
    forWhom: 'вы хотите, чтобы доход был предсказуемым, даже если с нанимателем что-то пойдёт не так.',
    linkLine: 'Всё из «Управления», и сверху — защита от главных рисков:',
    features: [
      {
        lead: 'Гарантия платежа.',
        text: `Наниматель просрочил больше ${days(paymentGuarantee.overdueDays)} — платим вам сами, до ${monthlyRatesPhrase(paymentGuarantee.maxMonthlyRates)}, и параллельно занимаемся выселением`,
      },
      { text: insuranceText },
      { text: 'Все вопросы с управляющей компанией и аварийными службами — на нас' },
      { text: 'Выезжаем на объект в любое время, включая ночь и выходные' },
      {
        text: 'Раз в год пересматриваем ставку по рынку и сами договариваемся с нанимателем о повышении — ваш доход не отстаёт от рынка',
      },
    ],
  },
}

const POPULAR_BADGE = 'выбирают чаще всего'

const FEATURES_VISIBLE_COUNT = 5

/**
 * Раскрывающийся список пунктов тарифа: по умолчанию первые 5, остальное —
 * под кнопкой. Локальный компонент этого файла (не отдельный экспорт), потому
 * что пункты — составные (`{ lead, text }`) и рендерятся функцией; вынести это
 * в отдельный переиспользуемый компонент нельзя — серверные страницы раздела
 * не могут передавать функции клиентским компонентам (см. ExpandableList.tsx).
 */
function FeatureList({ features }: { features: Feature[] }) {
  const [expanded, setExpanded] = useState(false)
  const hasMore = features.length > FEATURES_VISIBLE_COUNT
  const shown = expanded ? features : features.slice(0, FEATURES_VISIBLE_COUNT)

  return (
    <>
      <ul className="space-y-2.5">
        {shown.map(f => (
          <li
            key={f.text}
            className="flex items-start gap-2.5 text-[13.5px] leading-relaxed"
            style={{ color: 'var(--hp-ink)' }}
          >
            <Check
              aria-hidden="true"
              style={{ width: 16, height: 16, marginTop: 2, color: 'var(--hp-accent)', flexShrink: 0 }}
            />
            <span className="break-words">
              {f.lead && <strong className="font-bold">{f.lead} </strong>}
              {f.text}
            </span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold"
          style={{ color: 'var(--hp-accent)' }}
        >
          {expanded ? 'Свернуть' : `Показать все ${features.length} пунктов`}
          <ChevronDown
            aria-hidden="true"
            className={`transition-transform${expanded ? ' rotate-180' : ''}`}
            style={{ width: 14, height: 14 }}
          />
        </button>
      )}
    </>
  )
}

// ─── Компонент ─────────────────────────────────────────────────────────────

export function TariffCards({ id }: Props) {
  return (
    <section id={id} className="scroll-mt-20 pt-16 sm:pt-20">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Три тарифа — выберите, сколько работы оставляете себе
        </h2>
        <p className="mt-2 text-[14px] sm:text-[15px] leading-relaxed max-w-[640px]" style={{ color: 'var(--hp-sub)' }}>
          Что входит в каждый тариф, написано ниже дословно и попадает в договор. Ни одного пункта «и другие
          вопросы по объекту».
        </p>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {TARIFF_IDS.map((tariffId, index) => {
            const t = TARIFFS[tariffId]
            const copy = COPY[tariffId]
            return (
              <article
                key={t.id}
                className="p-5 sm:p-6 flex flex-col h-full border"
                style={{
                  background: 'var(--hp-surface)',
                  borderColor: t.popular ? 'var(--hp-accent)' : 'var(--hp-border)',
                  borderRadius: 'var(--hp-radius)',
                }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span
                    className="text-[11px] font-bold tracking-widest uppercase"
                    style={{ color: 'var(--hp-tertiary)' }}
                  >
                    Тариф {index + 1}
                  </span>
                  {t.popular && <span className="hp-badge hp-badge-good">{POPULAR_BADGE}</span>}
                </div>

                <h3 className="mt-3 text-[21px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
                  {t.name}
                </h3>

                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--hp-border-soft)' }}>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className="text-[34px] font-bold tracking-tight leading-none"
                      style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--hp-ink)' }}
                    >
                      {t.percent}%
                    </span>
                    <span className="text-[13px] font-medium" style={{ color: 'var(--hp-sub)' }}>
                      {copy.priceNote}
                    </span>
                  </div>
                </div>

                <p className="mt-4 text-[14px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
                  <span className="font-semibold" style={{ color: 'var(--hp-ink)' }}>
                    Для кого:
                  </span>{' '}
                  {copy.forWhom}
                </p>

                <div className="mt-5 flex-1">
                  {copy.linkLine && (
                    <p className="text-[12.5px] font-semibold mb-2.5" style={{ color: 'var(--hp-accent)' }}>
                      {copy.linkLine}
                    </p>
                  )}
                  <FeatureList features={copy.features} />
                  {copy.footnote && (
                    <p
                      className="mt-4 pt-3 text-[12.5px] leading-relaxed border-t"
                      style={{ borderColor: 'var(--hp-border-soft)', color: 'var(--hp-tertiary)' }}
                    >
                      {copy.footnote}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => requestLead({ intent: 'tariff', tariffId: t.id })}
                  {...analyticsAttrs(ANALYTICS_EVENTS.tariffClick, { tariff: t.id })}
                  className={`${t.popular ? 'hp-btn-primary' : 'hp-btn-secondary'} h-11 justify-center mt-6`}
                >
                  {t.ctaLabel}
                </button>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
