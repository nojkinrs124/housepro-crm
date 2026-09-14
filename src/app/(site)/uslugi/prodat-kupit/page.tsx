import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { ANALYTICS_EVENTS, analyticsAttrs } from '@/features/site/uslugi/analytics'
import { formatRub } from '@/features/site/uslugi/calc'
import {
  LEGAL_SUPPORT_PRICING,
  SALE_PRICING,
  USLUGI,
  USLUGI_ANCHORS,
  USLUGI_CONTACTS,
  USLUGI_LEAD_SOURCES,
  USLUGI_ROUTES,
} from '@/features/site/uslugi/config'
import { UslugiLeadForm } from '@/features/site/uslugi/components/UslugiLeadForm'
import { WhatIf, type WhatIfItem } from '@/features/site/uslugi/components/WhatIf'

/**
 * Страница «Продать или купить» — сопровождение сделки купли-продажи и
 * юридическое сопровождение отдельно.
 *
 * Тексты — дословно из docs/uslugi/uslugi-ostalnye-stranicy-texts.md (раздел 3),
 * числа — только из config.ts. Блоки цены скрываются целиком, если SALE_PRICING /
 * LEGAL_SUPPORT_PRICING не заданы. Серверный компонент: интерактивность — внутри
 * WhatIf (аккордеон) и UslugiLeadForm.
 */

const SEO_PRICE_TAIL = [
  SALE_PRICING ? `${SALE_PRICING.percent}% плюс ${formatRub(SALE_PRICING.fixedRub)}.` : null,
  LEGAL_SUPPORT_PRICING ? `Юрсопровождение отдельно — от ${formatRub(LEGAL_SUPPORT_PRICING.fromRub)}.` : null,
]
  .filter(Boolean)
  .join(' ')

export const metadata: Metadata = {
  title: 'Продать или купить квартиру в Красноярске — сопровождение сделки | ХаусПро',
  description: [
    'Сопровождение сделки купли-продажи: оценка, реклама, показы, проверка юридической чистоты, безопасные расчёты и регистрация.',
    SEO_PRICE_TAIL,
  ]
    .filter(Boolean)
    .join(' '),
}

const SELLING = [
  'Оцениваем объект по реальным сделкам, а не по ценам из объявлений, где квартиры висят месяцами',
  'Готовим квартиру к продаже: что стоит поправить, а на что не тратиться',
  'Фотосъёмка и объявление — за наш счёт',
  'Реклама на площадках, обработка звонков, показы без вашего участия',
  'Проверяем покупателя и его деньги: одобрена ли ипотека, как используется маткапитал, откуда наличные',
  'Собираем документы: ЕГРН, справки, согласия, снятие обременений',
  'Проводим расчёты безопасно — аккредитив, счёт эскроу или банковская ячейка, а не наличные в машине',
  'Подаём на регистрацию и доводим до выписки о переходе права',
]

const BUYING = [
  'Подбираем объекты под задачу и бюджет, включая закрытую базу',
  'Проверяем юридическую чистоту: история переходов права, обременения и аресты, банкротство продавца, согласие супруга, несовершеннолетние собственники, законность перепланировок',
  'Торгуемся — как правило, отбиваем часть комиссии ещё на этом шаге',
  'Сопровождаем ипотеку и расчёты, готовим договор, подаём на регистрацию',
]

const PRODAT_WHAT_IF: WhatIfItem[] = [
  {
    q: 'Покупатель найдётся не сразу.',
    a: 'Через три недели рекламы показываем статистику просмотров и звонков и честно говорим, дело в цене или в подаче. Держать объект на завышенной цене полгода не в наших интересах.',
  },
  {
    q: 'Сделка сорвётся в последний момент.',
    a: 'Расчёты идут через аккредитив или ячейку: деньги переходят продавцу только после регистрации. Сорвалась сделка — деньги возвращаются покупателю.',
  },
  {
    q: 'Один из собственников — несовершеннолетний.',
    a: 'Работаем с органами опеки: готовим документы на разрешение и подбираем схему, при которой сделку одобрят.',
  },
  {
    q: 'Покупка в ипотеку.',
    a: 'Сопровождаем: подача заявки, оценка, страхование, требования банка к объекту и к документам.',
  },
  {
    q: 'Продавец в браке или в разводе.',
    a: 'Проверяем режим имущества и наличие согласия супруга. Это одна из самых частых причин, по которым сделку потом оспаривают.',
  },
]

