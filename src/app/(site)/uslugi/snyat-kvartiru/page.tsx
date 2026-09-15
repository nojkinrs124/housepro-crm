import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { ANALYTICS_EVENTS, analyticsAttrs } from '@/features/site/uslugi/analytics'
import { formatRub } from '@/features/site/uslugi/calc'
import {
  LEGAL_SUPPORT_PRICING,
  USLUGI,
  USLUGI_ANCHORS,
  USLUGI_CONTACTS,
  USLUGI_LEAD_SOURCES,
  USLUGI_ROUTES,
  tenantCommissionLabel,
} from '@/features/site/uslugi/config'
import { UslugiLeadForm } from '@/features/site/uslugi/components/UslugiLeadForm'
import { WhatIf, type WhatIfItem } from '@/features/site/uslugi/components/WhatIf'

/**
 * Страница «Снять квартиру» — для нанимателей.
 *
 * Тексты — дословно из docs/uslugi/uslugi-ostalnye-stranicy-texts.md (раздел 2),
 * числа — только из config.ts. Серверный компонент: интерактивность — внутри
 * WhatIf (аккордеон) и UslugiLeadForm.
 */

export const metadata: Metadata = {
  title: 'Снять квартиру в Красноярске — подбор с проверкой документов | ХаусПро',
  description: `Подберём квартиру под бюджет и район, включая закрытую базу. Проверяем собственника до залога, составляем договор и акт с описью. Комиссия ${tenantCommissionLabel()}, платится после заселения.`,
}

const WHAT_WE_DO = [
  'Разбираемся, что вам нужно: бюджет, район, срок, животные, дети, мебель — чтобы не возить вас по неподходящим вариантам',
  'Подбираем из открытых площадок и из закрытой базы: часть собственников не публикует квартиры, эти варианты вы сами не найдёте',
  'Проверяем собственника до показа: выписка из ЕГРН, основание права собственности, согласие супруга, обременения, прописанные третьи лица',
  'Организуем просмотры и ездим с вами',
  'Торгуемся о ставке и условиях: срок, индексация, кто платит коммуналку, можно ли с животными',
  'Составляем договор найма, где прописаны условия возврата залога и порядок расторжения — это то, из-за чего чаще всего теряют деньги',
  'Фиксируем состояние квартиры актом с описью, фото и показаниями счётчиков',
  `Заселяем в день показа: если квартира понравилась, документы готовим на месте, ${USLUGI.timing.moveInMinutes} минут — и вы с ключами`,
]

interface Step {
  title: string
  text: string
}

const STEPS: Step[] = [
  { title: 'Заявка или звонок.', text: 'Рассказываете, что ищете и на какой бюджет.' },
  { title: 'Подборка.', text: 'Присылаем варианты, которые реально свободны сейчас, а не «уже сдали вчера».' },
  {
    title: 'Просмотры.',
    text: 'Ездим вместе, проверяем документы собственника по каждому понравившемуся варианту.',
  },
  { title: 'Договор и заселение.', text: 'Договор, акт с описью, ключи. В тот же день.' },
]

const SNYAT_WHAT_IF: WhatIfItem[] = [
  {
    q: 'Собственник не вернёт залог при выезде.',
    a: 'Поэтому мы делаем акт с описью и фото при заселении. Без него спор сводится к «было — не было», с ним — к документу.',
  },
  {
    q: 'Квартиру продадут, пока я в ней живу.',
    a: 'Смена собственника не прекращает договор найма: новый владелец обязан соблюдать его до конца срока. Мы прописываем это отдельно.',
  },
  {
    q: 'Хозяин будет приходить без предупреждения.',
    a: 'В договоре фиксируем порядок посещений — как правило, с предупреждением за сутки.',
  },
  {
    q: 'Через месяц поднимут цену.',
    a: 'Условия и порядок изменения ставки прописаны в договоре. Без вашего согласия ставку поднять нельзя.',
  },
  {
    q: 'Я нашёл квартиру сам, но боюсь подписывать.',
    a: LEGAL_SUPPORT_PRICING
      ? `Проверим документы и оформим сделку без подбора — юридическое сопровождение от ${formatRub(LEGAL_SUPPORT_PRICING.fromRub)}.`
      : 'Проверим документы и оформим сделку без подбора.',
  },
]

const LEAD_FOOTNOTE = `Перезвоним в течение ${USLUGI.callback.withinMinutes} минут. ${USLUGI.callback.workingHours}.`

