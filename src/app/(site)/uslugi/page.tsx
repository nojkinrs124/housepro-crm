import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, FileSignature, KeyRound, Search } from 'lucide-react'
import { ANALYTICS_EVENTS, analyticsAttrs } from '@/features/site/uslugi/analytics'
import { formatRub } from '@/features/site/uslugi/calc'
import {
  SALE_PRICING,
  TARIFFS,
  USLUGI,
  USLUGI_ANCHORS,
  USLUGI_CONTACTS,
  USLUGI_LEAD_SOURCES,
  USLUGI_ROUTES,
  tenantCommissionLabel,
} from '@/features/site/uslugi/config'
import { UslugiLeadForm } from '@/features/site/uslugi/components/UslugiLeadForm'

/**
 * Хаб раздела «Услуги»: три карточки-ссылки на страницы услуг, блок «Что
 * одинаково в любой услуге» и форма заявки для тех, кто не понял, что ему нужно.
 *
 * Тексты — дословно из docs/uslugi/uslugi-ostalnye-stranicy-texts.md (раздел 1),
 * числа — только из config.ts. Серверный компонент: интерактивность — внутри
 * UslugiLeadForm.
 */

export const metadata: Metadata = {
  alternates: { canonical: '/uslugi' },
  title: 'Услуги ХаусПро в Красноярске — управление, аренда, продажа | Руслан Ножкин, частный риелтор',
  description:
    'Доверительное управление, сдача, съём, продажа и покупка квартиры в Красноярске. Тарифы и стоимость каждой услуги названы заранее. Работаю по договору, проверяю документы, фиксирую состояние актом.',
}

interface ServiceCard {
  /** Крупная цифра цены (засечки) и пояснение под ней */
  priceValue?: string
  priceNote?: string
  Icon: typeof KeyRound
  href: string
  title: string
  text: string
  /** Жирная строка цены; null — блок цены не выводится (значение не задано в конфиге) */
  price: string | null
  linkLabel: string
}

const SERVICES: ServiceCard[] = [
  {
    Icon: KeyRound,
    href: USLUGI_ROUTES.sdatKvartiru,
    title: 'Сдать квартиру',
    text:
      'Не хотите сами разбираться с нанимателем? Нахожу и проверяю его, оформляю договор и акт, дальше веду квартиру по тарифу: от разового подбора до полного управления с гарантией платежа.',
    price: `От ${TARIFFS.upravlenie.percent}% в месяц. Первая сделка — бесплатно.`,
    priceValue: `от ${TARIFFS.upravlenie.percent}%`,
    priceNote: 'в месяц за управление · первая сделка бесплатно',
    linkLabel: 'Подробнее и калькулятор дохода',
  },
  {
    Icon: Search,
    href: USLUGI_ROUTES.snyatKvartiru,
    title: 'Снять квартиру',
    text:
      'Боитесь нарваться на недобросовестного собственника? Подбираю жильё под бюджет и район, включая квартиры, которых нет в открытом доступе, и проверяю документы до внесения залога.',
    price: `${tenantCommissionLabel()} от месячной ставки, один раз при заселении.`,
    priceValue: tenantCommissionLabel(),
    priceNote: 'от месячной ставки, один раз при заселении',
    linkLabel: 'Подробнее',
  },
  {
    Icon: FileSignature,
    href: USLUGI_ROUTES.prodatKupit,
    title: 'Продать или купить',
    text:
      'Не хотите разбираться в юридической чистоте сделки сами? Веду её целиком: оценка, реклама, показы, проверка второй стороны, расчёты и регистрация перехода права.',
    price: SALE_PRICING
      ? `${SALE_PRICING.percent}% от стоимости объекта плюс ${formatRub(SALE_PRICING.fixedRub)}.`
      : null,
    priceValue: SALE_PRICING ? `${SALE_PRICING.percent}% + ${formatRub(SALE_PRICING.fixedRub)}` : undefined,
    priceNote: 'от стоимости объекта, фиксируется в договоре',
    linkLabel: 'Подробнее',
  },
]

