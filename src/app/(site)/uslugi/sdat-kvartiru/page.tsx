import type { Metadata } from 'next'
import { Phone, Send, X } from 'lucide-react'
import { ANALYTICS_EVENTS, analyticsAttrs } from '@/features/site/uslugi/analytics'
import {
  USLUGI,
  USLUGI_ANCHORS,
  USLUGI_CONTACTS,
  USLUGI_LEAD_SOURCES,
  USLUGI_ROUTES,
} from '@/features/site/uslugi/config'
import { IncomeCalculator } from '@/features/site/uslugi/components/IncomeCalculator'
import { TariffCards } from '@/features/site/uslugi/components/TariffCards'
import { PaymentGuarantee } from '@/features/site/uslugi/components/PaymentGuarantee'
import { TariffComparison } from '@/features/site/uslugi/components/TariffComparison'
import { HowItWorks } from '@/features/site/uslugi/components/HowItWorks'
import { DocumentSamples } from '@/features/site/uslugi/components/DocumentSamples'
import { WhatIf } from '@/features/site/uslugi/components/WhatIf'
import { SDAT_WHAT_IF } from '@/features/site/uslugi/components/what-if-sdat'
import { TrustBlock } from '@/features/site/uslugi/components/TrustBlock'
import { UslugiLeadForm } from '@/features/site/uslugi/components/UslugiLeadForm'
import { StickyMobileBar } from '@/features/site/uslugi/components/StickyMobileBar'
import { fetchSiteStats } from '@/features/site/lib/stats'

export const metadata: Metadata = {
  title: 'Сдать квартиру в аренду в Красноярске — тарифы и доверительное управление | ХаусПро',
  description:
    'Сдадим вашу квартиру: оценка ставки, проверка нанимателя, договор и акт с описью. Три тарифа — разовый подбор, управление, премиум с гарантией платежа. Первая сделка бесплатно.',
}

const HERO_ID = 'sdat-hero'

const PAIN_POINTS = [
  'Наниматель перестал платить, а вы узнаёте об этом от соседей',
  'Наниматель испортил технику — и непонятно, кто платит за ремонт',
  'Квартира стоит пустая, потому что искать нанимателя самому — это время, которого нет',
]

/** «один объект» / «два объекта» — из USLUGI.freeFirstDeal.objectsPerOwner */
function objectsPhrase(n: number): string {
  const words: Record<number, string> = { 1: 'один объект', 2: 'два объекта', 3: 'три объекта' }
  return words[n] ?? `${n} объектов`
}

/**
 * /uslugi/sdat-kvartiru — главная страница раздела для собственника.
 * Порядок экранов — строго по docs/uslugi/sdat-kvartiru-texts.md; секции —
 * готовые компоненты, здесь только первый экран и форма заявки.
 */
