import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { ArrowRight, Check, FileText, KeyRound, Search } from 'lucide-react'
import { getSiteContacts, LEGAL_FORM_COPY } from '@/features/site/lib/contacts'
import { fetchSiteStats } from '@/features/site/lib/stats'
import { SITE_BRAND } from '@/features/site/config'
import { ANALYTICS_EVENTS, analyticsAttrs } from '@/features/site/uslugi/analytics'
import { formatRub } from '@/features/site/uslugi/calc'
import {
  LEGAL_SUPPORT_PRICING,
  SALE_PRICING,
  TARIFFS,
  TRUST,
  USLUGI,
  USLUGI_ANCHORS,
  USLUGI_LEAD_SOURCES,
  USLUGI_ROUTES,
} from '@/features/site/uslugi/config'
import { WhatIf, type WhatIfItem } from '@/features/site/uslugi/components/WhatIf'
import { UslugiLeadForm } from '@/features/site/uslugi/components/UslugiLeadForm'

export const metadata: Metadata = {
  title: 'О компании — ХаусПро, аренда и управление квартирами в Красноярске',
  description: `Небольшое агентство недвижимости в Красноярске и Берёзовке: с ${TRUST.sinceYear} года, больше ${TRUST.closedDeals} сделок, квартиры в доверительном управлении. Кто отвечает за вашу квартиру, как мы работаем и что написано в договоре.`,
}

const SERIF = "'Source Serif 4', Georgia, serif"

/** Фото основателя: файл кладётся в public/site/, страница подхватывает сама */
const FOUNDER_PHOTO = '/site/ruslan.jpg'

function founderPhotoExists(): boolean {
  return existsSync(path.join(process.cwd(), 'public', FOUNDER_PHOTO))
}

const PRINCIPLES = [
  {
    title: 'Работаем по договору с самого начала',
    text: 'Устная договорённость «покажем — потом решим» не даёт вам никаких прав. Мы подписываем договор с агентством до начала работы: в нём написано, что мы делаем, в какой срок и сколько это стоит.',
  },
  {
    title: 'Не берём объект, документы которого не сходятся',
    text: 'Если собственник не может показать основание права, есть непогашенное обременение или не получено согласие второго супруга — мы не выводим объект на показы. Это стоит нам сделок, но избавляет клиентов от расторжений.',
  },
  {
    title: 'Один человек ведёт сделку до конца',
    text: 'Вас не передают между сотрудниками. Тот, кто провёл первый показ, доводит дело до подписания акта и остаётся на связи после — по вопросам продления, ремонта и возврата депозита.',
  },
  {
    title: 'Говорим о рисках прямо',
    text: 'Если квартира дешевле рынка — объясняем, почему. Если условия договора невыгодны вам — говорим об этом, даже когда сделка уже почти состоялась.',
  },
]

const DIFFERENCES = [
  {
    label: 'Договор',
    usually: 'Шаблон из интернета, куда вписали адрес',
    ours: 'Договор под конкретную квартиру: срок, оплата, коммуналка, мелкий ремонт, расторжение, депозит',
  },
  {
    label: 'Комиссия',
    usually: '«Обсудим при встрече»',
    ours: 'Тарифы и калькулятор на сайте. Комиссия попадает в договор до начала работы',
  },
  {
    label: 'После заселения',
    usually: 'Риелтор получил комиссию и исчез',
    ours: `Управление: контроль оплаты, проверка раз в ${USLUGI.inspectionEveryMonths} месяца, отчёт в личном кабинете. На «Премиуме» — гарантия платежа`,
  },
]

const CONTRACT_POINTS = [
  'Комиссия — по выбранному тарифу, цифрой. Доплат «за оформление» нет.',
  'Что мы обязаны делать — списком, без пункта «и другие вопросы по объекту».',
  `Деньги переводим с ${USLUGI.payoutWindow.fromDay}-го по ${USLUGI.payoutWindow.toDay}-е число, отчёт — в личном кабинете.`,
  `Расторжение — по вашему письменному уведомлению за ${USLUGI.agencyTermination.noticeDays} дней, без штрафов и удержаний.`,
]