const COMMON_POINTS = [
  'Работаю по договору — обязанности и комиссия зафиксированы текстом',
  'Проверяю документы до того, как вы отдадите деньги',
  'Состояние объекта фиксирую актом с описью и фото',
  'Комиссию называю до начала работы, доплат «за оформление» не бывает',
]

const LEAD_FOOTNOTE = `Перезвоню в течение ${USLUGI.callback.withinMinutes} минут. ${USLUGI.callback.workingHours}.`

export default function UslugiHubPage() {
  return (
    <>
      {/* ── Первый экран: заголовок и три карточки ─────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-10 sm:pt-14">
        <header className="max-w-[720px]">
          <h1
            className="text-[30px] sm:text-[40px] font-bold tracking-tight leading-tight"
            style={{ color: 'var(--hp-ink)' }}
          >
            Услуги ХаусПро
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
            Выберите, что вам нужно. На каждой странице написано, что именно я делаю и сколько это
            стоит — цену называю до начала работы, а не в день подписания.
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {SERVICES.map(({ Icon, href, title, text, price, priceValue, priceNote, linkLabel }) => (
            <Link
              key={href}
              href={href}
              className="hp-card hp-card-hover flex flex-col h-full p-5 sm:p-6"
              {...analyticsAttrs(ANALYTICS_EVENTS.hubCardClick, { target: href })}
            >
              <Icon aria-hidden="true" strokeWidth={1.75} style={{ width: 26, height: 26, color: 'var(--hp-accent)' }} />

              <h2 className="mt-4 text-[21px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
                {title}
              </h2>
              <p className="mt-2 text-[16px] leading-relaxed flex-1" style={{ color: 'var(--hp-sub)' }}>
                {text}
              </p>

              {price && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--hp-border-soft)' }}>
                  {priceValue ? (
                    <>
                      <p className="hp-price text-[26px] leading-none" style={{ color: 'var(--hp-ink)' }}>{priceValue}</p>
                      {priceNote && (
                        <p className="mt-1.5 text-[14px]" style={{ color: 'var(--hp-sub)' }}>{priceNote}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-[14px] font-bold leading-relaxed" style={{ color: 'var(--hp-ink)' }}>{price}</p>
                  )}
                </div>
              )}

              <span
                className="mt-4 text-[14px] font-semibold inline-flex items-center gap-1.5"
                style={{ color: 'var(--hp-accent)' }}
              >
                {linkLabel}
                <ArrowRight aria-hidden="true" style={{ width: 14, height: 14 }} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Что одинаково в любой услуге ───────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Что одинаково в любой услуге
        </h2>
        <div
          className="mt-6 border p-5 sm:p-6"
          style={{
            background: 'var(--hp-surface)',
            borderColor: 'var(--hp-border)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {COMMON_POINTS.map(point => (
              <li
                key={point}
                className="flex items-start gap-2.5 text-[16px] leading-relaxed"
                style={{ color: 'var(--hp-ink)' }}
              >
                <Check
                  aria-hidden="true"
                  style={{ width: 16, height: 16, marginTop: 3, color: 'var(--hp-accent)', flexShrink: 0 }}
                />
                <span className="break-words">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

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
              Оставить заявку
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
              Не поняли, что вам нужно? Опишите ситуацию одной строкой — я подскажу. Консультация
              бесплатная.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <a
                href={USLUGI_CONTACTS.phoneHref}
                className="hp-btn-secondary h-11 justify-center"
                {...analyticsAttrs(ANALYTICS_EVENTS.phoneClick)}
              >
                Позвонить {USLUGI_CONTACTS.phone}
              </a>
            </div>
          </div>

          <div className="min-w-0">
            <UslugiLeadForm
              source={USLUGI_LEAD_SOURCES.hub}
              page={USLUGI_ROUTES.hub}
              submitLabel="Оставить заявку"
              footnote={LEAD_FOOTNOTE}
            />
          </div>
        </div>
      </section>
    </>
  )
}