export default async function SdatKvartiruPage() {
  const stats = await fetchSiteStats()
  return (
    <>
      {/* ── Экран 1: заголовок ────────────────────────────────────────── */}
      <section id={HERO_ID} className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-10 sm:pt-14">
        <div className="max-w-[760px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--hp-sub)' }}>
            Собственникам · Красноярск и Берёзовка
          </p>
          <h1
            className="mt-4 text-[30px] sm:text-[40px] font-bold tracking-tight leading-[1.08] break-words"
            style={{ color: 'var(--hp-ink)' }}
          >
            Сдать квартиру в Красноярске — и перестать быть на связи 24/7
          </h1>
          <p className="mt-5 text-[16px] sm:text-[17px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
            Находим нанимателя, проверяем его по базам, оформляем договор под вашу квартиру и ведём её
            дальше, сколько нужно. Вы получаете деньги на карту, а не звонки про потёкший кран.
          </p>

          <div
            className="mt-6 p-4 sm:p-5 border"
            style={{
              background: 'var(--hp-good-tint)',
              borderColor: 'var(--hp-good)',
              borderRadius: 'var(--hp-radius)',
            }}
          >
            <p className="text-[15px] font-bold" style={{ color: 'var(--hp-good)' }}>
              Первая сделка — бесплатно.
            </p>
            <p className="mt-1 text-[14px] leading-relaxed" style={{ color: 'var(--hp-ink)' }}>
              Комиссию за подбор нанимателя не берём: {objectsPhrase(USLUGI.freeFirstDeal.objectsPerOwner)} на
              собственника, для тех, кто обращается к нам впервые.
            </p>
          </div>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a href={`#${USLUGI_ANCHORS.calculator}`} className="hp-btn-primary h-11 justify-center">
              Посчитать доход
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

      {/* ── Экран 1.5: узнали себя? ──────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-12 sm:pt-16">
        <div
          className="border p-5 sm:p-6"
          style={{
            background: 'var(--hp-surface)',
            borderColor: 'var(--hp-border)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          <h2 className="text-[17px] sm:text-[19px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
            Узнали себя?
          </h2>
          <ul className="mt-4 space-y-3">
            {PAIN_POINTS.map(point => (
              <li
                key={point}
                className="flex items-start gap-2.5 text-[14px] leading-relaxed"
                style={{ color: 'var(--hp-ink)' }}
              >
                <X
                  aria-hidden="true"
                  style={{ width: 15, height: 15, marginTop: 3, color: 'var(--hp-warn)', flexShrink: 0 }}
                />
                <span className="break-words">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Экран 2: тарифы ──────────────────────────────────────────── */}
      <TariffCards id={USLUGI_ANCHORS.tariffs} />

      {/* ── Экран 2.5: калькулятор дохода ─────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <IncomeCalculator id={USLUGI_ANCHORS.calculator} />
      </section>

      {/* ── Экран 3: гарантия платежа ────────────────────────────────── */}
      <PaymentGuarantee id="garantiya" />

      {/* ── Экран 4: сравнение ───────────────────────────────────────── */}
      <TariffComparison id="sravnenie" />

      {/* ── Экран 5: как это работает ────────────────────────────────── */}
      <HowItWorks id="kak-eto-rabotaet" />

      {/* ── Экран 6: документы ───────────────────────────────────────── */}
      <DocumentSamples id="dokumenty" />

      {/* ── Экран 7: что если ────────────────────────────────────────── */}
      <WhatIf id="chto-esli" items={SDAT_WHAT_IF} />

      {/* ── Экран 8: доверие + слот отзывов ──────────────────────────── */}
      <TrustBlock id="komanda" stats={stats} />

      {/* ── Экран 9: заявка ──────────────────────────────────────────── */}
      <section
        id={USLUGI_ANCHORS.lead}
        className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-4 scroll-mt-20"
      >
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
              Расскажите про квартиру
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
              Район, комнатность и что вас беспокоит — этого хватит, чтобы назвать ставку и тариф.
              Консультация до договора бесплатная.
            </p>

            <div className="hp-block mt-5">
              <div className="hp-block-header">Или напишите сами</div>
              <div className="hp-block-row">
                <span className="label flex items-center gap-2">
                  <Send style={{ width: 14, height: 14, color: 'var(--hp-accent)' }} />
                  Telegram
                </span>
                <a
                  href={USLUGI_CONTACTS.telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="value transition-opacity hover:opacity-70"
                  {...analyticsAttrs(ANALYTICS_EVENTS.telegramClick)}
                >
                  Написать
                </a>
              </div>
              <div className="hp-block-row">
                <span className="label flex items-center gap-2">
                  <Phone style={{ width: 14, height: 14, color: 'var(--hp-accent)' }} />
                  Телефон
                </span>
                <a
                  href={USLUGI_CONTACTS.phoneHref}
                  className="value transition-opacity hover:opacity-70 whitespace-nowrap"
                  {...analyticsAttrs(ANALYTICS_EVENTS.phoneClick)}
                >
                  {USLUGI_CONTACTS.phone}
                </a>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <UslugiLeadForm
              source={USLUGI_LEAD_SOURCES.sdatKvartiru}
              page={USLUGI_ROUTES.sdatKvartiru}
              submitLabel="Отправить заявку"
              withObjectFields
            />
          </div>
        </div>
      </section>

      {/* Отступ снизу под липкую панель на мобильном */}
      <div className="h-16 md:hidden" aria-hidden="true" />

      <StickyMobileBar heroId={HERO_ID} />
    </>
  )
}