function buildFaq(legalForm: keyof typeof LEGAL_FORM_COPY): WhatIfItem[] {
  const form = LEGAL_FORM_COPY[legalForm]
  const salePart = SALE_PRICING
    ? ` Сопровождение продажи или покупки — ${SALE_PRICING.percent}% плюс ${formatRub(SALE_PRICING.fixedRub)}`
    : ''
  const legalPart = LEGAL_SUPPORT_PRICING
    ? `${salePart ? ',' : ''} юридическое сопровождение отдельно — от ${formatRub(LEGAL_SUPPORT_PRICING.fromRub)}.`
    : salePart
      ? '.'
      : ''

  const items: WhatIfItem[] = [
    {
      q: 'Сколько стоит ваша работа?',
      a: `Для собственника — три тарифа: разовый подбор ${TARIFFS.podbor.percent}% один раз при заселении, управление ${TARIFFS.upravlenie.percent}% в месяц, премиум с гарантией платежа ${TARIFFS.premium.percent}% в месяц. Первая сделка бесплатно. Для нанимателя — ${USLUGI.tenantCommissionPercent}% от месячной ставки при заселении.${salePart}${legalPart} Все цифры — на страницах услуг, доплат «за оформление» в день подписания у нас нет.`,
    },
  ]

  // Вопрос про форму собственности имеет смысл, пока это не ООО
  if (legalForm !== 'ooo') {
    items.push({
      q: `Вы ${form.short}, а не ООО — это надёжно?`,
      a: `Форма — это про налоги, а не про ответственность. Договор с ${form.instrumental} имеет ту же силу, что и с ООО, а отвечает по нему конкретный человек с именем и ИНН. Реквизиты — ниже на этой странице и в каждом договоре.`,
    })
  }

  items.push(
    {
      q: 'Что будет с моей квартирой, если вы закроетесь?',
      a: `Договор найма заключён между вами и нанимателем — он не зависит от агентства и продолжает действовать. Депозит нанимателя хранится у нас, и при расторжении договора с агентством мы передаём его вам вместе с документами, ключами и контактами нанимателя — по акту, в течение ${USLUGI.agencyTermination.noticeDays} дней уведомления. Квартира не останется без хозяина ни на день.`,
    },
    {
      q: 'Почему в каталоге мало объектов?',
      a: 'В открытую публикацию попадают только те объекты, которые собственник разрешил показывать публично. Значительная часть базы закрыта по просьбе владельцев. Оставьте заявку с параметрами — агент подберёт варианты из закрытой части.',
    },
    {
      q: 'Что вы проверяете перед сделкой?',
      a: 'Выписку из ЕГРН, основание права собственности, наличие обременений и арестов, зарегистрированных в квартире лиц, согласие супруга при совместной собственности, полномочия представителя, если собственник действует по доверенности. Нанимателя — по паспорту, ФССП, реестру банкротов и занятости.',
    },
    {
      q: 'Я живу в другом городе.',
      a: 'Работаем удалённо: подписание по электронной подписи, отчёты и фото — в личном кабинете, деньги на карту. Приезжать не нужно ни разу.',
    },
    {
      q: 'Занимаетесь коммерческой недвижимостью?',
      a: 'По запросу. Если у вас офис, торговое помещение или склад под сдачу — напишите, посмотрим объект и честно скажем, возьмём ли.',
    },
    {
      q: 'Что делать, если после заезда что-то сломалось?',
      a: `В договоре и акте разделено, что относится к естественному износу и обязанностям собственника, а что — к ответственности нанимателя. На «Управлении» и «Премиуме» мелкий ремонт до ${formatRub(USLUGI.minorRepairs.perIncidentRub)} за поломку делаем за свой счёт. Если спор всё же возник, разбирает его тот, кто вёл сделку.`,
    }
  )
  return items
}

const cardStyle = {
  background: 'var(--hp-surface)',
  borderColor: 'var(--hp-border)',
  borderRadius: 'var(--hp-radius)',
} as const

/**
 * /o-kompanii — кто мы и почему нам отдают квартиры.
 * Тексты — docs/uslugi/o-kompanii-texts.md; цифры — TRUST + живые из CRM
 * (fetchSiteStats), форма собственности и реквизиты — из company_settings.
 */