const LEAD_FOOTNOTE = `Перезвоним в течение ${USLUGI.callback.withinMinutes} минут. ${USLUGI.callback.workingHours}.`

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map(item => (
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
  )
}

export default function ProdatKupitPage() {
  return (
    <>
      {/* ── Первый экран ───────────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-10 sm:pt-14">
        <div className="max-w-[760px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--hp-sub)' }}>
            Продавцам и покупателям · Красноярск и Берёзовка
          </p>
          <h1
            className="mt-4 text-[30px] sm:text-[40px] font-bold tracking-tight leading-tight break-words"
            style={{ color: 'var(--hp-ink)' }}
          >
            Продать или купить квартиру в Красноярске
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed max-w-[640px]" style={{ color: 'var(--hp-sub)' }}>
            Ведём сделку целиком — от оценки до выписки из ЕГРН о новом собственнике. Отвечаем за
            юридическую часть, а не только за показы.
          </p>

          {SALE_PRICING && (
            <div
              className="mt-6 border px-4 py-3 text-[14px] font-semibold leading-relaxed"
              style={{
                background: 'var(--hp-good-tint)',
                borderColor: 'var(--hp-good)',
                borderRadius: 'var(--hp-radius)',
                color: 'var(--hp-ink)',
              }}
            >
              {SALE_PRICING.percent}% от стоимости объекта плюс {formatRub(SALE_PRICING.fixedRub)}. Цена известна
              до начала работы и фиксируется в договоре.
            </div>
          )}

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a href={`#${USLUGI_ANCHORS.lead}`} className="hp-btn-primary h-11 justify-center">
              Оставить заявку
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

      {/* ── Продаёте / покупаете ───────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <article
            className="border p-5 sm:p-6"
            style={{
              background: 'var(--hp-surface)',
              borderColor: 'var(--hp-border)',
              borderRadius: 'var(--hp-radius)',
            }}
          >
            <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
              Если вы продаёте
            </h2>
            <CheckList items={SELLING} />
          </article>

          <article
            className="border p-5 sm:p-6"
            style={{
              background: 'var(--hp-surface)',
              borderColor: 'var(--hp-border)',
              borderRadius: 'var(--hp-radius)',
            }}
          >
            <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
              Если вы покупаете
            </h2>
            <CheckList items={BUYING} />
          </article>
        </div>
      </section>

      {/* ── Юридическое сопровождение отдельно ─────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <div
          className="border p-5 sm:p-6"
          style={{
            background: 'var(--hp-surface)',
            borderColor: 'var(--hp-border)',
            borderRadius: 'var(--hp-radius)',
          }}
        >
          <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
            Юридическое сопровождение отдельно
          </h2>
          <p className="mt-2 text-[14px] sm:text-[15px] leading-relaxed max-w-[640px]" style={{ color: 'var(--hp-sub)' }}>
            Объект нашли сами, риелтор не нужен, но подписывать вслепую не хотите — берём на себя только
            правовую часть: проверка объекта и продавца, договор, безопасные расчёты, регистрация.
          </p>
          {LEGAL_SUPPORT_PRICING && (
            <p className="mt-4 text-[15px] font-bold leading-relaxed" style={{ color: 'var(--hp-ink)' }}>
              Фиксированная цена от {formatRub(LEGAL_SUPPORT_PRICING.fromRub)}, известна до начала работы.
            </p>
          )}
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <a href={`#${USLUGI_ANCHORS.lead}`} className="hp-btn-secondary h-11 justify-center">
              Заказать проверку сделки
            </a>
          </div>
        </div>
      </section>

      {/* ── Что если ───────────────────────────────────────────────────── */}
      <WhatIf items={PRODAT_WHAT_IF} />

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
              Расскажите про объект
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
              Что продаёте или что ищете, в каком районе и в какие сроки. Оценка и консультация до договора —
              бесплатно.
            </p>
          </div>

          <div className="min-w-0">
            <UslugiLeadForm
              source={USLUGI_LEAD_SOURCES.prodat}
              page={USLUGI_ROUTES.prodatKupit}
              submitLabel="Оставить заявку"
              messagePlaceholder="Например: продаю двушку в Октябрьском, хочу закрыть сделку до конца года"
              footnote={LEAD_FOOTNOTE}
            />
          </div>
        </div>
      </section>
    </>
  )
}