export default function SnyatKvartiruPage() {
  return (
    <>
      {/* ── Первый экран ───────────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-10 sm:pt-14">
        <div className="max-w-[760px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--hp-sub)' }}>
            Нанимателям · Красноярск и Берёзовка
          </p>
          <h1
            className="mt-4 text-[30px] sm:text-[40px] font-bold tracking-tight leading-tight break-words"
            style={{ color: 'var(--hp-ink)' }}
          >
            Снять квартиру в Красноярске — без сюрпризов с документами
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed max-w-[640px]" style={{ color: 'var(--hp-sub)' }}>
            Подберём жильё под ваш бюджет и район, проверим собственника до того, как вы внесёте залог, и
            составим договор, который защищает и вас тоже.
          </p>

          <div
            className="mt-6 border px-4 py-3 text-[14px] font-semibold leading-relaxed"
            style={{
              background: 'var(--hp-good-tint)',
              borderColor: 'var(--hp-good)',
              borderRadius: 'var(--hp-radius)',
              color: 'var(--hp-ink)',
            }}
          >
            Платите только после заселения. За подбор и просмотры денег не берём.
          </div>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a href={`#${USLUGI_ANCHORS.lead}`} className="hp-btn-primary h-11 justify-center">
              Подобрать квартиру
            </a>
            <a
              href={USLUGI_CONTACTS.phoneHref}
              className="hp-btn-secondary h-11 justify-center"
              {...analyticsAttrs(ANALYTICS_EVENTS.phoneClick)}
            >
              Позвонить {USLUGI_CONTACTS.phone}
            </a>
          </div>
        </div>
      </section>

      {/* ── Что делаем ─────────────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Что делаем
        </h2>
        <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {WHAT_WE_DO.map(item => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-[14px] leading-relaxed"
              style={{ color: 'var(--hp-ink)' }}
            >
              <Check
                aria-hidden="true"
                style={{ width: 16, height: 16, marginTop: 3, color: 'var(--hp-accent)', flexShrink: 0 }}
              />
              <span className="break-words">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Сколько стоит ──────────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Сколько стоит
        </h2>
        <div
          className="mt-6 border p-5 sm:p-6"
          style={{
            background: 'var(--hp-surface)',
            borderColor: 'var(--hp-border)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          <div className="flex items-baseline gap-3 flex-wrap">
            <span
              className="text-[40px] font-bold tracking-tight leading-none"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--hp-ink)' }}
            >
              {tenantCommissionLabel()}
            </span>
            <strong className="text-[15px] font-bold" style={{ color: 'var(--hp-ink)' }}>
              от месячной ставки аренды, один раз при заселении.
            </strong>
          </div>
          <p className="mt-3 text-[14px] sm:text-[15px] leading-relaxed max-w-[640px]" style={{ color: 'var(--hp-sub)' }}>
            Комиссия платится в день подписания договора. Если ничего не подобрали — вы не платите ничего.
          </p>
        </div>
      </section>

      {/* ── Как это работает ───────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Как это работает
        </h2>
        <ol className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="border p-5 flex flex-col"
              style={{
                background: 'var(--hp-surface)',
                borderColor: 'var(--hp-border)',
                borderRadius: 'var(--hp-radius)',
              }}
            >
              <span
                className="text-[28px] font-bold leading-none"
                style={{ fontFamily: "'Source Serif 4', Georgia, serif", color: 'var(--hp-accent)' }}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="mt-4 text-[15px] font-bold leading-snug" style={{ color: 'var(--hp-ink)' }}>
                {step.title}
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Что если ───────────────────────────────────────────────────── */}
      <WhatIf items={SNYAT_WHAT_IF} />

      {/* ── Заявка ─────────────────────────────────────────────────────── */}
      <section id={USLUGI_ANCHORS.lead} className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-4 scroll-mt-20">
        <div
          className="border p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-8"
          style={{
            background: 'var(--hp-surface)',
            borderColor: 'var(--hp-border)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          <div className="min-w-0">
            <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
              Расскажите, что ищете
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
              Район, бюджет, сколько комнат и когда нужно заехать. Агент перезвонит и уточнит остальное.
            </p>
          </div>

          <div className="min-w-0">
            <UslugiLeadForm
              source={USLUGI_LEAD_SOURCES.snyat}
              page={USLUGI_ROUTES.snyatKvartiru}
              submitLabel="Подобрать квартиру"
              messagePlaceholder="Например: двушка в Советском районе до 40 000 ₽, заезд с 1 числа"
              footnote={LEAD_FOOTNOTE}
            />
          </div>
        </div>
      </section>
    </>
  )
}