export default async function AboutPage() {
  const [contacts, stats] = await Promise.all([getSiteContacts(), fetchSiteStats()])
  const form = LEGAL_FORM_COPY[contacts.legalForm]
  const faq = buildFaq(contacts.legalForm)
  const hasPhoto = founderPhotoExists()

  const facts = [
    { label: 'В недвижимости', value: `с ${TRUST.sinceYear} года` },
    { label: 'Закрытых сделок', value: `больше ${stats.closedDeals}` },
    { label: 'Квартир в управлении', value: String(stats.objectsInManagement) },
    { label: 'Работаем', value: TRUST.workingHours, small: true },
  ]

  return (
    <>
      {/* ── Экран 1 ──────────────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-10 sm:pt-14">
        <div className="max-w-[760px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--hp-sub)' }}>
            О компании · Красноярск и Берёзовка
          </p>
          <h1
            className="mt-4 text-[30px] sm:text-[40px] font-bold tracking-tight leading-[1.08] break-words"
            style={{ color: 'var(--hp-ink)' }}
          >
            Небольшое агентство, которому собственники отдают ключи
          </h1>
          <p className="mt-5 text-[16px] sm:text-[17px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
            {SITE_BRAND} — это Руслан Ножкин и команда. С {TRUST.sinceYear} года сдаём, ведём и продаём
            квартиры в Красноярске и Берёзовке. Основное — аренда и доверительное управление:
            собственники получают деньги на карту и отчёт в личном кабинете, а не звонки про потёкший
            кран.
          </p>
        </div>

        {/* На телефоне 2×2: у нижнего ряда нужна верхняя линия, на десктопе — один ряд */}
        <div className="mt-8 hp-strip grid-cols-2 lg:grid-cols-4">
          {facts.map((f, i) => (
            <div
              key={f.label}
              className={`hp-strip-cell ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i === 2 ? 'border-l-0 lg:border-l' : ''}`}
              style={{ borderTopColor: 'var(--hp-border-soft)' }}
            >
              <p className="hp-strip-label">{f.label}</p>
              <p className={f.small ? 'hp-strip-value sm' : 'hp-strip-value'}>{f.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Экран 2: основатель ──────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Кто отвечает за вашу квартиру
        </h2>
        <div
          className={`mt-8 border p-5 sm:p-8 grid grid-cols-1 gap-8 items-start ${
            hasPhoto ? 'lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]' : ''
          }`}
          style={cardStyle}
        >
          {hasPhoto && (
            <div
              className="relative w-full aspect-square overflow-hidden border"
              style={{ borderColor: 'var(--hp-border)', borderRadius: 'var(--hp-radius)' }}
            >
              <Image
                src={FOUNDER_PHOTO}
                alt="Руслан Ножкин, основатель ХаусПро"
                fill
                sizes="(min-width: 1024px) 360px, 100vw"
                className="object-cover"
                // Кадр горизонтальный, человек правее центра — при квадратном кропе
                // держим фокус на лице, а не на светильнике слева
                style={{ objectPosition: '68% center' }}
                priority
              />
            </div>
          )}
          <div className="min-w-0 max-w-[680px] space-y-4 text-[15px] sm:text-[16px] leading-relaxed" style={{ color: 'var(--hp-ink)' }}>
            <p>
              В недвижимость я пришёл в {TRUST.sinceYear} году — агентом по аренде: показы, договоры,
              заселения. Довольно быстро стало понятно, что собственнику нужен не риелтор на один день,
              а человек, который останется с квартирой после заселения: примет звонок про кран,
              напомнит нанимателю об оплате, приедет на проверку. Так появилось управление — и сейчас
              это главное, что мы делаем.
            </p>
            <p>
              Управление — это про доверие. Человек отдаёт ключи от квартиры и ждёт, что деньги придут
              вовремя, а квартира вернётся в том же состоянии. Поэтому я работаю под своим именем,
              реквизиты открыты, а условия тарифов написаны на сайте, а не «обсуждаются при встрече».
            </p>
            <p>
              Сделки ведём вместе с командой, но за каждую квартиру в управлении отвечаю я лично — мой
              номер стоит в шапке сайта.
            </p>
            <p className="pt-2 text-[14px]" style={{ color: 'var(--hp-sub)' }}>
              <span className="font-semibold" style={{ color: 'var(--hp-ink)', fontFamily: SERIF, fontSize: 17 }}>
                Руслан Ножкин
              </span>
              , основатель {SITE_BRAND}
              {contacts.inn && <> · ИНН {contacts.inn}</>}
            </p>
          </div>
        </div>
      </section>

      {/* ── Экран 3: принципы ────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Как мы работаем
        </h2>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PRINCIPLES.map(({ title, text }) => (
            <div key={title} className="p-5 sm:p-6 border h-full flex flex-col" style={cardStyle}>
              <h3 className="text-[16px] font-bold leading-snug" style={{ color: 'var(--hp-ink)' }}>
                {title}
              </h3>
              <p className="mt-2.5 text-[14px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Экран 4: отличия ─────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Чем это отличается от риелтора с Авито
        </h2>
        <div className="mt-8 border" style={cardStyle}>
          {DIFFERENCES.map((d, i) => (
            <div
              key={d.label}
              className={`grid grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] gap-3 sm:gap-6 px-5 sm:px-6 py-5 ${
                i > 0 ? 'border-t' : ''
              }`}
              style={{ borderColor: 'var(--hp-border-soft)' }}
            >
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] sm:pt-0.5" style={{ color: 'var(--hp-sub)' }}>
                {d.label}
              </p>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--hp-tertiary)' }}>
                  Обычно
                </p>
                <p className="mt-1 text-[14px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
                  {d.usually}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--hp-accent)' }}>
                  У нас
                </p>
                <p className="mt-1 text-[14px] leading-relaxed font-medium" style={{ color: 'var(--hp-ink)' }}>
                  {d.ours}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Экран 5: что в договоре ──────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <div className="border p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-8" style={cardStyle}>
          <div className="min-w-0">
            <div
              className="w-10 h-10 flex items-center justify-center border"
              style={{ background: 'var(--hp-neutral-tint)', borderColor: 'var(--hp-border)', borderRadius: 'var(--hp-radius)' }}
            >
              <FileText style={{ width: 18, height: 18, color: 'var(--hp-ink)' }} />
            </div>
            <h2 className="mt-4 text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
              Что написано в договоре с агентством
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
              Четыре вещи, которые собственник обычно узнаёт постфактум. У нас они в договоре текстом.
            </p>
            <Link
              href={`${USLUGI_ROUTES.sdatKvartiru}#dokumenty`}
              className="hp-btn-secondary h-11 justify-center mt-5"
              {...analyticsAttrs(ANALYTICS_EVENTS.documentSample, { document: 'about-page' })}
            >
              Посмотреть образцы документов
            </Link>
          </div>
          <ul className="space-y-3">
            {CONTRACT_POINTS.map(p => (
              <li key={p} className="flex items-start gap-3 text-[14.5px] leading-relaxed" style={{ color: 'var(--hp-ink)' }}>
                <Check aria-hidden="true" style={{ width: 16, height: 16, marginTop: 4, flexShrink: 0, color: 'var(--hp-accent)' }} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Экран 6: FAQ ─────────────────────────────────────────────── */}
      <WhatIf id="voprosy" title="Частые вопросы" items={faq} />

      {/* ── Экран 7: реквизиты ───────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          Реквизиты
        </h2>
        <div className="mt-8 hp-block">
          <div className="hp-block-header">{form.label}</div>
          {contacts.legalName && (
            <div className="hp-block-row">
              <span className="label">Исполнитель</span>
              <span className="value break-words">{contacts.legalName}</span>
            </div>
          )}
          {contacts.inn && (
            <div className="hp-block-row">
              <span className="label">ИНН</span>
              <span className="value">{contacts.inn}</span>
            </div>
          )}
          {contacts.ogrn && form.regNumberLabel && (
            <div className="hp-block-row">
              <span className="label">{form.regNumberLabel}</span>
              <span className="value">{contacts.ogrn}</span>
            </div>
          )}
          <div className="hp-block-row">
            <span className="label">Телефон</span>
            <a
              href={contacts.phoneHref}
              className="value transition-opacity hover:opacity-70 whitespace-nowrap"
              {...analyticsAttrs(ANALYTICS_EVENTS.phoneClick)}
            >
              {contacts.phone}
            </a>
          </div>
          <div className="hp-block-row">
            <span className="label">Почта</span>
            <a href={`mailto:${contacts.email}`} className="value break-all transition-opacity hover:opacity-70">
              {contacts.email}
            </a>
          </div>
          <div className="hp-block-row">
            <span className="label">Адрес</span>
            <span className="value break-words">{contacts.address}</span>
          </div>
          <div className="hp-block-row">
            <span className="label">Часы работы</span>
            <span className="value">{TRUST.workingHours}</span>
          </div>
        </div>
      </section>

      {/* ── Экран 8: с чего начать + заявка ──────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-16 sm:pt-20">
        <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
          С чего начать
        </h2>
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <div className="p-5 sm:p-6 border flex flex-col h-full" style={cardStyle}>
            <div
              className="w-10 h-10 flex items-center justify-center border"
              style={{ background: 'var(--hp-neutral-tint)', borderColor: 'var(--hp-border)', borderRadius: 'var(--hp-radius)' }}
            >
              <KeyRound style={{ width: 18, height: 18, color: 'var(--hp-ink)' }} />
            </div>
            <h3 className="mt-4 text-[18px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
              Сдать квартиру
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed flex-1" style={{ color: 'var(--hp-sub)' }}>
              Посчитайте доход по трём тарифам и оставьте заявку — перезвоним в течение{' '}
              {USLUGI.callback.withinMinutes} минут.
            </p>
            <Link
              href={USLUGI_ROUTES.sdatKvartiru}
              className="hp-btn-primary h-11 justify-center mt-5"
              {...analyticsAttrs(ANALYTICS_EVENTS.hubCardClick, { target: USLUGI_ROUTES.sdatKvartiru })}
            >
              Тарифы и калькулятор
              <ArrowRight style={{ width: 15, height: 15 }} />
            </Link>
          </div>
          <div className="p-5 sm:p-6 border flex flex-col h-full" style={cardStyle}>
            <div
              className="w-10 h-10 flex items-center justify-center border"
              style={{ background: 'var(--hp-neutral-tint)', borderColor: 'var(--hp-border)', borderRadius: 'var(--hp-radius)' }}
            >
              <Search style={{ width: 18, height: 18, color: 'var(--hp-ink)' }} />
            </div>
            <h3 className="mt-4 text-[18px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
              Снять, продать или купить
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed flex-1" style={{ color: 'var(--hp-sub)' }}>
              Свободные объекты в каталоге, закрытая база — по заявке.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <Link href="/catalog" className="hp-btn-secondary h-11 justify-center">
                Смотреть объекты
              </Link>
              <Link
                href={USLUGI_ROUTES.prodatKupit}
                className="hp-btn-secondary h-11 justify-center"
                {...analyticsAttrs(ANALYTICS_EVENTS.hubCardClick, { target: USLUGI_ROUTES.prodatKupit })}
              >
                Продажа и покупка
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id={USLUGI_ANCHORS.lead}
        className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-10 pb-4 scroll-mt-20"
      >
        <div className="border p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-8" style={cardStyle}>
          <div className="min-w-0">
            <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight" style={{ color: 'var(--hp-ink)' }}>
              Напишите нам
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
              Опишите ситуацию одной строкой — агент подскажет, с чего начать. Консультация бесплатная.
            </p>
          </div>
          <div className="min-w-0">
            <UslugiLeadForm
              source={USLUGI_LEAD_SOURCES.about}
              page={USLUGI_ROUTES.about}
              submitLabel="Отправить заявку"
              messagePlaceholder="Например: сдаю квартиру сама третий год, хочу понять, что даст управление"
              footnote={`Перезвоним в течение ${USLUGI.callback.withinMinutes} минут. ${USLUGI.callback.workingHours}.`}
            />
          </div>
        </div>
      </section>
    </>
  )
}
